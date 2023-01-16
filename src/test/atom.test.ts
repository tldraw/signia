import { Atom } from '../Atom'
import { reactor } from '../reactor'
import { globalEpoch, transact, transaction } from '../transactions'
import { RESET_VALUE } from '../types'

describe('atoms', () => {
	it('contain data', () => {
		const atom = new Atom('', 1)

		expect(atom.get()).toBe(1)
	})
	it('can be updated', () => {
		const atom = new Atom('', 1)

		atom.set(2)

		expect(atom.get()).toBe(2)
	})
	it('will not advance the global epoch on creation', () => {
		const startEpoch = globalEpoch
		new Atom('', 3)
		expect(globalEpoch).toBe(startEpoch)
	})
	it('will advance the global epoch on .set', () => {
		const startEpoch = globalEpoch
		const atom = new Atom('', 3)
		atom.set(4)
		expect(globalEpoch).toBe(startEpoch + 1)
	})
	it('can store history', () => {
		const atom = new Atom('', 1, {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		const startEpoch = globalEpoch

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([])

		atom.set(5)

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])

		atom.set(10)

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +5])

		atom.set(20)

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +5, +10])

		atom.set(30)

		// will be RESET_VALUE because we don't have enough history
		expect(atom.diffSinceEpoch(startEpoch)).toEqual(RESET_VALUE)
	})
	it('has history independent of other atoms', () => {
		const atomA = new Atom('', 1, {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})
		const atomB = new Atom('', 1, {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		const startEpoch = globalEpoch

		atomB.set(-5)
		atomB.set(-10)
		atomB.set(-20)
		expect(atomB.diffSinceEpoch(startEpoch)).toEqual([-6, -5, -10])
		expect(atomB.diffSinceEpoch(globalEpoch)).toEqual([])

		expect(atomA.diffSinceEpoch(startEpoch)).toEqual([])
		atomA.set(5)
		expect(atomA.diffSinceEpoch(startEpoch)).toEqual([+4])
		expect(atomB.diffSinceEpoch(startEpoch)).toEqual([-6, -5, -10])
		expect(atomB.diffSinceEpoch(globalEpoch)).toEqual([])
	})
	it('still updates history during transactions', () => {
		const atom = new Atom('', 1, {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		const startEpoch = globalEpoch

		transact(() => {
			expect(atom.diffSinceEpoch(startEpoch)).toEqual([])

			atom.set(5)

			expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])

			atom.set(10)

			expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +5])

			atom.set(20)

			expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +5, +10])
		})

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +5, +10])
	})
	it('will clear the history if the transaction aborts', () => {
		const atom = new Atom('', 1, {
			historyLength: 3,
			computeDiff: (a, b) => b - a,
		})

		const startEpoch = globalEpoch

		transaction((rollback) => {
			expect(atom.diffSinceEpoch(startEpoch)).toEqual([])

			atom.set(5)

			expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])

			rollback()
		})

		expect(atom.diffSinceEpoch(startEpoch)).toEqual(RESET_VALUE)
	})
	it('supports an update operation', () => {
		const startEpoch = globalEpoch
		const atom = new Atom('', 1)

		atom.update((value) => value + 1)

		expect(atom.get()).toBe(2)
		expect(globalEpoch).toBe(startEpoch + 1)
	})
	it('supports passing diffs in .set', () => {
		const atom = new Atom('', 1, { historyLength: 3 })

		const startEpoch = globalEpoch

		atom.set(5, +4)
		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])

		atom.set(6, +1)
		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4, +1])
	})
	it('does not push history if nothing changed', () => {
		const atom = new Atom('', 1, { historyLength: 3 })

		const startEpoch = globalEpoch

		atom.set(5, +4)
		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])
		atom.set(5, +4)
		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])
	})
	it('clears the history buffer if you fail to provide a diff', () => {
		const atom = new Atom('', 1, { historyLength: 3 })
		const startEpoch = globalEpoch

		atom.set(5, +4)

		expect(atom.diffSinceEpoch(startEpoch)).toEqual([+4])

		atom.set(6)

		expect(atom.diffSinceEpoch(startEpoch)).toEqual(RESET_VALUE)
	})
})

describe('reacting to atoms', () => {
	it('should work', async () => {
		const a = new Atom('', 234)

		let val = 0
		const r = reactor('', () => {
			val = a.get()
		})

		expect(val).toBe(0)

		r.start()

		expect(val).toBe(234)

		a.set(939)

		expect(val).toBe(939)

		r.stop()

		a.set(2342)

		expect(val).toBe(939)
		expect(a.get()).toBe(2342)
	})
})
