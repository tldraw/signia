import React, { forwardRef, FunctionComponent, memo } from 'react'
import { useStateTracking } from './useStateTracking.js'

export const ProxyHandlers = {
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
	apply(Component: FunctionComponent, thisArg: any, argumentsList: any) {
		return useStateTracking(Component.displayName ?? Component.name ?? 'tracked(???)', () =>
			Component.apply(thisArg, argumentsList)
		)
	},
}

export const ReactLazySymbol = Symbol.for('react.lazy')
export const ReactMemoSymbol = Symbol.for('react.memo')
export const ReactForwardRefSymbol = Symbol.for('react.forward_ref')

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
export function track<T extends FunctionComponent<any>>(
	baseComponent: T
): T extends React.MemoExoticComponent<any> ? T : React.MemoExoticComponent<T> {
	let compare = null
	const $$typeof = baseComponent['$$typeof' as keyof typeof baseComponent]
	if ($$typeof === ReactMemoSymbol) {
		baseComponent = (baseComponent as any).type
		compare = (baseComponent as any).compare
	}
	if ($$typeof === ReactForwardRefSymbol) {
		return memo(forwardRef(new Proxy((baseComponent as any).render, ProxyHandlers) as any)) as any
	}
	if ($$typeof === ReactLazySymbol) {
		let result: unknown

		return memo({
			$$typeof: ReactLazySymbol,
			_payload: (baseComponent as unknown as { _payload: unknown })._payload,
			_init: (arg: unknown) => {
				if (!result) {
					const loaded = (
						baseComponent as unknown as { _init: (arg: unknown) => unknown } as any
					)._init(arg)
					result = new Proxy(loaded, ProxyHandlers)
				}
				return result
			},
		} as unknown as React.LazyExoticComponent<any> as any) as any
	}

	return memo(new Proxy(baseComponent, ProxyHandlers) as any, compare) as any
}
