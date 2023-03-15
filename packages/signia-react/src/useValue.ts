/* eslint-disable prefer-rest-params */
import { useMemo, useSyncExternalStore } from 'react'
import { computed, react, Signal } from 'signia'

/**
 * Extracts the value from a signal and subscribes to it.
 *
 * Note that you do not need to use this hook if you are doing one of the following:
 *   - Wrapping the component with [[track]],
 * 	 - Installing the jsx integration with [[signia-react-jsx.install]]
 *
 * @example
 * ```ts
 * const Counter: React.FC = () => {
 *   const $count = useAtom('count', 0)
 *   const increment = useCallback(() => $count.set($count.value + 1), [count])
 *   const currentCount = useValue($count)
 *   return <button onClick={increment}>{currentCount}</button>
 * }
 * ```
 *
 * You can also pass a function to compute the value and it will be memoized as in [[useComputed]]:
 *
 * @example
 * ```ts
 * type GreeterProps = {
 *   firstName: Signal<string>
 *   lastName: Signal<string>
 * }
 *
 * const Greeter = track(function Greeter({ firstName, lastName }: GreeterProps) {
 *   const fullName = useValue('fullName', () => `${firstName.value} ${lastName.value}`, [
 *     firstName,
 *     lastName,
 *   ])
 *   return <div>Hello {fullName}!</div>
 * })
 * ```
 *
 * @public
 */
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

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
