import { _Atom } from './Atom.js'
import { _Computed } from './Computed.js'
import { GLOBAL_START_EPOCH } from './constants.js'
import { EffectScheduler } from './EffectScheduler.js'
import { attach, detach } from './helpers.js'
import { Child, Signal } from './types.js'

let didLogWarning = false
function logMixWarning() {
	if (didLogWarning) {
		return
	}
	didLogWarning = true
	console.warn(
		'You are mixing atoms and computed signals from different Signia instances. This is not supported and may result in unexpected behavior.'
	)
}

class Txn {
	constructor(public readonly ctx: SigniaContext, public readonly parent: Txn | null) {}
	initialAtomValues = new Map<_Atom<any>, any>()

	/**
	 * Get whether this transaction is a root (no parents).
	 *
	 * @public
	 */
	get isRoot() {
		return this.parent === null
	}

	/**
	 * Commit the transaction's changes.
	 *
	 * @public
	 */
	commit() {
		if (this.isRoot) {
			// For root transactions, flush changes to each of the atom's initial values.
			const atoms = this.initialAtomValues
			this.initialAtomValues = new Map()
			this.ctx.flushChanges(atoms.keys())
		} else {
			// For transaction's with parents, add the transaction's initial values to the parent's.
			this.initialAtomValues.forEach((value, atom) => {
				if (!this.parent!.initialAtomValues.has(atom)) {
					this.parent!.initialAtomValues.set(atom, value)
				}
			})
		}
	}

	/**
	 * Abort the transaction.
	 *
	 * @public
	 */
	abort() {
		this.ctx.globalEpoch++

		// Reset each of the transaction's atoms to its initial value.
		this.initialAtomValues.forEach((value, atom) => {
			atom.set(value)
			atom.historyBuffer?.clear()
		})

		// Commit the changes.
		this.commit()
	}
}

class CaptureStackFrame {
	offset = 0
	numNewParents = 0

	maybeRemoved?: Signal<any>[]

	constructor(public readonly below: CaptureStackFrame | null, public readonly child: Child) {}
}

export class SigniaContext {
	private stack: CaptureStackFrame | null = null
	currentTransaction = null as Txn | null

	unsafe__withoutCapture = <T>(fn: () => T): T => {
		const oldStack = this.stack
		this.stack = null
		try {
			return fn()
		} finally {
			this.stack = oldStack
		}
	}

	startCapturingParents(child: Child) {
		this.stack = new CaptureStackFrame(this.stack, child)
	}

	stopCapturingParents() {
		const frame = this.stack!
		this.stack = frame.below

		const didParentsChange = frame.numNewParents > 0 || frame.offset !== frame.child.parents.length

		if (!didParentsChange) {
			return
		}

		for (let i = frame.offset; i < frame.child.parents.length; i++) {
			const p = frame.child.parents[i]
			const parentWasRemoved = frame.child.parents.indexOf(p) >= frame.offset
			if (parentWasRemoved) {
				detach(p, frame.child)
			}
		}

		frame.child.parents.length = frame.offset
		frame.child.parentEpochs.length = frame.offset

		if (this.stack?.maybeRemoved) {
			for (let i = 0; i < this.stack.maybeRemoved.length; i++) {
				const maybeRemovedParent = this.stack.maybeRemoved[i]
				if (frame.child.parents.indexOf(maybeRemovedParent) === -1) {
					detach(maybeRemovedParent, frame.child)
				}
			}
		}
	}

	// this must be called after the parent is up to date
	maybeCaptureParent(p: Signal<any, any>) {
		if ((p as _Atom<any> | _Computed<any>).ctx !== this) {
			logMixWarning()
			return
		}
		if (this.stack) {
			const idx = this.stack.child.parents.indexOf(p)
			// if the child didn't deref this parent last time it executed, then idx will be -1
			// if the child did deref this parent last time but in a different order relative to other parents, then idx will be greater than stack.offset
			// if the child did deref this parent last time in the same order, then idx will be the same as stack.offset
			// if the child did deref this parent already during this capture session then 0 <= idx < stack.offset

			if (idx < 0) {
				this.stack.numNewParents++
				if (this.stack.child.isActivelyListening) {
					attach(p, this.stack.child)
				}
			}

			if (idx < 0 || idx >= this.stack.offset) {
				if (idx !== this.stack.offset && idx > 0) {
					const maybeRemovedParent = this.stack.child.parents[this.stack.offset]

					if (!this.stack.maybeRemoved) {
						this.stack.maybeRemoved = [maybeRemovedParent]
					} else if (this.stack.maybeRemoved.indexOf(maybeRemovedParent) === -1) {
						this.stack.maybeRemoved.push(maybeRemovedParent)
					}
				}

				this.stack.child.parents[this.stack.offset] = p
				this.stack.child.parentEpochs[this.stack.offset] = p.lastChangedEpoch
				this.stack.offset++
			}
		}
	}

