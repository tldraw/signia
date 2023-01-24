import { EffectScheduler } from './EffectScheduler'

export function react(name: string, fn: (lastReactedEpoch: number) => any) {
	const scheduler = new EffectScheduler(name, fn)
	scheduler.attach()
	scheduler.execute()
	return () => {
		scheduler.detach()
	}
}
