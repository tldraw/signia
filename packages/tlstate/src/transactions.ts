import { _Atom } from './Atom'
import { GLOBAL_START_EPOCH } from './constants'
import { Child, ReactingChild, Signal } from './types'

// The current epoch (global to all atoms).
export let globalEpoch = GLOBAL_START_EPOCH + 1

// Whether any transaction is reacting.
let globalIsReacting = false

export function advanceGlobalEpoch() {
	globalEpoch++
}

class Transaction {
	constructor(public readonly parent: Transaction | null) {}
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
			flushChanges(atoms.keys())
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
		globalEpoch++

		// Reset each of the transaction's atoms to its initial value.
		this.initialAtomValues.forEach((value, atom) => {
			atom.set(value)
			atom.historyBuffer?.clear()
		})

		// Commit the changes.
		this.commit()
	}
}

/**
 * Collect all of the reactors that need to run for an atom and run them.
 *
 * @param atom The atom to flush changes for.
 */
function flushChanges(atoms: Iterable<_Atom<any>>) {
	if (globalIsReacting) {
		throw new Error('cannot change atoms during reaction cycle')
	}

	try {
		globalIsReacting = true

		// Collect all of the visited reactors.
		const reactors = new Set<ReactingChild>()

		// Visit each descendant of the atom, collecting reactors.
		const traverse = (node: Child) => {
			if (node.lastTraversedEpoch === globalEpoch) {
				return
			}

			node.lastTraversedEpoch = globalEpoch

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
		globalIsReacting = false
	}
}

/**
 * Handle a change to an atom.
 *
 * @param atom The atom that changed.
 * @param previousValue The atom's previous value.
 */
export function atomDidChange(atom: _Atom<any>, previousValue: any) {
	if (!currentTransaction) {
		flushChanges([atom])
	} else if (!currentTransaction.initialAtomValues.has(atom)) {
		currentTransaction.initialAtomValues.set(atom, previousValue)
	}
}

/**
 * The current transaction, if there is one.
 *
 * @global
 * @public
 */
export let currentTransaction = null as Transaction | null

/**
 * Run a function in a transaction. If the function throws, the transaction is aborted.
 *
 * @param fn The function to run in a transaction, called with a function to roll back the change.
 * @public
 */
export function transaction<T>(fn: (rollback: () => void) => T) {
	const txn = new Transaction(currentTransaction)

	// Set the current transaction to the transaction
	currentTransaction = txn

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
		currentTransaction = currentTransaction.parent
	}
}

/**
 * Runs a function inside the current transaction, or creates a new transaction if there is not
 * already one in progress
 *
 * @param fn
 * @public
 */
export function transact<T>(fn: () => T): T {
	if (currentTransaction) {
		return fn()
	}
	return transaction(fn)
}
