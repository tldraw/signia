import { ArraySet } from './ArraySet'
import { maybeCaptureParent } from './capture'
import { EMPTY_ARRAY } from './constants'
import { equals } from './helpers'
import { HistoryBuffer } from './HistoryBuffer'
import { advanceGlobalEpoch, atomDidChange, globalEpoch } from './transactions'
import { Child, ComputeDiff, Parent, RESET_VALUE } from './types'

export class Atom<Value, Diff = unknown> implements Parent<Value, Diff> {
	/**
	 * An atom is a container around a value. When dereferenced, it captures its
	 * parents. When set, it advances the global epoch. It can keep a history of
	 * diffs describing how its value has changed.
	 *
	 * @param name The name of the atom.
	 * @param current The initial value of the atom.
	 * @param options (optional) Options for the atom.
	 * @param options.historyLength (optional) The number of diffs to keep in the
	 *   history buffer.
	 * @param options.computeDiff (optional) A method used to compute a diff
	 *   between the atom's old and new values.
	 * @param options.useDeepComparisons (optional) Whether to use deep
	 *   comparisons when comparing values.
	 */
	constructor(
		public readonly name: string,
		private current: Value,
		options?: {
			historyLength?: number
			computeDiff?: ComputeDiff<Value, Diff>
			useDeepComparisons?: boolean
		}
	) {
		this.useDeepComparisons = options?.useDeepComparisons ?? false

		if (!options) return

		if (options.historyLength) {
			this.historyBuffer = new HistoryBuffer(options.historyLength)
		}

		this.computeDiff = options.computeDiff
	}

	readonly useDeepComparisons: boolean

	/**
	 * (optional) A method used to compute a diff between the atom's old and new
	 * values.
	 *
	 * @public
	 */
	computeDiff?: ComputeDiff<Value, Diff>

	/**
	 * The epoch when this atom was last changed.
	 *
	 * @public
	 */
	lastChangedEpoch = globalEpoch

	/**
	 * A collection containing the atom's children.
	 *
	 * @public
	 */
	children = new ArraySet<Child>()

	/**
	 * A buffer of diffs describing the accumulated history of this atom's value.
	 *
	 * @public
	 */
	historyBuffer?: HistoryBuffer<Diff>

	/**
	 * Get the atom's value without capturing it. Other systems will not know that
	 * this was done.
	 *
	 * @returns The value of the atom.
	 * @public
	 */
	__unsafe__getWithoutCapture(): Value {
		return this.current
	}

	/**
	 * Get the value of the atom and (maybe) capture its parent.
	 *
	 * @returns The value of the atom.
	 * @public
	 */
	get() {
		maybeCaptureParent(this)
		return this.current
	}

	/**
	 * Set the value of the atom.
	 *
	 * @param value The new value of the atom.
	 * @param diff (optional) The diff between the old value and the new value, if
	 *   known.
	 * @returns The new value of the atom.
	 */
	set(value: Value, diff?: Diff): Value {
		// If the value has not changed, do nothing.
		if (equals(value, this.current, this.useDeepComparisons)) {
			return this.current
		}

		// Tick forward the global epoch
		advanceGlobalEpoch()

		// Add the diff to the history buffer.
		if (this.historyBuffer) {
			this.historyBuffer.pushEntry(
				this.lastChangedEpoch,
				globalEpoch,
				diff ??
					this.computeDiff?.(
						this.current,
						value,
						this.lastChangedEpoch,
						globalEpoch
					) ??
					RESET_VALUE
			)
		}

		// Update the atom's record of the epoch when last changed.
		this.lastChangedEpoch = globalEpoch

		const oldValue = this.current
		this.current = value

		// Notify all children that this atom has changed.
		atomDidChange(this, oldValue)

		return value
	}

	/**
	 * Update the value of this atom.
	 *
	 * @param updater A function that takes the current value of the atom and
	 *   returns the new value.
	 * @returns The new value of the atom.
	 * @public
	 */
	update(updater: (value: Value) => Value): Value {
		return this.set(updater(this.current))
	}

	/**
	 * Get all diffs since the given epoch.
	 *
	 * @param epoch The epoch to get diffs since.
	 * @returns An array of diffs or a flag to reset the history buffer.
	 * @public
	 */
	diffSinceEpoch(epoch: number): RESET_VALUE | Diff[] {
		maybeCaptureParent(this)

		// If no changes have occurred since the given epoch, return an empty array.
		if (epoch >= this.lastChangedEpoch) {
			return EMPTY_ARRAY
		}

		return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
	}
}
