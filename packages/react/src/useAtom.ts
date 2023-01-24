import { Atom } from '@tldraw/tlstate-core'
import * as React from 'react'

export function useAtom<T>(value: T, name?: string): Atom<T, unknown> {
	return React.useState(() => new Atom(name ?? 'anonymous useDerivation', value))[0]
}
