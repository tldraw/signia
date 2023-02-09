import { ArraySet } from './ArraySet'
import { EffectScheduler } from './EffectScheduler'

/** @public */
export const RESET_VALUE: unique symbol = Symbol('RESET_VALUE')

/** @public */
export type RESET_VALUE = typeof RESET_VALUE

/** @public */
export interface ReactiveValue<Value, Diff = unknown> {
	name: string
	readonly value: Value
	getDiffSince(epoch: number): RESET_VALUE | Diff[]
	__unsafe__getWithoutCapture(): Value
}

export interface ComputedChild {
	parents: Parent<any, any>[]
	parentEpochs: number[]
	isActivelyListening: boolean
	lastTraversedEpoch: number
}
export interface ReactingChild extends ComputedChild {
	maybeScheduleEffect(): void
}

export type Child = ReactingChild | ComputedChild

export type ComputeDiff<Value, Diff> = (
	previousValue: Value,
	currentValue: Value,
	lastComputedEpoch: number,
	currentEpoch: number
) => Diff | RESET_VALUE

export interface Parent<Value, Diff = unknown> extends ReactiveValue<Value, Diff> {
	lastChangedEpoch: number
	children: ArraySet<Child>
}

/** @public */
export interface Reactor<T = unknown> {
	scheduler: EffectScheduler<T>
	start(): void
	stop(): void
}