	whyAmIRunning = () => {
		const child = this.stack?.child
		if (!child) {
			throw new Error('whyAmIRunning() called outside of a reactive context')
		}

		const changedParents = []
		for (let i = 0; i < child.parents.length; i++) {
			const parent = child.parents[i]

			if (parent.lastChangedEpoch > child.parentEpochs[i]) {
				changedParents.push(parent)
			}
		}

		if (changedParents.length === 0) {
			// eslint-disable-next-line no-console
			console.log((child as any).name, 'is running but none of the parents changed')
		} else {
			// eslint-disable-next-line no-console
			console.log((child as any).name, 'is running because:')
			for (const changedParent of changedParents) {
				// eslint-disable-next-line no-console
				console.log(
					'\t',
					(changedParent as any).name,
					'changed =>',
					changedParent.__unsafe__getWithoutCapture()
				)
			}
		}
	}

	// The current epoch (global to all atoms).
	globalEpoch = GLOBAL_START_EPOCH + 1

	// Whether any transaction is reacting.
	private isReacting = false

	/**
	 * Collect all of the reactors that need to run for an atom and run them.
	 *
	 * @param atom The atom to flush changes for.
	 */
	flushChanges(atoms: Iterable<_Atom<any>>) {
		if (this.isReacting) {
			throw new Error('cannot change atoms during reaction cycle')
		}

		try {
			this.isReacting = true

			// Collect all of the visited reactors.
			const reactors = new Set<EffectScheduler<unknown>>()

			// Visit each descendant of the atom, collecting reactors.
			const traverse = (node: Child) => {
				if (node.lastTraversedEpoch === this.globalEpoch) {
					return
				}

				node.lastTraversedEpoch = this.globalEpoch

				if ('maybeScheduleEffect' in node) {
					reactors.add(node)
				} else {
					;(node as any as Signal<any>).children.visit(traverse)
				}
			}

			for (const atom of atoms) {
				atom.children.visit(traverse)
			}

			// Run each reactor.
			for (const r of reactors) {
				r.maybeScheduleEffect()
			}
		} finally {
			this.isReacting = false
		}
	}

	/**
	 * Handle a change to an atom.
	 *
	 * @param atom The atom that changed.
	 * @param previousValue The atom's previous value.
	 *
	 * @internal
	 */
	atomDidChange(atom: _Atom<any>, previousValue: any) {
		if (!this.currentTransaction) {
			this.flushChanges([atom])
		} else if (!this.currentTransaction.initialAtomValues.has(atom)) {
			this.currentTransaction.initialAtomValues.set(atom, previousValue)
		}
	}

	transaction = <T>(fn: (rollback: () => void) => T) => {
		const txn = new Txn(this, this.currentTransaction)

		// Set the current transaction to the transaction
		this.currentTransaction = txn

		try {
			let rollback = false

			// Run the function.
			const result = fn(() => (rollback = true))

			if (rollback) {
				// If the rollback was triggered, abort the transaction.
				txn.abort()
			} else {
				// Otherwise, commit the transaction.
				txn.commit()
			}

			return result
		} catch (e) {
			// Abort the transaction if the function throws.
			txn.abort()
			throw e
		} finally {
			// Set the current transaction to the transaction's parent.
			this.currentTransaction = this.currentTransaction.parent
		}
	}

	transact = <T>(fn: () => T): T => {
		if (this.currentTransaction) {
			return fn()
		}
		return this.transaction(fn)
	}
}
