/**
 * **tlstate** is a reactive signals library for TypeScript.
 *
 * We designed `tlstate` to scale well with data-intensive applications. There are a few special features that make this possible:
 *
 *  - **Incremental computed signals**
 *
 *    Reactive state libraries have a notion of 'computed' values which cannot be modified directly, and instead are automatically recomputed when their dependencies change.
 *    Most (if not all?) other such libraries do this recopmutation from scratch every time a dependency changes.
 *    This is fine for most situations, but it doesn't work well if the computed signal is expensive to compute and changes often, perhaps blocking UI updates.
 *
 *    tlstate gives you the option to compute new values incrementally. You typically do this by collecting 'diffs' of the changes to dependencies, and applying them to the previous value.
 *    It requires a little more work and care, but it typically will only need to happen in a handful of places for even the most compplex applications.
 *
 * - **Caching of 'unsubscribed' values**
 *
 *    Most reactive libraries will throw away the value of a signal when it is no longer being actively 'listened' to.
 *    This is generally done to avoid memory leaks caused by the fundamental nature of reactivity frameworks based on callbacks or 'dirty-flag-checking'.
 *    This can be problematic when a signal is expensive to compute and it is used outside of reactive subscriptions, e.g. when handling mouse move events.
 *    `tlstate` uses a reactivity system based on clocks rather than callbacks, which allows caching of signal values without causing memory leaks even if a signal is not part of an active subscription.
 *
 * - **Transactions with rollbacks**
 *
 *    Many reactive libraries allow you to make a batch of smaller changes while dereffing running effects until after the whole batch has completed.
 *    `tlstate` supports this while also allowing you to 'bail out' of the batch, resetting all signals to their initial state.
 *    This can be useful to avoid corrupting application state when encountering errors.
 *
 * @packageDocumentation
 */

export { atom, isAtom } from './Atom'
export type { Atom, AtomOptions } from './Atom'
export { whyAmIRunning } from './capture'
export { computed, getComputedInstance, UNINITIALIZED, withDiff } from './Computed'
export type { Computed, ComputedOptions } from './Computed'
export { EffectScheduler, react, reactor } from './EffectScheduler'
export { EMPTY_ARRAY } from './helpers'
export { isSignal } from './isSignal'
export { transact, transaction } from './transactions'
export { RESET_VALUE } from './types'
export type { Reactor, Signal } from './types'
