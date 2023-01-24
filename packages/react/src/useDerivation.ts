import { Derivation } from '@tldraw/tlstate-core'
import * as React from 'react'

export function useDerivation<T>(fn: () => T, name?: string): Derivation<T, unknown> {
	return React.useState(() => new Derivation(name ?? 'anonymous useDerivation', fn))[0]
}
