import {
	Child,
	ComputeDiff,
	Derivable,
	DerivingChild,
	Parent,
	RESET_VALUE,
} from './types'

import {
	maybeCaptureParent,
	startCapturingParents,
	stopCapturingParents,
} from './capture'

import { ArraySet } from './ArraySet'
import { EMPTY_ARRAY, GLOBAL_START_EPOCH } from './constants'
import { equals, haveParentsChanged } from './helpers'
import { HistoryBuffer } from './HistoryBuffer'
import { globalEpoch } from './transactions'

export const UNINITIALIZED = Symbol('UNINITIALIZED')

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
export function withDiff<Value, Diff>(
	value: Value,
	diff: Diff
): WithDiff<Value, Diff> {
	return new WithDiff(value, diff)
}

export class Derivation<Value, Diff = unknown>
	implements DerivingChild, Parent<Value, Diff>
{
	/**
	 * The epoch when the reactor last changed.
	 *
	 * @public
	 */
	lastChangedEpoch = GLOBAL_START_EPOCH

	/**
	 * The epoch when the reactor was last traversed during a transaction.
	 *
	 * @public
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
	 * @public
	 */
	parents: Parent<any, any>[] = []

	/**
	 * An array of epochs for each parent.
	 *
	 * @private
	 */
	parentEpochs: number[] = []

	/**
	 * An array of children that have been attached to this derivation.
	 *
	 * @public
	 */
	children = new ArraySet<Child>()

	/**
	 * Whether this derivation is actively listening. A derivation will be
	 * actively listening if its children is not empty.
	 *
	 * @public
	 */
	get isActivelyListening(): boolean {
		return !this.children.isEmpty
	}

	/**
	 * (optional) A buffer that stores a history of diffs for this derivation's
	 * value.
	 *
	 * @public
	 */
	historyBuffer?: HistoryBuffer<Diff>

	/**
	 * The state of the derivation. Stores the resulting value, if any, of an
	 * initialized derivation.
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

	public readonly isPush
	public readonly useDeepComparisons

	/**
	 * A derivation is a value that is derived from another atom or derivation.
	 *
	 * @param name The name of the derivation.
	 * @param derive A method that returns the derivation's value.
	 * @param options (optional) Options for the derivation.
	 * @param options.historyLength (optional) The number of diffs to keep in the
	 *   derivation's history.
	 * @param options.computeDiff (optional) A method used to compute a diff
	 *   between the derivation's old and new values.
	 * @returns A derivation.
	 */
	constructor(
		public readonly name: string,
		private readonly derive: (
			previousValue: Value | typeof UNINITIALIZED,
			lastComputedEpoch: number
		) => Value | WithDiff<Value, Diff>,
		options?: {
			historyLength?: number
			computeDiff?: ComputeDiff<Value, Diff>
			isPush?: boolean
			useDeepComparisons?: boolean
		}
	) {
		if (options?.historyLength) {
			this.historyBuffer = new HistoryBuffer(options.historyLength)
		}
		this.computeDiff = options?.computeDiff
		this.isPush = options?.isPush ?? false
		this.useDeepComparisons = options?.useDeepComparisons ?? false
	}

	/**
	 * Get the derivation's value without capturing it. Other systems will not
	 * know that this was done.
	 *
	 * @returns The value of the atom.
	 * @public
	 */
	__unsafe__getWithoutCapture(): Value {
		const isNew = this.lastChangedEpoch === GLOBAL_START_EPOCH

		if (
			!isNew &&
			(this.lastCheckedEpoch === globalEpoch || !haveParentsChanged(this))
		) {
			this.lastCheckedEpoch = globalEpoch
			return this.state
		}

		try {
			startCapturingParents(this)
			const result = this.derive(this.state, this.lastCheckedEpoch)
			const newState = result instanceof WithDiff ? result.value : result
			if (!equals(newState, this.state, this.useDeepComparisons)) {
				if (this.historyBuffer && !isNew) {
					const diff = result instanceof WithDiff ? result.diff : undefined
					this.historyBuffer.pushEntry(
						this.lastChangedEpoch,
						globalEpoch,
						diff ??
							this.computeDiff?.(
								this.state,
								newState,
								this.lastCheckedEpoch,
								globalEpoch
							) ??
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
	get = (): Value => {
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
	diffSinceEpoch(epoch: number): RESET_VALUE | Diff[] {
		// need to call .get() to ensure both that this derivation is up to date
		// and that tracking happens correctly
		this.get()

		if (epoch >= this.lastChangedEpoch) {
			return EMPTY_ARRAY
		}

		return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
	}
}

/**
 * Build an incremental derivation.
 *
 * @param name The name of the derivation.
 * @param deps The dependencies of the derivation.
 * @param deps.diffDependnecies (optional) The dependencies that are used to
 *   compute diffs.
 * @param deps.valueDependencies (optional) The dependencies that are used to
 *   compute the value.
 */
export function buildIncrementalDerivation<
	DiffDependencies extends Record<string, Derivable<any, any>>,
	ValueDependencies extends Record<string, (() => any) | Derivable<any>>
>(
	name: string,
	deps: {
		diffDependencies: DiffDependencies
		valueDependencies?: ValueDependencies
	},
	opts?: { historyLength?: number; isPush?: boolean }
) {
	function next<HelperState>() {
		return {
			deriveFreshValue<Value>(
				derive: (
					...vals: ValueArgs<DiffDependencies, ValueDependencies>
				) => Value | { value: Value; helperState: HelperState }
			) {
				return {
					deriveIncrementalValue<Diff>(
						inrementalDerive: (
							...args: DiffArgs<
								Value,
								DiffDependencies,
								ValueDependencies,
								HelperState
							>
						) => OmitNever<{
							value: Value
							diff: Diff
							helperState: HelperState
						}>
					) {
						let helperState: HelperState

						const reset = () => {
							const fresh = derive(
								Object.fromEntries(
									Object.entries(deps.diffDependencies).map(([k, v]) => [
										k,
										v.get(),
									])
								) as any,
								Object.fromEntries(
									Object.entries(deps.valueDependencies ?? {}).map(([k, v]) => [
										k,
										typeof v === 'function' ? v() : v.get(),
									])
								) as any
							)
							let value
							if (
								fresh &&
								typeof fresh === 'object' &&
								'helperState' in fresh
							) {
								helperState = fresh.helperState
								value = fresh.value
							} else {
								value = fresh
							}
							return value
						}

						return new Derivation<Value, Diff>(
							name,
							(previousValue, lastComputedEpoch) => {
								if (isUninitialized(previousValue)) {
									return reset()
								}

								const diffs = {} as any

								for (const [k, v] of Object.entries(deps.diffDependencies)) {
									const diff = v.diffSinceEpoch(lastComputedEpoch)
									if (diff !== RESET_VALUE) {
										diffs[k] = { diff, value: v.get() }
									} else {
										return reset()
									}
								}

								const vals = Object.fromEntries(
									Object.entries(deps.valueDependencies ?? {}).map(([k, v]) => [
										k,
										typeof v === 'function' ? v() : v.get(),
									])
								)

								try {
									const {
										value,
										diff,
										helperState: newHelperState,
									} = inrementalDerive(
										previousValue as any,
										diffs as any,
										vals as any,
										helperState as any
									) as any

									helperState = newHelperState

									return withDiff(value, diff)
								} catch (e) {
									if (e === RESET_VALUE) {
										return reset()
									}
									throw e
								}
							},
							opts
						)
					},
				}
			},
		}
	}

	return {
		withHelperStateType: <HelperState>() => next<HelperState>(),
		withoutHelperState: () => next<never>(),
	}
}

type OmitNever<T extends object, K extends keyof T = keyof T> = Pick<
	T,
	K extends K ? (T[K] extends never ? never : K) : never
>

type ValueArgs<
	DiffDependencies extends Record<string, Derivable<any, any>>,
	ValueDependencies extends Record<string, (() => any) | Derivable<any>>
> = [
	diffDependencyValues: {
		[k in keyof DiffDependencies]: ReturnType<DiffDependencies[k]['get']>
	},
	valueDependencyValues: {
		[k in keyof ValueDependencies]: ValueDependencies[k] extends () => any
			? ReturnType<ValueDependencies[k]>
			: ValueDependencies[k] extends Derivable<any>
			? ReturnType<ValueDependencies[k]['get']>
			: never
	}
]

type DiffArgs<
	Value,
	DiffDependencies extends Record<string, Derivable<any, any>>,
	ValueDependencies extends Record<string, (() => any) | Derivable<any>>,
	HelperState
> = [
	previousValue: Value,
	diffDeps: {
		[k in keyof DiffDependencies]: {
			value: ReturnType<DiffDependencies[k]['get']>
			diff: ExtractDiff<DiffDependencies[k]>[]
		}
	},
	valueDeps: {
		[k in keyof ValueDependencies]: ValueDependencies[k] extends () => any
			? ReturnType<ValueDependencies[k]>
			: ValueDependencies[k] extends Derivable<any>
			? ReturnType<ValueDependencies[k]['get']>
			: never
	},
	helperState: HelperState
]

type ExtractDiff<D extends Derivable<any, any>> = D extends Derivable<
	any,
	infer Diff
>
	? Diff
	: never

/**
 * A decorator for a derivations.
 *
 * ## Example
 *
 * ```ts
 * class Counter {
 *   max = 100
 *   count = new Atom<number>(0)
 *
 *   ~@derivation get remaining() {
 *     return this.max - this.count.get()
 *   }
 * }
 * ```
 *
 * @param _target
 * @param key The name of the property.
 * @param descriptor The descriptor of the property.
 */
export function derivation(
	_target: any,
	key: string,
	descriptor: PropertyDescriptor
) {
	const originalMethod = descriptor.get
	const derivationKey = Symbol('$$' + key)

	descriptor.get = function (this: any) {
		let d = this[derivationKey] as Derivation<any> | undefined

		if (!d) {
			d = this[derivationKey] = new Derivation(
				key,
				originalMethod!.bind(this) as any
			)
		}
		return d.get()
	}

	return descriptor
}
