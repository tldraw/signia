/* eslint-disable prefer-rest-params */
import { Child, ComputedChild, ComputeDiff, RESET_VALUE, Signal } from './types'

import { maybeCaptureParent, startCapturingParents, stopCapturingParents } from './capture'

import { ArraySet } from './ArraySet'
import { GLOBAL_START_EPOCH } from './constants'
import { EMPTY_ARRAY, equals, haveParentsChanged } from './helpers'
import { HistoryBuffer } from './HistoryBuffer'
import { globalEpoch } from './transactions'

/** @public */
export const UNINITIALIZED = Symbol('UNINITIALIZED')
/** @public */
export type UNINITIALIZED = typeof UNINITIALIZED

/**
 * Get whether a value is uninitialized.
 *
 * @param value The value to check.
 */
export const isUninitialized = (value: any): value is typeof UNINITIALIZED => {
	return value === UNINITIALIZED
}

export class WithDiff<Value, Diff> {
	constructor(public value: Value, public diff: Diff) {}
}

/**
 * Create a WithDiff instance from a value and a diff.
 *
 * @param value The value.
 * @param diff The diff.
 * @public
 */
export function withDiff<Value, Diff>(value: Value, diff: Diff): WithDiff<Value, Diff> {
	return new WithDiff(value, diff)
}

/** @public */
export type ComputedOptions<Value, Diff> = {
	historyLength?: number
	computeDiff?: ComputeDiff<Value, Diff>
	isEqual?: (a: any, b: any) => boolean
}

/**
 * A computed value
 *
 * @public
 */
export interface Computed<Value, Diff = unknown> extends Signal<Value, Diff>, ComputedChild {}

export class _Computed<Value, Diff = unknown> implements Computed<Value, Diff> {
	/**
	 * The epoch when the reactor last changed.
	 *
	 * @public
	 */
	lastChangedEpoch = GLOBAL_START_EPOCH

	/**
	 * The epoch when the reactor was last traversed during a transaction.
	 *
	 * @internal
	 */
	lastTraversedEpoch = GLOBAL_START_EPOCH

	/**
	 * The epoch when the reactor was last checked.
	 *
	 * @private
	 */
	private lastCheckedEpoch = GLOBAL_START_EPOCH

	/**
	 * An array of parents to which this derivation has been attached.
	 *
	 * @internal
	 */
	parents: Signal<any, any>[] = []

	/**
	 * An array of epochs for each parent.
	 *
	 * @internal
	 */
	parentEpochs: number[] = []

	/**
	 * An array of children that have been attached to this derivation.
	 *
	 * @internal
	 */
	children = new ArraySet<Child>()

	/**
	 * Whether this derivation is actively listening. A derivation will be actively listening if its
	 * children is not empty.
	 *
	 * @public
	 */
	get isActivelyListening(): boolean {
		return !this.children.isEmpty
	}

	/**
	 * (optional) A buffer that stores a history of diffs for this derivation's value.
	 *
	 * @public
	 */
	historyBuffer?: HistoryBuffer<Diff>

	/**
	 * The state of the derivation. Stores the resulting value, if any, of an initialized derivation.
	 *
	 * @private
	 */
	private state: Value = UNINITIALIZED as unknown as Value

	/**
	 * A method to compute the diff between two values.
	 *
	 * @private
	 */
	private computeDiff?: ComputeDiff<Value, Diff>

	public readonly isEqual: null | ((a: any, b: any) => boolean)

	constructor(
		public readonly name: string,
		private readonly derive: (
			previousValue: Value | typeof UNINITIALIZED,
			lastComputedEpoch: number
		) => Value | WithDiff<Value, Diff>,
		options?: ComputedOptions<Value, Diff>
	) {
		if (options?.historyLength) {
			this.historyBuffer = new HistoryBuffer(options.historyLength)
		}
		this.computeDiff = options?.computeDiff
		this.isEqual = options?.isEqual ?? null
	}

