import { Derivation, react } from '@tldraw/tlstate-core'
import * as React from 'react'

const ARRAY = Object.freeze([]) as any

export function useDerivedValue<T>(
	fn: () => T,
	name = 'anonymous useDerivedValue',
	deps: any[] = ARRAY
): T {
	const { subscribe, getSnapshot } = React.useMemo(() => {
		const derivation = new Derivation(name, fn)
		return {
			subscribe: (listener: () => void) =>
				react('reactor: ' + name, () => {
					derivation.get()
					listener()
				}),
			getSnapshot: derivation.get,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps)

	const state = React.useSyncExternalStore(subscribe, getSnapshot)

	return state
}
