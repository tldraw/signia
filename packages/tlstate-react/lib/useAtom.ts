import { useMemo } from 'react'
import { atom, Atom, AtomOptions } from 'tlstate'

/** @public */
export function useAtom<Value, Diff = unknown>(
	name: string,
	valueOrInitialiser: Value | (() => Value),
	opts?: AtomOptions<Value, Diff>
): Atom<Value, Diff> {
	return useMemo(() => {
		const initialValue =
			typeof valueOrInitialiser === 'function' ? (valueOrInitialiser as any)() : valueOrInitialiser

		return atom(`useAtom(${name})`, initialValue, opts)
	}, [])
}
