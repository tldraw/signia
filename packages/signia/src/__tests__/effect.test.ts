import { Signia } from '../Signia.js'

const {
	atom,
	effect,
	runEffect,
	transact,
	// @ts-expect-error
	ctx,
} = new Signia()

describe('effects', () => {
	it('can be started and stopped ', () => {
		const a = atom('', 1)
		const r = effect('', () => {
			a.value
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
		const a = atom('', 1)
		const r = effect('', () => {
			if (a.value < +Infinity) {
				a.update((a) => a + 1)
			}
		})
		expect(() => r.start()).toThrowErrorMatchingInlineSnapshot(
			`"cannot change atoms during reaction cycle"`
		)
	})

	it('will never be called twice after a single state update, even if that update affects multiple atoms to which the reactor is subscribed', () => {
		const atomA = atom('', 1)
		const atomB = atom('', 1)

		const react = jest.fn(() => {
			atomA.value
			atomB.value
		})
		const r = effect('', react)

		r.start()
		expect(react).toHaveBeenCalledTimes(1)

		transact(() => {
			atomA.set(2)
			atomB.set(2)
		})

		expect(react).toHaveBeenCalledTimes(2)
	})

	it('will not react if stopped', () => {
		const a = atom('', 1)
		const react = jest.fn(() => {
			a.value
		})
		const r = effect('', react)

		r.scheduler.maybeScheduleEffect()

		expect(react).not.toHaveBeenCalled()
	})

	it('will not react if the parents have not changed', () => {
		const a = atom('', 1)
		const react = jest
			.fn(() => {
				a.value
			})
			.mockName('react')
		const r = effect('', react)

		r.start()
		expect(react).toHaveBeenCalledTimes(1)

		ctx.globalEpoch++
		r.scheduler.maybeScheduleEffect()
		expect(react).toHaveBeenCalledTimes(1)
	})
})

describe('stopping', () => {
	it('works', () => {
		const a = atom('', 1)

		const rfn = jest.fn(() => {
			a.value
		})
		const r = effect('', rfn)

		expect(a.children.isEmpty).toBe(true)

		r.start()

		expect(a.children.isEmpty).toBe(false)

		a.set(8)

		expect(rfn).toHaveBeenCalledTimes(2)

		r.stop()

		expect(a.children.isEmpty).toBe(true)
		expect(rfn).toHaveBeenCalledTimes(2)

		a.set(2)

		expect(rfn).toHaveBeenCalledTimes(2)

		a.set(3)

		expect(rfn).toHaveBeenCalledTimes(2)

		expect(a.children.isEmpty).toBe(true)
	})
})

test('.start() by default does not trigger a reaction if nothing has changed', () => {
	const a = atom('', 1)

	const rfn = jest.fn(() => {
		a.value
	})

	const r = effect('', rfn)
	r.start()

	expect(rfn).toHaveBeenCalledTimes(1)

	r.stop()

	r.start()

	expect(rfn).toHaveBeenCalledTimes(1)
})

test('.start({force: true}) will trigger a reaction even if nothing has changed', () => {
	const a = atom('', 1)

	const rfn = jest.fn(() => {
		a.value
	})

	const r = effect('', rfn)
	r.start()

	expect(rfn).toHaveBeenCalledTimes(1)

	r.stop()

	r.start({ force: true })

	expect(rfn).toHaveBeenCalledTimes(2)
})

test('.start with a custom scheduler only schedules an effect, it does not execute it immediately', () => {
	let numSchedules = 0
	let numExecutes = 0

	const r = effect(
		'',
		() => {
			numExecutes++
		},
		{
			scheduleEffect: () => {
				numSchedules++
			},
		}
	)
	r.start()

	expect(numSchedules).toBe(1)
	expect(numExecutes).toBe(0)
})

test('runEffect() with a custom scheduler only schedules an effect, it does not execute it immediately', () => {
	let numSchedules = 0
	let numExecutes = 0

	const stop = runEffect(
		'',
		() => {
			numExecutes++
		},
		{
			scheduleEffect: () => {
				numSchedules++
			},
		}
	)

	expect(numSchedules).toBe(1)
	expect(numExecutes).toBe(0)
})
