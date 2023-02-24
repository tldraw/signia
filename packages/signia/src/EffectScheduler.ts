import { startCapturingParents, stopCapturingParents } from './capture'
import { GLOBAL_START_EPOCH } from './constants'
import { attach, detach, haveParentsChanged } from './helpers'
import { globalEpoch } from './transactions'
import { Reactor, Signal } from './types'

/**
 * An EffectScheduler is responsible for executing side effects in response to changes in state.
 *
 * You probably don't need to use this directly unless you're integrating signia with a framework of some kind.
 *
 * Instead, use the [[react]] and [[reactor]] functions.
 *
 * @example
 * ```ts
 * const render = new EffectScheduler('render', drawToCanvas, requestAnimationFrame)
 *
 * render.attach()
 * render.execute()
 * ```
 *
 * @public
 */
export class EffectScheduler<Result> {
	private _isActivelyListening = false
	/**
	 * Whether this scheduler is attached and actively listening to its parents.
	 * @public
	 */
	get isActivelyListening() {
		return this._isActivelyListening
	}
	/** @internal */
	lastTraversedEpoch = GLOBAL_START_EPOCH

	private lastReactedEpoch = GLOBAL_START_EPOCH
	private _scheduleCount = 0

	/**
	 * The number of times this effect has been scheduled.
	 * @public
	 */
	get scheduleCount() {
		return this._scheduleCount
	}

	/** @internal */
	parentEpochs: number[] = []
	/** @internal */
	parents: Signal<any, any>[] = []

	constructor(
		public readonly name: string,
		private readonly runEffect: (lastReactedEpoch: number) => Result,
		private readonly scheduleEffect?: (execute: () => void) => void
	) {}

	/** @internal */
	maybeScheduleEffect() {
		// bail out if we have been cancelled by another effect
		if (!this._isActivelyListening) return
		// bail out if no atoms have changed since the last time we ran this effect
		if (this.lastReactedEpoch === globalEpoch) return

		// bail out if we have parents and they have not changed since last time
		if (this.parents.length && !haveParentsChanged(this)) {
			this.lastReactedEpoch = globalEpoch
			return
		}
		// if we don't have parents it's probably the first time this is running.

		this._scheduleCount++
		if (this.scheduleEffect) {
			// if the efect should be deferred (e.g. until a react render), do so
			this.scheduleEffect(this.maybeExecute)
		} else {
			// otherwise execute right now!
			this.execute()
		}
	}

	private maybeExecute = () => {
		// bail out if we have been detached before this runs
		if (!this._isActivelyListening) return
		this.execute()
	}

	/**
	 * Makes this scheduler become 'actively listening' to its parents.
	 * If it has been executed before it will immediately become eligible to receive 'maybeScheduleEffect' calls.
	 * If it has not executed beofre it will need to be manually executed once to become eligible for scheduling, i.e. by calling [[EffectScheduler.execute]].
	 * @public
	 */
	attach() {
		this._isActivelyListening = true
		for (let i = 0, n = this.parents.length; i < n; i++) {
			attach(this.parents[i], this)
		}
	}

	/**
	 * Makes this scheduler stop 'actively listening' to its parents.
	 * It will no longer be eligible to receive 'maybeScheduleEffect' calls until [[EffectScheduler.attach]] is called again.
	 */
	detach() {
		this._isActivelyListening = false
		for (let i = 0, n = this.parents.length; i < n; i++) {
			detach(this.parents[i], this)
		}
	}

	/**
	 * Executes the effect immediately and returns the result.
	 * @returns The result of the effect.
	 */
	execute(): Result {
		try {
			startCapturingParents(this)
			const result = this.runEffect(this.lastReactedEpoch)
			this.lastReactedEpoch = globalEpoch
			return result
		} finally {
			stopCapturingParents()
		}
	}
}

/**
 * Starts a new effect scheduler, executing the effect immediately.
 *
 * Returns a function that can be called to stop the scheduler.
 *
 * @example
 * ```ts
 * const color = atom('color', 'red')
 * const stop = react('set style', () => {
 *   divElem.style.color = color.value
 * })
 * color.set('blue')
 * // divElem.style.color === 'blue'
 * stop()
 * color.set('green')
 * // divElem.style.color === 'blue'
 * ```
 *
 *
 * Also useful in React applications for running effects outside of the render cycle.
 *
 * @example
 * ```ts
 * useEffect(() => react('set style', () => {
 *   divRef.current.style.color = color.value
 * }), [])
 * ```
 *
 * @public
 */
export function react(name: string, fn: (lastReactedEpoch: number) => any) {
	const scheduler = new EffectScheduler(name, fn)
	scheduler.attach()
	scheduler.execute()
	return () => {
		scheduler.detach()
	}
}

/**
 * Creates a [[Reactor]] wrapper for an [[EffectScheduler]].
 *
 * This is a user-friendly API for creating a scheduler that can be started and stopped.
 * @public
 */
export function reactor(
	name: string,
	fn: (lastReactedEpoch: number) => any,
	effectScheduler?: (cb: () => any) => void
): Reactor {
	const scheduler = new EffectScheduler(name, fn, effectScheduler)
	return {
		scheduler,
		start: () => {
			scheduler.attach()
			scheduler.execute()
		},
		stop: () => {
			scheduler.detach()
		},
	}
}
