import { ReactiveValue } from '.'
import { _Atom } from './Atom'
import { _Computed } from './Computed'

/** @public */
export function isReactiveValue(value: any): value is ReactiveValue<any> {
	return value instanceof _Atom || value instanceof _Computed
}
