/**
 * **signia** is a reactive signals library for TypeScript.
 *
 * See [the github repo](https://github.com/tldraw/signia) for more information.
 *
 * @packageDocumentation
 */

export { atom, isAtom } from './Atom'
export type { Atom, AtomOptions } from './Atom'
export { unsafe__withoutCapture, whyAmIRunning } from './capture'
export { computed, getComputedInstance, isUninitialized, withDiff } from './Computed'
export type { Computed, ComputedOptions } from './Computed'
export { EffectScheduler, react, reactor } from './EffectScheduler'
export type { Reactor } from './EffectScheduler'
export { EMPTY_ARRAY } from './helpers'
export { isSignal } from './isSignal'
export { transact, transaction } from './transactions'
export { RESET_VALUE } from './types'
export type { Signal } from './types'
