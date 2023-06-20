import { Atom, AtomOptions, _Atom } from './Atom'
import {
	Computed,
	computedAnnotation,
	ComputedConstructor,
	UNINITIALIZED,
	WithDiff,
	_Computed,
} from './Computed'
import { Effect, EffectScheduler, EffectSchedulerOptions } from './EffectScheduler'
import { SigniaContext } from './SigniaContext'
import { Signal } from './types'

/**
 * Creates an instance of the Signia signals framework.
 * 
 * Signals created by this instance will be isolated from signals created by other instances.
 */
export class Signia {
	private readonly ctx = new SigniaContext()
	/**
	 * Batches state updates, deferring side effects until after the transaction completes.
	 *
	 * @example
	 * ```ts
	 * const firstName = atom('John')
	 * const lastName = atom('Doe')
	 *
	 * react('greet', () => {
	 *   console.log(`Hello, ${firstName.value} ${lastName.value}!`)
	 * })
	 *
	 * // Logs "Hello, John Doe!"
	 *
	 * transaction(() => {
	 *  firstName.set('Jane')
	 *  lastName.set('Smith')
	 * })
	 *
	 * // Logs "Hello, Jane Smith!"
	 * ```
	 *
	 * If the function throws, the transaction is aborted and any signals that were updated during the transaction revert to their state before the transaction began.
	 *
	 * @example
	 * ```ts
	 * const firstName = atom('John')
	 * const lastName = atom('Doe')
	 *
	 * react('greet', () => {
	 *   console.log(`Hello, ${firstName.value} ${lastName.value}!`)
	 * })
	 *
	 * // Logs "Hello, John Doe!"
	 *
	 * transaction(() => {
	 *  firstName.set('Jane')
	 *  throw new Error('oops')
	 * })
	 *
	 * // Does not log
	 * // firstName.value === 'John'
	 * ```
	 *
	 * A `rollback` callback is passed into the function.
	 * Calling this will prevent the transaction from committing and will revert any signals that were updated during the transaction to their state before the transaction began.
	 *
	 *  * @example
	 * ```ts
	 * const firstName = atom('John')
	 * const lastName = atom('Doe')
	 *
	 * react('greet', () => {
	 *   console.log(`Hello, ${firstName.value} ${lastName.value}!`)
	 * })
	 *
	 * // Logs "Hello, John Doe!"
	 *
	 * transaction((rollback) => {
	 *  firstName.set('Jane')
	 *  lastName.set('Smith')
	 *  rollback()
	 * })
	 *
	 * // Does not log
	 * // firstName.value === 'John'
	 * // lastName.value === 'Doe'
	 * ```
	 *
	 * @param fn The function to run in a transaction, called with a function to roll back the change.
	 * @public
	 */
	readonly transaction = this.ctx.transaction
	/**
	 * Like [transaction](#transaction), but does not create a new transaction if there is already one in progress.
	 *
	 * @param fn
	 * @public
	 */
	readonly transact = this.ctx.transact

	/**
	 * Executes the given function without capturing any parents in the current capture context.
	 *
	 * This is mainly useful if you want to run an effect only when certain signals change while also
	 * dereferencing other signals which should not cause the effect to rerun on their own.
	 *
	 * @example
	 * ```ts
	 * const name = atom('name', 'Sam')
	 * const time = atom('time', () => new Date().getTime())
	 *
	 * setInterval(() => {
	 *   time.set(new Date().getTime())
	 * })
	 *
	 * react('log name changes', () => {
	 * 	 console.log(name.value, 'was changed at', unsafe__withoutCapture(() => time.value))
	 * })
	 *
	 * ```
	 *
	 * @public
	 */
	readonly unsafe__withoutCapture = this.ctx.unsafe__withoutCapture
	/**
	 * A debugging tool that tells you why a computed signal or effect is running.
	 * Call in the body of a computed signal or effect function.
	 *
	 * @example
	 * ```ts
	 * const name = atom('name', 'Bob')
	 * react('greeting', () => {
	 * 	whyAmIRunning()
	 *	console.log('Hello', name.value)
	 * })
	 *
	 * name.set('Alice')
	 *
	 * // 'greeting' is running because:
	 * //     'name' changed => 'Alice'
	 * ```
	 *
	 * @public
	 */
	readonly whyAmIRunning = this.ctx.whyAmIRunning
	/**
	 * Returns the current global epoch, which is a number that increments each time an atom is updated.
	 * @returns
	 */
	readonly getGlobalEpoch = () => this.ctx.globalEpoch
	/**
	 * Creates a new [[Atom]].
	 *
	 * An Atom is a signal that can be updated directly by calling [[Atom.set]] or [[Atom.update]].
	 *
	 * @example
	 * ```ts
	 * const name = atom('name', 'John')
	 *
	 * name.value // 'John'
	 *
	 * name.set('Jane')
	 *
	 * name.value // 'Jane'
	 * ```
	 *
	 * @public
	 */
	atom = <Value, Diff = unknown>(
		/**
		 * A name for the signal. This is used for debugging and profiling purposes, it does not need to be unique.
		 */
		name: string,
		/**
		 * The initial value of the signal.
		 */
		initialValue: Value,
		/**
		 * The options to configure the atom. See [[AtomOptions]].
		 */
		options?: AtomOptions<Value, Diff>
	): Atom<Value, Diff> => {
		return new _Atom(this.ctx, name, initialValue, options)
	}

