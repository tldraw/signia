import { Signia } from '../Signia.js'
import { Child } from '../types.js'

const {
	atom,
	computed,
	unsafe__withoutCapture,
	runEffect,
	// @ts-expect-error
	ctx,
} = new Signia()

const emptyChild = (props: Partial<Child> = {}) =>
	({
		parentEpochs: [],
		parents: [],
		isActivelyListening: false,
		lastTraversedEpoch: 0,
		...props,
	} as Child)

describe('capturing parents', () => {
	it('can be started and stopped', () => {
		const a = atom('', 1)
		const startEpoch = ctx.globalEpoch

		const child = emptyChild()
		const originalParentEpochs = child.parentEpochs
		const originalParents = child.parents

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(a)
		ctx.stopCapturingParents()

		// the parents should be kept because no sharing is possible and we don't want to reallocate
		// when parents change
		expect(child.parentEpochs).toBe(originalParentEpochs)
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toEqual([startEpoch])
		expect(child.parents).toEqual([a])
	})

	it('can handle several parents', () => {
		const atomA = atom('', 1)
		const atomAEpoch = ctx.globalEpoch
		ctx.globalEpoch++ // let's say time has passed
		const atomB = atom('', 1)
		const atomBEpoch = ctx.globalEpoch
		ctx.globalEpoch++ // let's say time has passed
		const atomC = atom('', 1)
		const atomCEpoch = ctx.globalEpoch

		expect(atomAEpoch < atomBEpoch).toBe(true)
		expect(atomBEpoch < atomCEpoch).toBe(true)

		const child = emptyChild()

		const originalParentEpochs = child.parentEpochs
		const originalParents = child.parents

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomA)
		ctx.maybeCaptureParent(atomB)
		ctx.maybeCaptureParent(atomC)
		ctx.stopCapturingParents()

		// the parents should be kept because no sharing is possible and we don't want to reallocate
		// when parents change
		expect(child.parentEpochs).toBe(originalParentEpochs)
		expect(child.parents).toBe(originalParents)

		expect(child.parentEpochs).toEqual([atomAEpoch, atomBEpoch, atomCEpoch])
		expect(child.parents).toEqual([atomA, atomB, atomC])
	})

	it('will reorder if parents are captured in different orders each time', () => {
		const atomA = atom('', 1)
		ctx.globalEpoch++ // let's say time has passed
		const atomB = atom('', 1)
		ctx.globalEpoch++ // let's say time has passed
		const atomC = atom('', 1)

		const child = emptyChild()

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomA)
		ctx.maybeCaptureParent(atomB)
		ctx.maybeCaptureParent(atomC)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomB, atomC])

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomB)
		ctx.maybeCaptureParent(atomA)
		ctx.maybeCaptureParent(atomC)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomB, atomA, atomC])

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomA)
		ctx.maybeCaptureParent(atomC)
		ctx.maybeCaptureParent(atomB)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomC, atomB])
	})

	it('will shrink the parent arrays if the number of captured parents shrinks', () => {
		const atomA = atom('', 1)
		const atomAEpoch = ctx.globalEpoch
		ctx.globalEpoch++ // let's say time has passed
		const atomB = atom('', 1)
		const atomBEpoch = ctx.globalEpoch
		ctx.globalEpoch++ // let's say time has passed
		const atomC = atom('', 1)
		const atomCEpoch = ctx.globalEpoch

		const child = emptyChild()

		const originalParents = child.parents
		const originalParentEpochs = child.parentEpochs

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomA)
		ctx.maybeCaptureParent(atomB)
		ctx.maybeCaptureParent(atomC)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomB, atomC])
		expect(child.parents).toBe(originalParents)

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomB)
		ctx.maybeCaptureParent(atomA)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomB, atomA])
		expect(child.parentEpochs).toEqual([atomBEpoch, atomAEpoch])
		expect(child.parents).toBe(originalParents)

		ctx.startCapturingParents(child)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([])
		expect(child.parentEpochs).toEqual([])
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toBe(originalParentEpochs)

		ctx.startCapturingParents(child)
		ctx.maybeCaptureParent(atomC)
		ctx.stopCapturingParents()

		expect(child.parents).toEqual([atomC])
		expect(child.parentEpochs).toEqual([atomCEpoch])
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toBe(originalParentEpochs)
	})

	it("doesn't do anything if you don't start capturing", () => {
		expect(() => {
			ctx.maybeCaptureParent(atom('', 1))
		}).not.toThrow()
	})
})

describe('unsafe__withoutCapture', () => {
	it('allows executing computed code in a context that short-circuits the current capture frame', () => {
		const atomA = atom('a', 1)
		const atomB = atom('b', 1)
		const atomC = atom('c', 1)

		const child = computed('', () => {
			return atomA.value + atomB.value + unsafe__withoutCapture(() => atomC.value)
		})

		let lastValue: number | undefined
		let numReactions = 0

		runEffect('', () => {
			numReactions++
			lastValue = child.value
		})

		expect(lastValue).toBe(3)
		expect(numReactions).toBe(1)

		atomA.set(2)

		expect(lastValue).toBe(4)
		expect(numReactions).toBe(2)

		atomB.set(2)

		expect(lastValue).toBe(5)
		expect(numReactions).toBe(3)

		atomC.set(2)

		// The reaction should not have run because C was not captured
		expect(lastValue).toBe(5)
		expect(numReactions).toBe(3)
	})

	it('allows executing reactor code in a context that short-circuits the current capture frame', () => {
		const atomA = atom('a', 1)
		const atomB = atom('b', 1)
		const atomC = atom('c', 1)

		let lastValue: number | undefined
		let numReactions = 0

		runEffect('', () => {
			numReactions++
			lastValue = atomA.value + atomB.value + unsafe__withoutCapture(() => atomC.value)
		})

		expect(lastValue).toBe(3)
		expect(numReactions).toBe(1)

		atomA.set(2)

		expect(lastValue).toBe(4)
		expect(numReactions).toBe(2)

		atomB.set(2)

		expect(lastValue).toBe(5)
		expect(numReactions).toBe(3)

		atomC.set(2)

		// The reaction should not have run because C was not captured
		expect(lastValue).toBe(5)
		expect(numReactions).toBe(3)
	})
})
