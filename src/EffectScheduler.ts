import { startCapturingParents, stopCapturingParents } from './capture'
import { GLOBAL_START_EPOCH } from './constants'
import { attach, detach, haveParentsChanged } from './helpers'
import { globalEpoch } from './transactions'
import { Parent, ReactingChild, Reactor } from './types'

export class EffectScheduler<Result> implements ReactingChild {
	/**
	 * Whether this effect is actively listening.
	 *
	 * @public
	 */
	isActivelyListening = false

	/**
	 * The last epoch at which this effect was traversed.
	 *
	 * @public
	 */
	lastTraversedEpoch = GLOBAL_START_EPOCH

	/**
	 * The last epoch at which this effect was run.
	 *
	 * @public
	 */
	lastReactedEpoch = GLOBAL_START_EPOCH

	/**
	 * The last epoch at which this effect was scheduled.
	 *
	 * @public
	 */
	lastScheduledEpoch = GLOBAL_START_EPOCH

	/**
	 * The epochs associated with each of this effect's parents.
	 *
	 * @public
	 */
	parentEpochs: number[] = []

	/** The parents of this effect. */
	parents: Parent<any, any>[] = []

	/**
	 * Create an effect scheduler.
	 *
	 * @param name The name of this effect.
	 * @param runEffect The function to run when this effect is triggered.
	 * @param scheduleEffect (optional) The deferred function to schedule for this
	 *   effect.
	 */
	constructor(
		public readonly name: string,
		private readonly runEffect: (lastReactedEpoch: number) => Result,
		private readonly scheduleEffect?: (execute: () => void) => void
	) {}

	/**
	 * Execute this effect (or mark this effect to be executed later as
	 * scheduled).
	 *
	 * @public
	 */
	maybeRunEffect() {
		// bail out if we have been cancelled by another effect
		if (!this.isActivelyListening) return
		// bail out if no atoms have changed since the last time we ran this effect
		if (this.lastReactedEpoch === globalEpoch) return

		// bail out if we have parents and they have not changed since last time
		if (this.parents.length && !haveParentsChanged(this)) {
			this.lastReactedEpoch = globalEpoch
			return
		}
		// if we don't have parents it's probably the first time this is running.

		// update lastScheduledEpoch so it can be used to
		this.lastScheduledEpoch = globalEpoch
		if (this.scheduleEffect) {
			// if the efect should be deferred (e.g. until a react render), do so
			this.scheduleEffect(() => {
				// bail out if we have been cancelled before this runs
				if (!this.isActivelyListening) return
				this.execute()
			})
		} else {
			// otherwise execute right now!
			this.execute()
		}
	}

	/**
	 * Attach this effect to all of its parents.
	 *
	 * @public
	 */
	attach() {
		this.isActivelyListening = true
		for (let i = 0, n = this.parents.length; i < n; i++) {
			attach(this.parents[i], this)
		}
	}

	/**
	 * Detach this effect from all of its parents.
	 *
	 * @public
	 */
	detach() {
		this.isActivelyListening = false
		for (let i = 0, n = this.parents.length; i < n; i++) {
			detach(this.parents[i], this)
		}
		this.parents.length = 0
		this.parentEpochs.length = 0
	}

	/**
	 * Execute this effect.
	 *
	 * @returns The result of the effect.
	 * @public
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
