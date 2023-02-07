import { ArraySet } from './ArraySet'
import { maybeCaptureParent } from './capture'
import { EMPTY_ARRAY, equals } from './helpers'
import { HistoryBuffer } from './HistoryBuffer'
import { advanceGlobalEpoch, atomDidChange, globalEpoch } from './transactions'
import { Child, ComputeDiff, Parent, RESET_VALUE } from './types'

/** @public */
export type AtomOptions<Value, Diff> = {
	historyLength?: number
	computeDiff?: ComputeDiff<Value, Diff>
	/**
	 * @private
	 */
	isEqual?: (a: any, b: any) => boolean
}

/**
 * An atom is a reactive pointer to any runtime value.
 * Updating an atom to point to a new value advances the global epoch.
 * It can keep a history of diffs describing how its value has changed.
 *
 * @public
 */
export interface Atom<Value, Diff = unknown> extends Parent<Value, Diff> {
	set(value: Value, diff?: Diff): Value
	update(updater: (value: Value) => Value): Value
}

export class _Atom<Value, Diff = unknown> implements Atom<Value, Diff> {
	constructor(
		public readonly name: string,
		private current: Value,
		options?: AtomOptions<Value, Diff>
	) {
		this.isEqual = options?.isEqual ?? null

		if (!options) return

		if (options.historyLength) {
			this.historyBuffer = new HistoryBuffer(options.historyLength)
		}

		this.computeDiff = options.computeDiff
	}

	readonly isEqual: null | ((a: any, b: any) => boolean)

	/**
	 * (optional) A method used to compute a diff between the atom's old and new values.
	 *
	 * @private
	 */
	computeDiff?: ComputeDiff<Value, Diff>

	/**
	 * The epoch when this atom was last changed.
	 *
	 * @private
	 */
	lastChangedEpoch = globalEpoch

	/**
	 * A collection containing the atom's children.
	 *
	 * @private
	 */
	children = new ArraySet<Child>()

	/**
	 * A buffer of diffs describing the accumulated history of this atom's value.
	 *
	 * @private
	 */
	historyBuffer?: HistoryBuffer<Diff>

	/**
	 * Get the atom's value without capturing it. Other systems will not know that this was done.
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
	get value() {
		maybeCaptureParent(this)
		return this.current
	}

	/**
	 * Set the value of the atom.
	 *
	 * @param value The new value of the atom.
	 * @param diff (optional) The diff between the old value and the new value, if known.
	 * @returns The new value of the atom.
	 */
	set(value: Value, diff?: Diff): Value {
		// If the value has not changed, do nothing.
		if (this.isEqual?.(this.current, value) ?? equals(this.current, value)) {
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
					this.computeDiff?.(this.current, value, this.lastChangedEpoch, globalEpoch) ??
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
	 * @param updater A function that takes the current value of the atom and returns the new value.
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
	getDiffSince(epoch: number): RESET_VALUE | Diff[] {
		maybeCaptureParent(this)

		// If no changes have occurred since the given epoch, return an empty array.
		if (epoch >= this.lastChangedEpoch) {
			return EMPTY_ARRAY
		}

		return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
	}
}

/** @public */
export function atom<Value, Diff = unknown>(
	name: string,
	initialValue: Value,
	options?: AtomOptions<Value, Diff>
): Atom<Value, Diff> {
	return new _Atom(name, initialValue, options)
}

/** @public */
export function isAtom(value: unknown): value is Atom<unknown> {
	return value instanceof _Atom
}