	/**
	 * Get the derivation's value without capturing it. Other systems will not know that this was
	 * done.
	 *
	 * @returns The value of the atom.
	 * @public
	 */
	__unsafe__getWithoutCapture(): Value {
		const isNew = this.lastChangedEpoch === GLOBAL_START_EPOCH

		if (!isNew && (this.lastCheckedEpoch === globalEpoch || !haveParentsChanged(this))) {
			this.lastCheckedEpoch = globalEpoch
			return this.state
		}

		try {
			startCapturingParents(this)
			const result = this.derive(this.state, this.lastCheckedEpoch)
			const newState = result instanceof WithDiff ? result.value : result
			if (!(this.isEqual?.(newState, this.state) ?? equals(newState, this.state))) {
				if (this.historyBuffer && !isNew) {
					const diff = result instanceof WithDiff ? result.diff : undefined
					this.historyBuffer.pushEntry(
						this.lastChangedEpoch,
						globalEpoch,
						diff ??
							this.computeDiff?.(this.state, newState, this.lastCheckedEpoch, globalEpoch) ??
							RESET_VALUE
					)
				}
				this.lastChangedEpoch = globalEpoch
				this.state = newState
			}
			this.lastCheckedEpoch = globalEpoch

			return this.state
		} finally {
			stopCapturingParents()
		}
	}

	/**
	 * Get the value of the derivation and (maybe) capture its parent.
	 *
	 * @returns The value of the derivation.
	 * @public
	 */
	get value(): Value {
		const value = this.__unsafe__getWithoutCapture()
		maybeCaptureParent(this)
		return value
	}

	/**
	 * Get all diffs since the given epoch.
	 *
	 * @param epoch The epoch to get diffs since.
	 * @returns An array of diffs or a flag to reset the history buffer.
	 * @public
	 */
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

function computedAnnotation(
	options: ComputedOptions<any, any> = {},
	_target: any,
	key: string,
	descriptor: PropertyDescriptor
) {
	const originalMethod = descriptor.get
	const derivationKey = Symbol.for('__tlstate__computed__' + key)

	descriptor.get = function (this: any) {
		let d = this[derivationKey] as _Computed<any> | undefined

		if (!d) {
			d = new _Computed(key, originalMethod!.bind(this) as any, options)
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
) {
	// deref to make sure it exists first
	const key = Symbol.for('__tlstate__computed__' + propertyName.toString())
	let inst = obj[key as keyof typeof obj] as _Computed<Obj[Prop]> | undefined
	if (!inst) {
		// deref to make sure it exists first
		obj[propertyName]
		inst = obj[key as keyof typeof obj] as _Computed<Obj[Prop]> | undefined
	}
	return inst
}

/**
 * Creates a computed signal.
 * @param name - The name of the signal.
 * @param compute - The function that computes the value of the signal.
 * @param options - Options for the signal.
 */
export function computed<Value, Diff = unknown>(
	name: string,
	compute: (
		previousValue: Value | typeof UNINITIALIZED,
		lastComputedEpoch: number
	) => Value | WithDiff<Value, Diff>,
	options?: ComputedOptions<Value, Diff>
): Computed<Value, Diff>

/**
 * A decorator for creating computed class properties.
 *
 * @example
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom<number>(0)
 *
 *   ~@computed get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 * ```
 *
 * @param _target
 * @param key The name of the property.
 * @param descriptor The descriptor of the property.
 * @public
 */
export function computed(
	target: any,
	key: string,
	descriptor: PropertyDescriptor
): PropertyDescriptor
/** @public */
export function computed<Value, Diff = unknown>(
	options?: ComputedOptions<Value, Diff>
): (target: any, key: string, descriptor: PropertyDescriptor) => PropertyDescriptor
/** @public */
export function computed() {
	if (arguments.length === 1) {
		const options = arguments[0]
		return (target: any, key: string, descriptor: PropertyDescriptor) =>
			computedAnnotation(options, target, key, descriptor)
	} else if (typeof arguments[0] === 'string') {
		return new _Computed(arguments[0], arguments[1], arguments[2])
	} else {
		return computedAnnotation(undefined, arguments[0], arguments[1], arguments[2])
	}
}

/**
 * Returns true iff the given value is a computed signal.
 * @param value
 * @returns {value is Computed<any>}
 * @public
 */
export function isComputed(value: any): value is Computed<any> {
	return value && value instanceof _Computed
}
