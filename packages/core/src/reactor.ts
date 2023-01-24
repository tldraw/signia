import { EffectScheduler } from './EffectScheduler'
import { Reactor } from './types'

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
