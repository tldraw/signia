/**
 * **signia** is a reactive signals library for TypeScript.
 *
 * See [the github repo](https://github.com/tldraw/signia) for more information.
 *
 * @packageDocumentation
 */

export type { Atom, AtomOptions } from './Atom.js'
export type { Computed, ComputedOptions } from './Computed.js'
export type { Reactor } from './EffectScheduler.js'
export type { Signal } from './types.js'
export {
	signia as default,
	atom,
	isAtom,
	unsafe__withoutCapture,
	whyAmIRunning,
	computed,
	getComputedInstance,
	isUninitialized,
	withDiff,
	EffectScheduler,
	react,
	reactor,
	EMPTY_ARRAY,
	isSignal,
	transact,
	transaction,
	RESET_VALUE,
}

import { atom, isAtom } from './Atom.js'
import { unsafe__withoutCapture, whyAmIRunning } from './capture.js'
import { computed, getComputedInstance, isUninitialized, withDiff } from './Computed.js'
import { EffectScheduler, react, reactor } from './EffectScheduler.js'
import { EMPTY_ARRAY } from './helpers.js'
import { isSignal } from './isSignal.js'
import { transact, transaction } from './transactions.js'
import { RESET_VALUE } from './types.js'

/**
 * @public
 */
const signia: any = {
	atom,
	isAtom,

	unsafe__withoutCapture,
	whyAmIRunning,

	computed,
	getComputedInstance,
	isUninitialized,
	withDiff,

	EffectScheduler,
	react,
	reactor,

	EMPTY_ARRAY,

	isSignal,

	transact,
	transaction,

	RESET_VALUE,
}
