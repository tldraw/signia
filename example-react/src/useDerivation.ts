import { Derivation } from '../../src'
import { useState } from 'react'

export function useDerivation<T>(fn: () => T, name?: string): Derivation<T, unknown> {
	return useState(() => new Derivation(name ?? 'anonymous useDerivation', fn))[0]
}
