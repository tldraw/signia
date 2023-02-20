import { startCapturingParents, stopCapturingParents } from './capture'
import { GLOBAL_START_EPOCH } from './constants'
import { attach, detach, haveParentsChanged } from './helpers'
import { globalEpoch } from './transactions'
import { Parent, ReactingChild, Reactor } from './types'

/** @public */
export class EffectScheduler<Result> implements ReactingChild {
	isActivelyListening = false
	lastTraversedEpoch = GLOBAL_START_EPOCH
	lastReactedEpoch = GLOBAL_START_EPOCH
	scheduleCount = 0
	/**
	 * @private
	 */
	parentEpochs: number[] = []
	parents: Parent<any, any>[] = []

	constructor(
		public readonly name: string,
		private readonly runEffect: (lastReactedEpoch: number) => Result,
		private readonly scheduleEffect?: (execute: () => void) => void
	) {}

	maybeScheduleEffect() {
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

		this.scheduleCount++
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

	attach() {
		this.isActivelyListening = true
		for (let i = 0, n = this.parents.length; i < n; i++) {
			attach(this.parents[i], this)
		}
	}

	detach() {
		this.isActivelyListening = false
		for (let i = 0, n = this.parents.length; i < n; i++) {
			detach(this.parents[i], this)
		}
	}

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

/** @public */
export function react(name: string, fn: (lastReactedEpoch: number) => any) {
	const scheduler = new EffectScheduler(name, fn)
	scheduler.attach()
	scheduler.execute()
	return () => {
		scheduler.detach()
	}
}

/** @public */
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
