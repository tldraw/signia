import {
	forwardRef,
	FunctionComponent,
	memo,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from 'react'
import { Atom, AtomOptions, Computed, ComputedOptions, Signal, Signia } from 'signia'

const ReactMemoSymbol = Symbol.for('react.memo')
const ReactForwardRefSymbol = Symbol.for('react.forward_ref')

export class SigniaReact {
	constructor(public readonly signia: Signia) {}

	private readonly ProxyHandlers = {
		/**
		 * This is a function call trap for functional components. When this is called, we know it means
		 * React did run 'Component()', that means we can use any hooks here to setup our effect and
		 * store.
		 *
		 * With the native Proxy, all other calls such as access/setting to/of properties will be
		 * forwarded to the target Component, so we don't need to copy the Component's own or inherited
		 * properties.
		 *
		 * @see https://github.com/facebook/react/blob/2d80a0cd690bb5650b6c8a6c079a87b5dc42bd15/packages/react-reconciler/src/ReactFiberHooks.old.js#L460
		 */
		apply: (Component: FunctionComponent, thisArg: any, argumentsList: any) => {
			return this.useStateTracking(Component.displayName ?? Component.name ?? 'tracked(???)', () =>
				Component.apply(thisArg, argumentsList)
			)
		},
	}

	/**
	 * Returns a tracked version of the given component.
	 * Any signals whose values are read while the component renders will be tracked.
	 * If any of the tracked signals change later it will cause the component to re-render.
	 *
	 * This also wraps the component in a React.memo() call, so it will only re-render if the props change.
	 *
	 * @example
	 * ```ts
	 * const Counter = track(function Counter(props: CounterProps) {
	 *   const count = useAtom('count', 0)
	 *   const increment = useCallback(() => count.set(count.value + 1), [count])
	 *   return <button onClick={increment}>{count.value}</button>
	 * })
	 * ```
	 *
	 * @param baseComponent
	 * @public
	 */
	readonly track = <T extends FunctionComponent<any>>(
		baseComponent: T
	): T extends React.MemoExoticComponent<any> ? T : React.MemoExoticComponent<T> => {
		let compare = null
		const $$typeof = baseComponent['$$typeof' as keyof typeof baseComponent]
		if ($$typeof === ReactMemoSymbol) {
			baseComponent = (baseComponent as any).type
			compare = (baseComponent as any).compare
		}
		if ($$typeof === ReactForwardRefSymbol) {
			return memo(
				forwardRef(new Proxy((baseComponent as any).render, this.ProxyHandlers) as any)
			) as any
		}

		return memo(new Proxy(baseComponent, this.ProxyHandlers) as any, compare) as any
	}

	/**
	 * Creates a new atom and returns it. The atom will be created only once.
	 *
	 * See [[signia.atom]]
	 *
	 * @example
	 * ```ts
	 * const Counter = track(function Counter () {
	 *   const count = useAtom('count', 0)
	 *   const increment = useCallback(() => count.set(count.value + 1), [count])
	 *   return <button onClick={increment}>{count.value}</button>
	 * })
	 * ```
	 *
	 * @public
	 */
	readonly useAtom = <Value, Diff = unknown>(
		/**
		 * The name of the atom. This does not need to be globally unique. It is used for debugging and performance profiling.
		 */
		name: string,
		/**
		 * The initial value of the atom. If this is a function, it will be called to get the initial value.
		 */
		valueOrInitialiser: Value | (() => Value),
		/**
		 * Options for the atom.
		 */
		options?: AtomOptions<Value, Diff>
	): Atom<Value, Diff> => {
		return useMemo(() => {
			const initialValue =
				typeof valueOrInitialiser === 'function'
					? (valueOrInitialiser as any)()
					: valueOrInitialiser

			return this.signia.atom(`useAtom(${name})`, initialValue, options)
		}, [])
	}

	/** @internal */
	useStateTracking: <T>(name: string, render: () => T) => T = (name: string, render) => {
		// user render is only called at the bottom of this function, indirectly via scheduler.execute()
		// we need it to always be up-to-date when calling scheduler.execute() but it'd be wasteful to
		// instantiate a new EffectScheduler on every render, so we use an immediately-updated ref
		// to wrap it
		const renderRef = useRef(render)
		renderRef.current = render

		const [scheduler, subscribe, getSnapshot] = useMemo(() => {
			let scheduleUpdate = null as null | (() => void)
			// useSyncExternalStore requires a subscribe function that returns an unsubscribe function
			const subscribe = (cb: () => void) => {
				scheduleUpdate = cb
				return () => {
					scheduleUpdate = null
				}
			}

			const scheduler = this.signia.effectScheduler(
				`useStateTracking(${name})`,
				// this is what `scheduler.execute()` will call
				() => renderRef.current?.(),
				// this is what will be invoked when signia detects a change in an upstream reactive value
				{
					scheduleEffect() {
						scheduleUpdate?.()
					},
				}
			)

			// we use an incrementing number based on when this
			const getSnapshot = () => scheduler.scheduleCount

			return [scheduler, subscribe, getSnapshot]
		}, [name])

		useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

		// reactive dependencies are captured when `scheduler.execute()` is called
		// and then to make it reactive we wait for a `useEffect` to 'attach'
		// this allows us to avoid rendering outside of React's render phase
		// and avoid 'zombie' components that try to render with bad/deleted data before
		// react has a chance to umount them.
		useEffect(() => {
			scheduler.attach()
			// do not execute, we only do that in render
			scheduler.maybeScheduleEffect()
			return () => {
				scheduler.detach()
			}
		}, [scheduler])

		return scheduler.execute()
	}

	/**
	 * Creates a new computed signal and returns it. The computed signal will be created only once.
	 *
	 * See [[signia.computed]]
	 *
	 * @example
	 * ```ts
	 * type GreeterProps = {
	 *   firstName: Signal<string>
	 *   lastName: Signal<string>
	 * }
	 *
	 * const Greeter = track(function Greeter ({firstName, lastName}: GreeterProps) {
	 *   const fullName = useComputed('fullName', () => `${firstName.value} ${lastName.value}`)
	 *   return <div>Hello {fullName.value}!</div>
	 * })
	 * ```
	 *
	 * @public
	 */
	readonly useComputed: {
		<Value>(name: string, compute: () => Value, deps: any[]): Computed<Value>
		<Value, Diff = unknown>(
			name: string,
			compute: () => Value,
			opts: ComputedOptions<Value, Diff>,
			deps: any[]
		): Computed<Value>
	} = (...args: any[]) => {
		const name = args[0]
		const compute = args[1]
		const opts = args.length === 3 ? undefined : args[2]
		const deps = args.length === 3 ? args[2] : args[3]
		return useMemo(() => this.signia.computed(`useComputed(${name})`, compute, opts), deps)
	}

	/**
	 * Extracts the value from a signal and subscribes to it.
	 *
	 * Note that you do not need to use this hook if you are doing one of the following:
	 *   - Wrapping the component with [[track]],
	 * 	 - Installing the jsx integration with [[signia-react-jsx.install]]
	 *
	 * @example
	 * ```ts
	 * const Counter: React.FC = () => {
	 *   const $count = useAtom('count', 0)
	 *   const increment = useCallback(() => $count.set($count.value + 1), [count])
	 *   const currentCount = useValue($count)
	 *   return <button onClick={increment}>{currentCount}</button>
	 * }
	 * ```
	 *
	 * You can also pass a function to compute the value and it will be memoized as in [[useComputed]]:
	 *
	 * @example
	 * ```ts
	 * type GreeterProps = {
	 *   firstName: Signal<string>
	 *   lastName: Signal<string>
	 * }
	 *
	 * const Greeter = track(function Greeter({ firstName, lastName }: GreeterProps) {
	 *   const fullName = useValue('fullName', () => `${firstName.value} ${lastName.value}`, [
	 *     firstName,
	 *     lastName,
	 *   ])
	 *   return <div>Hello {fullName}!</div>
	 * })
	 * ```
	 *
	 * @public
	 */
	useValue: {
		<Value>(value: Signal<Value>): Value
		<Value>(name: string, fn: () => Value, deps: unknown[]): Value
	} = (...args: any[]) => {
		// deps will be either the computed or the deps array
		const deps = args.length === 3 ? args[2] : [args[0]]
		const name = args.length === 3 ? args[0] : `useValue(${args[0].name})`

		const isInRender = useRef(true)
		isInRender.current = true

		const $val = useMemo(() => {
			if (args.length === 1) {
				return args[0]
			}
			return this.signia.computed(name, () => {
				if (isInRender.current) {
					return args[1]()
				} else {
					try {
						return args[1]()
					} catch {
						// when getSnapshot is called outside of the render phase &
						// subsequently throws an error, it might be because we're
						// in a zombie-child state. in that case, we suppress the
						// error and instead return a new dummy value to trigger a
						// react re-render. if we were in a zombie child, react will
						// unmount us instead of re-rendering so the error is
						// irrelevant. if we're not in a zombie-child, react will
						// call `getSnapshot` again in the render phase, and the
						// error will be thrown as expected.å
						return {}
					}
				}
			})
		}, deps)

		try {
			const { subscribe, getSnapshot } = useMemo(() => {
				return {
					subscribe: (listen: () => void) => {
						return this.signia.runEffect(`useValue(${name})`, () => {
							$val.value
							listen()
						})
					},
					getSnapshot: () => $val.value,
				}
			}, [$val])

			return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
		} finally {
			isInRender.current = false
		}
	}
}
