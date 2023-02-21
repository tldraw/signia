import { ArraySet } from './ArraySet'
import { EffectScheduler } from './EffectScheduler'

/** @public */
export const RESET_VALUE: unique symbol = Symbol('RESET_VALUE')

/** @public */
export type RESET_VALUE = typeof RESET_VALUE

/**
 * A Signal is a reactive value container. The value may change over time, and it may keep track of the diffs between sequential values.
 *
 * There are two types of signal:
 *
 * - Atomic signals, created using [[atom]]. These are mutable references to values that can be changed using [[Atom.set]].
 * - Computed signals, created using [[computed]]. These are values that are computed from other signals. They are recomputed lazily if their dependencies change.
 *
 * @public
 */
export interface Signal<Value, Diff = unknown> {
	/**
	 * The name of the signal. This is used at runtime for debugging and perf profiling only. It does not need to be globally unique.
	 */
	name: string
	/**
	 * The current value of the signal. This is a reactive value, and will update when the signal changes.
	 * Any computed signal that depends on this signal will be lazily recomputed if this signal changes.
	 * Any effect that depends on this signal will be rescheduled if this signal changes.
	 */
	readonly value: Value
	/**
	 * The epoch when this signal's value last changed. Note tha this is not the same as when the value was last computed.
	 * A signal may recopmute it's value without changing it.
	 */
	lastChangedEpoch: number
	/**
	 * Returns the sequence of diffs between the the value at the given epoch and the current value.
	 * Returns the [[RESET_VALUE]] constant if there is not enough information to compute the diff sequence.
	 * @param epoch
	 */
	getDiffSince(epoch: number): RESET_VALUE | Diff[]
	/**
	 * Returns the current value of the signal without capturing it as a dependency.
	 * Use this if you need to retrieve the signal's value in a hot loop where the performance overhead of dependency tracking is too high.
	 */
	__unsafe__getWithoutCapture(): Value
	/** @internal */
	children: ArraySet<Child>
}

/** @public */
export interface ComputedChild {
	/**
	 * Any signals this computed child dereferenced the last time it was computed.
	 * @internal
	 */
	parents: Signal<any, any>[]
	/**
	 * The matching epochs of the parents array when this child was last computed.
	 * @internal
	 */
	parentEpochs: number[]
	/**
	 * Whether this computed child is involved in an actively-running effect graph.
	 * @public
	 */
	isActivelyListening: boolean
	/**
	 * The epoch when this child was last traversed during the 'commit' phase of a transation (or calling [[Atom.set]] outside of a transaction).
	 * @internal
	 */
	lastTraversedEpoch: number
}

/**
 * A child that can run effects if necessary.
 * @public
 */
export interface ReactingChild extends ComputedChild {
	/**
	 * This should check whether the child needs to run any effects, and schedule them if necessary.
	 */
	maybeScheduleEffect(): void
}

/** @internal */
export type Child = ReactingChild | ComputedChild

/**
 * Computes the diff between the previous and current value.
 *
 * If the diff cannot be computed for whatever reason, it should return [[RESET_VALUE]].
 *
 * @public
 */
export type ComputeDiff<Value, Diff> = (
	previousValue: Value,
	currentValue: Value,
	lastComputedEpoch: number,
	currentEpoch: number
) => Diff | RESET_VALUE

/**
 * The reactor is a simple interface for starting and stopping an [[EffectScheduler]].
 *
 * You can create a reactor with [[reactor]].
 * @public
 */
export interface Reactor<T = unknown> {
	/**
	 * The underlying effect scheduler.
	 * @public
	 */
	scheduler: EffectScheduler<T>
	/**
	 * Start the scheduler.
	 * @public
	 */
	start(): void
	/**
	 * Stop the scheduler.
	 * @public
	 */
	stop(): void
}