	computed: ComputedConstructor = ((...args: any[]) => {
		if (args.length === 1) {
			const options = args[0]
			return (target: any, key: string, descriptor: PropertyDescriptor) =>
				computedAnnotation(this.ctx, options, target, key, descriptor)
		} else if (typeof args[0] === 'string') {
			return new _Computed(this.ctx, args[0], args[1], args[2])
		} else {
			return computedAnnotation(this.ctx, undefined, args[0], args[1], args[2])
		}
	}) as ComputedConstructor

	/**
	 * Starts a new effect scheduler, scheduling the effect immediately.
	 *
	 * Returns a function that can be called to stop the scheduler.
	 *
	 * @example
	 * ```ts
	 * const color = atom('color', 'red')
	 * const stop = react('set style', () => {
	 *   divElem.style.color = color.value
	 * })
	 * color.set('blue')
	 * // divElem.style.color === 'blue'
	 * stop()
	 * color.set('green')
	 * // divElem.style.color === 'blue'
	 * ```
	 *
	 *
	 * Also useful in React applications for running effects outside of the render cycle.
	 *
	 * @example
	 * ```ts
	 * useEffect(() => react('set style', () => {
	 *   divRef.current.style.color = color.value
	 * }), [])
	 * ```
	 *
	 * @public
	 */
	runEffect = (
		name: string,
		fn: (lastReactedEpoch: number) => any,
		options?: EffectSchedulerOptions
	) => {
		const scheduler = new EffectScheduler(this.ctx, name, fn, options)
		scheduler.attach()
		scheduler.scheduleEffect()
		return () => {
			scheduler.detach()
		}
	}

	/**
	 * Creates a [[Reactor]], which is a thin wrapper around an [[EffectScheduler]].
	 *
	 * @public
	 */
	effect = <Result>(
		name: string,
		fn: (lastReactedEpoch: number) => Result,
		options?: EffectSchedulerOptions
	): Effect<Result> => {
		const scheduler = new EffectScheduler<Result>(this.ctx, name, fn, options)
		return {
			scheduler,
			start: (options?: { force?: boolean }) => {
				const force = options?.force ?? false
				scheduler.attach()
				if (force) {
					scheduler.scheduleEffect()
				} else {
					scheduler.maybeScheduleEffect()
				}
			},
			stop: () => {
				scheduler.detach()
			},
		}
	}

	effectScheduler = <Result>(
		name: string,
		fn: (lastReactedEpoch: number) => Result,
		options?: EffectSchedulerOptions
	): EffectScheduler<Result> => {
		return new EffectScheduler<Result>(this.ctx, name, fn, options)
	}

	/**
	 * Call this inside a computed signal function to determine whether it is the first time the function is being called.
	 *
	 * Mainly useful for incremental signal computation.
	 *
	 * @example
	 * ```ts
	 * const count = atom('count', 0)
	 * const double = computed('double', (prevValue) => {
	 *   if (isUninitialized(prevValue)) {
	 *     console.log('First time!')
	 *   }
	 *   return count.value * 2
	 * })
	 *
	 * @param value - The value to check.
	 * @public
	 */
	isUninitialized = (value: any): value is UNINITIALIZED => {
		return value === UNINITIALIZED
	}

	/**
	 * When writing incrementally-computed signals it is convenient (and usually more performant) to incrementally compute the diff too.
	 *
	 * You can use this function to wrap the return value of a computed signal function to indicate that the diff should be used instead of calculating a new one with [[AtomOptions.computeDiff]].
	 *
	 * @example
	 * ```ts
	 * const count = atom('count', 0)
	 * const double = computed('double', (prevValue) => {
	 *   const nextValue = count.value * 2
	 *   if (isUninitialized(prevValue)) {
	 *     return nextValue
	 *   }
	 *   return withDiff(nextValue, nextValue - prevValue)
	 * }, { historyLength: 10 })
	 * ```
	 *
	 *
	 * @param value - The value.
	 * @param diff - The diff.
	 * @public
	 */
	withDiff = <Value, Diff>(value: Value, diff: Diff): WithDiff<Value, Diff> => {
		return new WithDiff(value, diff)
	}

	/**
	 * Returns true if the given value is a signal (either an Atom or a Computed).
	 * @public
	 */
	isSignal = (value: any): value is Signal<any> => {
		return value instanceof _Atom || value instanceof _Computed
	}

	/**
	 * Returns true if the given value is an [[Atom]].
	 * @public
	 */
	isAtom = (value: unknown): value is Atom<unknown> => {
		return value instanceof _Atom
	}

	/**
	 * Returns true if the given value is a computed signal.
	 *
	 * @param value
	 * @returns {value is Computed<any>}
	 * @public
	 */
	isComputed = (value: any): value is Computed<any> => {
		return value && value instanceof _Computed
	}
}
