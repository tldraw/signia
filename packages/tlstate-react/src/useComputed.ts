/* eslint-disable prefer-rest-params */
import { useMemo } from 'react'
import { Computed, computed, ComputedOptions } from 'tlstate'

/** @public */
export function useComputed<Value>(name: string, compute: () => Value, deps: any[]): Computed<Value>
/** @public */
export function useComputed<Value, Diff = unknown>(
	name: string,
	compute: () => Value,
	opts: ComputedOptions<Value, Diff>,
	deps: any[]
): Computed<Value>
/** @public */
export function useComputed() {
	const name = arguments[0]
	const compute = arguments[1]
	const opts = arguments.length === 3 ? undefined : arguments[2]
	const deps = arguments.length === 3 ? arguments[2] : arguments[3]
	return useMemo(() => computed(`useComputed(${name})`, compute, opts), deps)
}
