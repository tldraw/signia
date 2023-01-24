import { ArraySet } from './ArraySet'
import { EffectScheduler } from './EffectScheduler'

// A value that is used to indicate that a value has been reset
export const RESET_VALUE: unique symbol = Symbol('RESET_VALUE')

export type RESET_VALUE = typeof RESET_VALUE

export interface Derivable<Value, Diff = unknown> {
	get(): Value
	diffSinceEpoch(epoch: number): RESET_VALUE | Diff[]
	__unsafe__getWithoutCapture(): Value
}

export interface DerivingChild {
	parents: Parent<any, any>[]
	parentEpochs: number[]
	isActivelyListening: boolean
	lastTraversedEpoch: number
}

export interface ReactingChild extends DerivingChild {
	maybeRunEffect(): void
}

export type Child = ReactingChild | DerivingChild

export type ComputeDiff<Value, Diff> = (
	previousValue: Value,
	currentValue: Value,
	lastComputedEpoch: number,
	currentEpoch: number
) => Diff | RESET_VALUE

export interface Parent<Value, Diff = unknown> extends Derivable<Value, Diff> {
	lastChangedEpoch: number
	children: ArraySet<Child>
	name: string
}

export interface Reactor<T = unknown> {
	scheduler: EffectScheduler<T>
	start(): void
	stop(): void
}
