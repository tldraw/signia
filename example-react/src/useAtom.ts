import { Atom } from '../../src'
import { useState } from 'react'

export function useAtom<T>(value: T, name?: string): Atom<T, unknown> {
	return useState(() => new Atom(name ?? 'anonymous useDerivation', value))[0]
}
