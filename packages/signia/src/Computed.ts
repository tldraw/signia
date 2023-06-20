/* eslint-disable prefer-rest-params */
import { Child, ComputeDiff, RESET_VALUE, Signal } from './types.js'

import { ArraySet } from './ArraySet.js'
import { GLOBAL_START_EPOCH } from './constants.js'
import { EMPTY_ARRAY, equals, haveParentsChanged } from './helpers.js'
import { HistoryBuffer } from './HistoryBuffer.js'
import { SigniaContext } from './SigniaContext.js'

export const UNINITIALIZED = Symbol('UNINITIALIZED')
/**
 * The type of the first value passed to a computed signal function as the 'prevValue' parameter.
 *
 * @see [[isUninitialized]].
 * @public
 */
export type UNINITIALIZED = typeof UNINITIALIZED

export class WithDiff<Value, Diff> {
	constructor(public value: Value, public diff: Diff) {}
}

/**
 * Options for creating computed signals. Used when calling [[computed]].
 * @public
 */
export interface ComputedOptions<Value, Diff> {
	/**
	 * The maximum number of diffs to keep in the history buffer.
	 *
	 * If you don't need to compute diffs, or if you will supply diffs manually via [[Atom.set]], you can leave this as `undefined` and no history buffer will be created.
	 *
	 * If you expect the value to be part of an active effect subscription all the time, and to not change multiple times inside of a single transaction, you can set this to a relatively low number (e.g. 10).
	 *
	 * Otherwise, set this to a higher number based on your usage pattern and memory constraints.
	 *
	 */
	historyLength?: number
	/**
	 * A method used to compute a diff between the atom's old and new values. If provided, it will not be used unless you also specify [[AtomOptions.historyLength]].
	 */
	computeDiff?: ComputeDiff<Value, Diff>
	/**
	 * If provided, this will be used to compare the old and new values of the atom to determine if the value has changed.
	 * By default, values are compared using first using strict equality (`===`), then `Object.is`, and finally any `.equals` method present in the object's prototype chain.
	 * @param a
	 * @param b
	 * @returns
	 */
	isEqual?: (a: any, b: any) => boolean
}

/**
 * A computed signal created via [[computed]].
 *
 * @public
 */
export interface Computed<Value, Diff = unknown> extends Signal<Value, Diff> {
	/**
	 * Whether this computed child is involved in an actively-running effect graph.
	 * @public
	 */
	readonly isActivelyListening: boolean

	/** @internal */
	readonly parents: Signal<any, any>[]
	/** @internal */
	readonly parentEpochs: number[]
}

/**
 * @internal
 */
export class _Computed<Value, Diff = unknown> implements Computed<Value, Diff> {
	lastChangedEpoch = GLOBAL_START_EPOCH
	lastTraversedEpoch = GLOBAL_START_EPOCH

	/**
	 * The epoch when the reactor was last checked.
	 */
	private lastCheckedEpoch = GLOBAL_START_EPOCH

	parents: Signal<any, any>[] = []
	parentEpochs: number[] = []

	children = new ArraySet<Child>()

	get isActivelyListening(): boolean {
		return !this.children.isEmpty
	}

	historyBuffer?: HistoryBuffer<Diff>

	// The last-computed value of this signal.
	private state: Value = UNINITIALIZED as unknown as Value

	private computeDiff?: ComputeDiff<Value, Diff>

	private readonly isEqual: (a: any, b: any) => boolean

	constructor(
		public readonly ctx: SigniaContext,
		/**
		 * The name of the signal. This is used for debugging and performance profiling purposes. It does not need to be globally unique.
		 */
		public readonly name: string,
		/**
		 * The function that computes the value of the signal.
		 */
		private readonly derive: (
			previousValue: Value | UNINITIALIZED,
			lastComputedEpoch: number
		) => Value | WithDiff<Value, Diff>,
		options?: ComputedOptions<Value, Diff>
	) {
		if (options?.historyLength) {
			this.historyBuffer = new HistoryBuffer(options.historyLength)
		}
		this.computeDiff = options?.computeDiff
		this.isEqual = options?.isEqual ?? equals
	}

