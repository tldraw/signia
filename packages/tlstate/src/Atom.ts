import { ArraySet } from './ArraySet'
import { maybeCaptureParent } from './capture'
import { EMPTY_ARRAY, equals } from './helpers'
import { HistoryBuffer } from './HistoryBuffer'
import { advanceGlobalEpoch, atomDidChange, globalEpoch } from './transactions'
import { Child, ComputeDiff, RESET_VALUE, Signal } from './types'

/**
 * The options to configure an atom, passed into the [[atom]] function.
 * @public
 */
export interface AtomOptions<Value, Diff> {
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
 * An atom is a signal that can be updated directly by calling [[Atom.set]] or [[Atom.update]].
 *
 * Atoms are created using the [[atom]] function.
 *
 *
 * @example
 * ```ts
 * cosnt name = atom('name', 'John')
 *
 * console.log(name.value) // 'John'
 * ```
 *
 * @public
 */
export interface Atom<Value, Diff = unknown> extends Signal<Value, Diff> {
	/**
	 * Sets the value of this atom to the given value. If the value is the same as the current value, this is a no-op.
	 *
	 * @param value - The new value to set.
	 * @param diff - The diff to use for the update. If not provided, the diff will be computed using [[AtomOptions.computeDiff]].
	 */
	set(value: Value, diff?: Diff): Value
	/**
	 * Updates the value of this atom using the given updater function. If the returned value is the same as the current value, this is a no-op.
	 *
	 * @param updater - A function that takes the current value and returns the new value.
	 */
	update(updater: (value: Value) => Value): Value
}

/**
 * @internal
 */
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
