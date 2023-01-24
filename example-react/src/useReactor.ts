import { useEffect, useMemo } from 'react'
import { EffectScheduler, EMPTY_ARRAY } from '../../src'

export function useReactor(reactFn: () => void, name?: string, deps?: any[]) {
	const scheduler = useMemo(
		() =>
			new EffectScheduler(name || 'anonymous useReactor', reactFn, (cb) =>
				requestAnimationFrame(cb)
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		deps ?? EMPTY_ARRAY
	)

	useEffect(() => {
		scheduler.attach()
		scheduler.execute()
		return () => scheduler.detach()

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scheduler])
}
