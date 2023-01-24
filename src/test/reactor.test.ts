import { Atom } from '../Atom'
import { reactor } from '../reactor'
import { advanceGlobalEpoch, transact } from '../transactions'

describe('reactors', () => {
	it('can be started and stopped ', () => {
		const atom = new Atom('', 1)
		const r = reactor('', () => {
			atom.get()
		})
		expect(r.scheduler.isActivelyListening).toBe(false)
		r.start()
		expect(r.scheduler.isActivelyListening).toBe(true)
		r.stop()
		expect(r.scheduler.isActivelyListening).toBe(false)
		r.start()
		expect(r.scheduler.isActivelyListening).toBe(true)
	})

	it('can not set atom values directly yet', () => {
		const atom = new Atom('', 1)
		const r = reactor('', () => {
			if (atom.get() < +Infinity) {
				atom.update((a) => a + 1)
			}
		})
		expect(() => r.start()).toThrowErrorMatchingInlineSnapshot(
			`"cannot change atoms during reaction cycle"`
		)
	})

	it('will never be called twice after a single state update, even if that update affects multiple atoms to which the reactor is subscribed', () => {
		const atomA = new Atom('', 1)
		const atomB = new Atom('', 1)

		const react = jest.fn(() => {
			atomA.get()
			atomB.get()
		})
		const r = reactor('', react)

		r.start()
		expect(react).toHaveBeenCalledTimes(1)

		transact(() => {
			atomA.set(2)
			atomB.set(2)
		})

		expect(react).toHaveBeenCalledTimes(2)
	})

	it('will not react if stopped', () => {
		const atom = new Atom('', 1)
		const react = jest.fn(() => {
			atom.get()
		})
		const r = reactor('', react)

		r.scheduler.maybeRunEffect()

		expect(react).not.toHaveBeenCalled()
	})

	it('will not react if the parents have not changed', () => {
		const atom = new Atom('', 1)
		const react = jest
			.fn(() => {
				atom.get()
			})
			.mockName('react')
		const r = reactor('', react)

		r.start()
		expect(react).toHaveBeenCalledTimes(1)

		advanceGlobalEpoch()
		r.scheduler.maybeRunEffect()
		expect(react).toHaveBeenCalledTimes(1)
	})
})

describe('stopping', () => {
	it('works', () => {
		const atom = new Atom('', 1)

		const rfn = jest.fn(() => {
			atom.get()
		})
		const r = reactor('', rfn)

		expect(atom.children.isEmpty).toBe(true)

		r.start()

		expect(atom.children.isEmpty).toBe(false)

		atom.set(8)

		expect(rfn).toHaveBeenCalledTimes(2)

		r.stop()

		expect(atom.children.isEmpty).toBe(true)
		expect(rfn).toHaveBeenCalledTimes(2)

		atom.set(2)

		expect(rfn).toHaveBeenCalledTimes(2)

		atom.set(3)

		expect(rfn).toHaveBeenCalledTimes(2)

		expect(atom.children.isEmpty).toBe(true)
	})
})

test('.start() triggers a reaction even if nothing has changed', () => {
	const atom = new Atom('', 1)

	const rfn = jest.fn(() => {
		atom.get()
	})

	const r = reactor('', rfn)
	r.start()

	expect(rfn).toHaveBeenCalledTimes(1)

	r.stop()

	r.start()

	expect(rfn).toHaveBeenCalledTimes(2)
})
