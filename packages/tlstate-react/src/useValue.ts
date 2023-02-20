/* eslint-disable prefer-rest-params */
import { useMemo, useSyncExternalStore } from 'react'
import { computed, react, Signal } from 'tlstate'

/** @public */
export function useValue<Value>(value: Signal<Value>): Value
/** @public */
export function useValue<Value>(name: string, fn: () => Value, deps: unknown[]): Value
/** @public */
export function useValue() {
	const args = arguments
	// deps will be either the computed or the deps array
	const deps = args.length === 3 ? args[2] : [args[0]]
	const name = args.length === 3 ? args[0] : `useValue(${args[0].name})`
	const $val = useMemo(() => {
		if (args.length === 1) {
			return args[0]
		}
		return computed(name, args[1])
	}, deps)

	const { subscribe, getSnapshot } = useMemo(() => {
		return {
			subscribe: (listen: () => void) => {
				return react(`useValue(${name})`, () => {
					$val.value
					listen()
				})
			},
			getSnapshot: () => $val.value,
		}
	}, [$val])

	return useSyncExternalStore(subscribe, getSnapshot)
}