	__unsafe__getWithoutCapture(): Value {
		const isNew = this.lastChangedEpoch === GLOBAL_START_EPOCH

		if (!isNew && (this.lastCheckedEpoch === this.ctx.globalEpoch || !haveParentsChanged(this))) {
			this.lastCheckedEpoch = this.ctx.globalEpoch
			return this.state
		}

		try {
			this.ctx.startCapturingParents(this)
			const result = this.derive(this.state, this.lastCheckedEpoch)
			const newState = result instanceof WithDiff ? result.value : result
			if (this.state === UNINITIALIZED || !this.isEqual(newState, this.state)) {
				if (this.historyBuffer && !isNew) {
					const diff = result instanceof WithDiff ? result.diff : undefined
					this.historyBuffer.pushEntry(
						this.lastChangedEpoch,
						this.ctx.globalEpoch,
						diff ??
							this.computeDiff?.(
								this.state,
								newState,
								this.lastCheckedEpoch,
								this.ctx.globalEpoch
							) ??
							RESET_VALUE
					)
				}
				this.lastChangedEpoch = this.ctx.globalEpoch
				this.state = newState
			}
			this.lastCheckedEpoch = this.ctx.globalEpoch

			return this.state
		} finally {
			this.ctx.stopCapturingParents()
		}
	}

	get value(): Value {
		const value = this.__unsafe__getWithoutCapture()
		this.ctx.maybeCaptureParent(this)
		return value
	}

	getDiffSince(epoch: number): RESET_VALUE | Diff[] {
		// need to call .value to ensure both that this derivation is up to date
		// and that tracking happens correctly
		this.value

		if (epoch >= this.lastChangedEpoch) {
			return EMPTY_ARRAY
		}

		return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
	}
}

export function computedAnnotation(
	ctx: SigniaContext,
	options: ComputedOptions<any, any> = {},
	_target: any,
	key: string,
	descriptor: PropertyDescriptor
) {
	const originalMethod = descriptor.get
	const derivationKey = Symbol.for('__signia__computed__' + key)

	descriptor.get = function (this: any) {
		let d = this[derivationKey] as _Computed<any> | undefined

		if (!d) {
			d = new _Computed(ctx, key, originalMethod!.bind(this) as any, options)
			Object.defineProperty(this, derivationKey, {
				enumerable: false,
				configurable: false,
				writable: false,
				value: d,
			})
		}
		return d.value
	}

	return descriptor
}

/**
 * Retrieves the underlying computed instance for a given property created with the [[computed]]
 * decorator.
 *
 * @example
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom(0)
 *
 *   @computed get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 *
 * const c = new Counter()
 * const remaining = getComputedInstance(c, 'remaining')
 * remaining.value === 100 // true
 * c.count.set(13)
 * remaining.value === 87 // true
 * ```
 *
 * @param obj
 * @param propertyName
 * @public
 */
export function getComputedInstance<Obj extends object, Prop extends keyof Obj>(
	obj: Obj,
	propertyName: Prop
): Computed<Obj[Prop]> {
	// deref to make sure it exists first
	const key = Symbol.for('__signia__computed__' + propertyName.toString())
	let inst = obj[key as keyof typeof obj] as _Computed<Obj[Prop]> | undefined
	if (!inst) {
		// deref to make sure it exists first
		obj[propertyName]
		inst = obj[key as keyof typeof obj] as _Computed<Obj[Prop]> | undefined
	}
	return inst as any
}

/**
 * Creates a computed signal.
 *
 * @example
 * ```ts
 * const name = atom('name', 'John')
 * const greeting = computed('greeting', () => `Hello ${name.value}!`)
 * console.log(greeting.value) // 'Hello John!'
 * ```
 *
 * `computed` may also be used as a decorator for creating computed class properties.
 *
 * @example
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom<number>(0)
 *
 *   @computed get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 * ```
 *
 * You may optionally pass in a [[ComputedOptions]] when used as a decorator:
 *
 * @example
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom<number>(0)
 *
 *   @computed({isEqual: (a, b) => a === b})
 *   get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 * ```
 *
 * @param name - The name of the signal.
 * @param compute - The function that computes the value of the signal.
 * @param options - Options for the signal.
 *
 * @public
 */
export interface ComputedConstructor {
	<Value, Diff = unknown>(
		name: string,
		compute: (
			previousValue: Value | typeof UNINITIALIZED,
			lastComputedEpoch: number
		) => Value | WithDiff<Value, Diff>,
		options?: ComputedOptions<Value, Diff>
	): Computed<Value, Diff>

	(target: any, key: string, descriptor: PropertyDescriptor): PropertyDescriptor
	<Value, Diff = unknown>(options?: ComputedOptions<Value, Diff>): (
		target: any,
		key: string,
		descriptor: PropertyDescriptor
	) => PropertyDescriptor
}

