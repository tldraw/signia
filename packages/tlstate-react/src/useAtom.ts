import { atom, Atom, AtomOptions } from 'tlstate'
import { useMemo } from 'react'

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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
}
