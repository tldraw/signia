import { ArraySet } from './ArraySet'
import { EffectScheduler } from './EffectScheduler'

/** @public */
export const RESET_VALUE: unique symbol = Symbol('RESET_VALUE')

/** @public */
export type RESET_VALUE = typeof RESET_VALUE

/**
 * A Signal is a reactive value container. The value may change over time.
 *
 * There are two types of signal: atomic signals and computed signals, created using [[atom]] and [[computed]] respectively.
 *
 * @public
 *
 */
export interface Signal<Value, Diff = unknown> {
	name: string
	readonly value: Value
	lastChangedEpoch: number
	getDiffSince(epoch: number): RESET_VALUE | Diff[]
	__unsafe__getWithoutCapture(): Value
	/** @internal */
	children: ArraySet<Child>
}

/** @public */
export interface ComputedChild {
	/** @internal */
	parents: Signal<any, any>[]
	/** @internal */
	parentEpochs: number[]
	/** @public */
	isActivelyListening: boolean
	/** @internal */
	lastTraversedEpoch: number
}

/** @internal */
export interface ReactingChild extends ComputedChild {
	maybeScheduleEffect(): void
}

/** @internal */
export type Child = ReactingChild | ComputedChild

/** @public */
export type ComputeDiff<Value, Diff> = (
	previousValue: Value,
	currentValue: Value,
	lastComputedEpoch: number,
	currentEpoch: number
) => Diff | RESET_VALUE

/** @public */
export interface Reactor<T = unknown> {
	scheduler: EffectScheduler<T>
	start(): void
	stop(): void
}
