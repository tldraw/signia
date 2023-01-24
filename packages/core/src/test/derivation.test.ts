import { Atom } from '../Atom'
import { Derivation, isUninitialized } from '../Derivation'
import { reactor } from '../reactor'
import { assertNever } from '../helpers'
import {
	advanceGlobalEpoch,
	globalEpoch,
	transact,
	transaction,
} from '../transactions'
import { Derivable, RESET_VALUE } from '../types'

function getLastCheckedEpoch(derivation: Derivation<any>): number {
	return (derivation as any).lastCheckedEpoch
}

describe('derivations', () => {
	it('will cache a value forever if it has no parents', () => {
		const derive = jest.fn(() => 1)
		const startEpoch = globalEpoch
		const derivation = new Derivation('', derive)

		expect(derive).toHaveBeenCalledTimes(0)

		expect(derivation.get()).toBe(1)
		expect(derivation.get()).toBe(1)
		expect(derivation.get()).toBe(1)

		expect(derive).toHaveBeenCalledTimes(1)

		advanceGlobalEpoch()
		advanceGlobalEpoch()
		advanceGlobalEpoch()
		advanceGlobalEpoch()

		expect(derivation.get()).toBe(1)
		expect(derivation.get()).toBe(1)
		expect(derivation.get()).toBe(1)
		advanceGlobalEpoch()
		advanceGlobalEpoch()
		expect(derivation.get()).toBe(1)
		expect(derivation.get()).toBe(1)

		expect(derive).toHaveBeenCalledTimes(1)

		expect(derivation.parents.length).toBe(0)

		expect(derivation.lastChangedEpoch).toBe(startEpoch)
	})

	it('will update when parent atoms update', () => {
		const atom = new Atom('', 1)
		const double = jest.fn(() => atom.get() * 2)
		const derivation = new Derivation('', double)
		const startEpoch = globalEpoch
		expect(double).toHaveBeenCalledTimes(0)

		expect(derivation.get()).toBe(2)
		expect(double).toHaveBeenCalledTimes(1)

		expect(derivation.lastChangedEpoch).toBe(startEpoch)

		expect(derivation.get()).toBe(2)
		expect(derivation.get()).toBe(2)
		expect(double).toHaveBeenCalledTimes(1)
		expect(derivation.lastChangedEpoch).toBe(startEpoch)

		atom.set(2)
		const nextEpoch = globalEpoch
		expect(nextEpoch > startEpoch).toBe(true)

		expect(double).toHaveBeenCalledTimes(1)
		expect(derivation.lastChangedEpoch).toBe(startEpoch)
		expect(derivation.get()).toBe(4)

		expect(double).toHaveBeenCalledTimes(2)
		expect(derivation.lastChangedEpoch).toBe(nextEpoch)

		expect(derivation.get()).toBe(4)
		expect(double).toHaveBeenCalledTimes(2)
		expect(derivation.lastChangedEpoch).toBe(nextEpoch)

		// creating an unrelated atom and setting it will have no effect
		const unrelatedAtom = new Atom('', 1)
		unrelatedAtom.set(2)
		unrelatedAtom.set(3)
		unrelatedAtom.set(5)

		expect(derivation.get()).toBe(4)
		expect(double).toHaveBeenCalledTimes(2)
		expect(derivation.lastChangedEpoch).toBe(nextEpoch)
	})

	it('supports history', () => {
		const startEpoch = globalEpoch
		const atom = new Atom('', 1)

		const derivation = new Derivation('', () => atom.get() * 2, {
			historyLength: 3,
			computeDiff: (a, b) => {
				return b - a
			},
		})

		derivation.get()

		expect(derivation.diffSinceEpoch(startEpoch)).toHaveLength(0)

		atom.set(2)

		expect(derivation.diffSinceEpoch(startEpoch)).toEqual([+2])

		atom.set(3)

		expect(derivation.diffSinceEpoch(startEpoch)).toEqual([+2, +2])

		atom.set(5)

		expect(derivation.diffSinceEpoch(startEpoch)).toEqual([+2, +2, +4])

		atom.set(6)
		// should fail now because we don't have enough hisstory
		expect(derivation.diffSinceEpoch(startEpoch)).toEqual(RESET_VALUE)
	})

	it('doesnt update history if it doesnt change', () => {
		const startEpoch = globalEpoch
		const atom = new Atom('', 1)

		const floor = jest.fn((n: number) => Math.floor(n))
		const derivation = new Derivation('', () => floor(atom.get()), {
			historyLength: 3,
			computeDiff: (a, b) => {
				return b - a
			},
		})

		expect(derivation.get()).toBe(1)
		expect(derivation.diffSinceEpoch(startEpoch)).toHaveLength(0)

		atom.set(1.2)

		expect(derivation.get()).toBe(1)
		expect(derivation.diffSinceEpoch(startEpoch)).toHaveLength(0)
		expect(floor).toHaveBeenCalledTimes(2)

		atom.set(1.5)

		expect(derivation.get()).toBe(1)
		expect(derivation.diffSinceEpoch(startEpoch)).toHaveLength(0)
		expect(floor).toHaveBeenCalledTimes(3)

		atom.set(1.9)

		expect(derivation.get()).toBe(1)
		expect(derivation.diffSinceEpoch(startEpoch)).toHaveLength(0)
		expect(floor).toHaveBeenCalledTimes(4)

		atom.set(2.3)

		expect(derivation.get()).toBe(2)
		expect(derivation.diffSinceEpoch(startEpoch)).toEqual([+1])
		expect(floor).toHaveBeenCalledTimes(5)
	})

	it('updates the lastCheckedEpoch whenever the globalEpoch advances', () => {
		const startEpoch = globalEpoch
		const atom = new Atom('', 1)

		const double = jest.fn(() => atom.get() * 2)
		const derivation = new Derivation('', double)

		derivation.get()

		expect(getLastCheckedEpoch(derivation)).toEqual(startEpoch)

		advanceGlobalEpoch()
		derivation.get()

		expect(getLastCheckedEpoch(derivation)).toBeGreaterThan(startEpoch)

		expect(double).toHaveBeenCalledTimes(1)
	})

	it('receives UNINTIALIZED as the previousValue the first time it computes', () => {
		const atom = new Atom('', 1)
		const double = jest.fn((_prevValue) => atom.get() * 2)
		const derivation = new Derivation('', double)

		expect(derivation.get()).toBe(2)

		expect(isUninitialized(double.mock.calls[0][0])).toBe(true)

		atom.set(2)

		expect(derivation.get()).toBe(4)
		expect(isUninitialized(double.mock.calls[1][0])).toBe(false)
		expect(double.mock.calls[1][0]).toBe(2)
	})

	it('receives the lastChangedEpoch as the second parameter each time it recomputes', () => {
		const atom = new Atom('', 1)
		const double = jest.fn((_prevValue, lastChangedEpoch) => {
			expect(lastChangedEpoch).toBe(derivation.lastChangedEpoch)
			return atom.get() * 2
		})
		const derivation = new Derivation('', double)

		expect(derivation.get()).toBe(2)

		const startEpoch = globalEpoch

		atom.set(2)

		expect(derivation.get()).toBe(4)
		expect(derivation.lastChangedEpoch).toBeGreaterThan(startEpoch)

		expect(double).toHaveBeenCalledTimes(2)
		expect.assertions(6)
	})

	it('can be reacted to', () => {
		const firstName = new Atom('', 'John')
		const lastName = new Atom('', 'Doe')

		let numTimesComputed = 0
		const fullName = new Derivation('', () => {
			numTimesComputed++
			return `${firstName.get()} ${lastName.get()}`
		})

		let numTimesReacted = 0
		let name = ''
		const r = reactor('', () => {
			name = fullName.get()
			numTimesReacted++
		})

		expect(numTimesReacted).toBe(0)
		expect(name).toBe('')

		r.start()

		expect(numTimesReacted).toBe(1)
		expect(numTimesComputed).toBe(1)
		expect(name).toBe('John Doe')

		firstName.set('Jane')

		expect(numTimesComputed).toBe(2)
		expect(numTimesReacted).toBe(2)
		expect(name).toBe('Jane Doe')

		firstName.set('Jane')
		firstName.set('Jane')
		firstName.set('Jane')

		expect(numTimesComputed).toBe(2)
		expect(numTimesReacted).toBe(2)
		expect(name).toBe('Jane Doe')

		transact(() => {
			firstName.set('Wilbur')
			expect(numTimesComputed).toBe(2)
			expect(numTimesReacted).toBe(2)
			expect(name).toBe('Jane Doe')
			lastName.set('Jones')
			expect(numTimesComputed).toBe(2)
			expect(numTimesReacted).toBe(2)
			expect(name).toBe('Jane Doe')
			expect(fullName.get()).toBe('Wilbur Jones')

			expect(numTimesComputed).toBe(3)
			expect(numTimesReacted).toBe(2)
			expect(name).toBe('Jane Doe')
		})

		expect(numTimesComputed).toBe(3)
		expect(numTimesReacted).toBe(3)
		expect(name).toBe('Wilbur Jones')
	})

	it('will roll back to their initial value if a transaciton is aborted', () => {
		const firstName = new Atom('', 'John')
		const lastName = new Atom('', 'Doe')

		const fullName = new Derivation(
			'',
			() => `${firstName.get()} ${lastName.get()}`
		)

		transaction((rollback) => {
			firstName.set('Jane')
			lastName.set('Jones')
			expect(fullName.get()).toBe('Jane Jones')
			rollback()
		})

		expect(fullName.get()).toBe('John Doe')
	})

	it('will add history items if a transaction is aborted', () => {
		const a = new Atom('', 1)
		const b = new Atom('', 1)

		const c = new Derivation('', () => a.get() + b.get(), {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		const startEpoch = globalEpoch

		transaction((rollback) => {
			expect(c.diffSinceEpoch(startEpoch)).toEqual([])
			a.set(2)
			b.set(2)
			expect(c.diffSinceEpoch(startEpoch)).toEqual([+2])
			rollback()
		})

		expect(c.diffSinceEpoch(startEpoch)).toEqual([2, -2])
	})

	it('will return RESET_VALUE if .diffSinceEpoch is called with an epoch before initialization', () => {
		const a = new Atom('', 1)
		const b = new Atom('', 1)

		const c = new Derivation('', () => a.get() + b.get(), {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		expect(c.diffSinceEpoch(globalEpoch - 1)).toEqual(RESET_VALUE)
	})
})

type Difference =
	| {
			type: 'CHANGE'
			path: string[]
			value: any
			oldValue: any
	  }
	| { type: 'CREATE'; path: string[]; value: any }
	| { type: 'REMOVE'; path: string[]; oldValue: any }

function getIncrementalRecordMapper<In, Out>(
	obj: Derivable<Record<string, In>, Difference[]>,
	mapper: (t: In, k: string) => Out
): Derivation<Record<string, Out>> {
	function computeFromScratch() {
		const input = obj.get()
		return Object.fromEntries(
			Object.entries(input).map(([k, v]) => [k, mapper(v, k)])
		)
	}
	return new Derivation('', (previousValue, lastComputedEpoch) => {
		if (isUninitialized(previousValue)) {
			return computeFromScratch()
		}
		const diff = obj.diffSinceEpoch(lastComputedEpoch)
		if (diff === RESET_VALUE) {
			return computeFromScratch()
		}
		if (diff.length === 0) {
			return previousValue
		}

		const newUpstream = obj.get()

		const result = { ...previousValue } as Record<string, Out>

		const changedKeys = new Set<string>()
		for (const change of diff.flat()) {
			const key = change.path[0] as string
			if (changedKeys.has(key)) {
				continue
			}
			switch (change.type) {
				case 'CHANGE':
				case 'CREATE':
					changedKeys.add(key)
					if (key in newUpstream) {
						result[key] = mapper(newUpstream[key], change.path[0] as string)
					} else {
						// key was removed later in this patch
					}
					break
				case 'REMOVE':
					if (key in result) {
						delete result[key]
					}
					break
				default:
					assertNever(change)
			}
		}

		return result
	})
}

describe('incremental derivations', () => {
	it('should be possible', () => {
		type NumberMap = Record<string, number>

		const nodes = new Atom<NumberMap, Difference[]>(
			'',
			{
				a: 1,
				b: 2,
				c: 3,
				d: 4,
				e: 5,
			},
			{
				historyLength: 10,
				computeDiff: (valA, valB) => {
					const result: Difference[] = []
					for (const keyA in valA) {
						if (!(keyA in valB)) {
							result.push({
								type: 'REMOVE',
								oldValue: valA[keyA],
								path: [keyA],
							})
						} else if (valA[keyA] != valB[keyA]) {
							result.push({
								type: 'CHANGE',
								oldValue: valA[keyA],
								path: [keyA],
								value: valB[keyA],
							})
						}
					}

					for (const keyB in valB) {
						if (!(keyB in valA)) {
							result.push({
								type: 'CREATE',
								value: valB[keyB],
								path: [keyB],
							})
						}
					}
					return result
				},
			}
		)

		const mapper = jest.fn((val) => val * 2)

		const doubledNodes = getIncrementalRecordMapper(nodes, mapper)

		expect(doubledNodes.get()).toEqual({
			a: 2,
			b: 4,
			c: 6,
			d: 8,
			e: 10,
		})
		expect(mapper).toHaveBeenCalledTimes(5)

		nodes.update((ns) => ({ ...ns, a: 10 }))

		expect(doubledNodes.get()).toEqual({
			a: 20,
			b: 4,
			c: 6,
			d: 8,
			e: 10,
		})

		expect(mapper).toHaveBeenCalledTimes(6)

		// remove d
		nodes.update(({ d: _d, ...others }) => others)

		expect(doubledNodes.get()).toEqual({
			a: 20,
			b: 4,
			c: 6,
			e: 10,
		})
		expect(mapper).toHaveBeenCalledTimes(6)

		nodes.update((ns) => ({ ...ns, f: 50, g: 60 }))

		expect(doubledNodes.get()).toEqual({
			a: 20,
			b: 4,
			c: 6,
			e: 10,
			f: 100,
			g: 120,
		})
		expect(mapper).toHaveBeenCalledTimes(8)

		nodes.set({ ...nodes.get() })
		// no changes so no new calls to mapper
		expect(doubledNodes.get()).toEqual({
			a: 20,
			b: 4,
			c: 6,
			e: 10,
			f: 100,
			g: 120,
		})
		expect(mapper).toHaveBeenCalledTimes(8)

		// make several changes

		nodes.update((ns) => ({ ...ns, a: 1 }))
		nodes.update((ns) => ({ ...ns, b: 9 }))
		nodes.update((ns) => ({ ...ns, c: 17 }))
		nodes.update(({ f: _f, g: _g, ...others }) => ({ ...others }))
		nodes.update((ns) => ({ ...ns, d: 4 }))
		nodes.update((ns) => ({ ...ns, a: 4 }))

		// nothing was called because we didn't deref yet
		expect(mapper).toHaveBeenCalledTimes(8)

		expect(doubledNodes.get()).toEqual({
			a: 8,
			b: 18,
			c: 34,
			d: 8,
			e: 10,
		})

		expect(mapper).toHaveBeenCalledTimes(12)
	})
})

// describe('push derivations', () => {
// 	it('should prevent children from being traversed if they have not changed', () => {
// 		const num = new Atom('num', 0)

// 		const isEven_push = new Derivation('isEven', () => num.get() % 2 == 0, { isPush: true })
// 		const isEven_pull = new Derivation('isEven', () => num.get() % 2 == 0)

// 		let numPushReactions = 0
// 		const reactor_push = reactor('', () => {
// 			numPushReactions++
// 			isEven_push.get()
// 		})
// 		reactor_push.start()

// 		const pushSpy = jest.spyOn(reactor_push.scheduler, 'maybeRunEffect')

// 		let numPullReactions = 0
// 		const reactor_pull = reactor('', () => {
// 			numPullReactions++
// 			isEven_pull.get()
// 		})

// 		reactor_pull.start()

// 		const pullSpy = jest.spyOn(reactor_pull.scheduler, 'maybeRunEffect')

// 		expect(numPullReactions).toBe(1)
// 		expect(numPushReactions).toBe(1)
// 		expect(pushSpy).toHaveBeenCalledTimes(0)
// 		expect(pullSpy).toHaveBeenCalledTimes(0)

// 		num.set(1)

// 		expect(numPullReactions).toBe(2)
// 		expect(numPushReactions).toBe(2)
// 		expect(pushSpy).toHaveBeenCalledTimes(1)
// 		expect(pullSpy).toHaveBeenCalledTimes(1)

// 		num.set(3)

// 		expect(numPullReactions).toBe(2)
// 		expect(numPushReactions).toBe(2)
// 		expect(pushSpy).toHaveBeenCalledTimes(1)
// 		expect(pullSpy).toHaveBeenCalledTimes(2)

// 		num.set(5)

// 		expect(numPullReactions).toBe(2)
// 		expect(numPushReactions).toBe(2)
// 		expect(pushSpy).toHaveBeenCalledTimes(1)
// 		expect(pullSpy).toHaveBeenCalledTimes(3)
// 	})
// })
