import { atom } from '../Atom'
import { maybeCaptureParent, startCapturingParents, stopCapturingParents } from '../capture'
import { advanceGlobalEpoch, globalEpoch } from '../transactions'
import { Child } from '../types'

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
		const startEpoch = globalEpoch

		const child = emptyChild()
		const originalParentEpochs = child.parentEpochs
		const originalParents = child.parents

		startCapturingParents(child)
		maybeCaptureParent(a)
		stopCapturingParents()

		// the parents should be kept because no sharing is possible and we don't want to reallocate
		// when parents change
		expect(child.parentEpochs).toBe(originalParentEpochs)
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toEqual([startEpoch])
		expect(child.parents).toEqual([a])
	})

	it('can handle several parents', () => {
		const atomA = atom('', 1)
		const atomAEpoch = globalEpoch
		advanceGlobalEpoch() // let's say time has passed
		const atomB = atom('', 1)
		const atomBEpoch = globalEpoch
		advanceGlobalEpoch() // let's say time has passed
		const atomC = atom('', 1)
		const atomCEpoch = globalEpoch

		expect(atomAEpoch < atomBEpoch).toBe(true)
		expect(atomBEpoch < atomCEpoch).toBe(true)

		const child = emptyChild()

		const originalParentEpochs = child.parentEpochs
		const originalParents = child.parents

		startCapturingParents(child)
		maybeCaptureParent(atomA)
		maybeCaptureParent(atomB)
		maybeCaptureParent(atomC)
		stopCapturingParents()

		// the parents should be kept because no sharing is possible and we don't want to reallocate
		// when parents change
		expect(child.parentEpochs).toBe(originalParentEpochs)
		expect(child.parents).toBe(originalParents)

		expect(child.parentEpochs).toEqual([atomAEpoch, atomBEpoch, atomCEpoch])
		expect(child.parents).toEqual([atomA, atomB, atomC])
	})

	it('will reorder if parents are captured in different orders each time', () => {
		const atomA = atom('', 1)
		advanceGlobalEpoch() // let's say time has passed
		const atomB = atom('', 1)
		advanceGlobalEpoch() // let's say time has passed
		const atomC = atom('', 1)

		const child = emptyChild()

		startCapturingParents(child)
		maybeCaptureParent(atomA)
		maybeCaptureParent(atomB)
		maybeCaptureParent(atomC)
		stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomB, atomC])

		startCapturingParents(child)
		maybeCaptureParent(atomB)
		maybeCaptureParent(atomA)
		maybeCaptureParent(atomC)
		stopCapturingParents()

		expect(child.parents).toEqual([atomB, atomA, atomC])

		startCapturingParents(child)
		maybeCaptureParent(atomA)
		maybeCaptureParent(atomC)
		maybeCaptureParent(atomB)
		stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomC, atomB])
	})

	it('will shrink the parent arrays if the number of captured parents shrinks', () => {
		const atomA = atom('', 1)
		const atomAEpoch = globalEpoch
		advanceGlobalEpoch() // let's say time has passed
		const atomB = atom('', 1)
		const atomBEpoch = globalEpoch
		advanceGlobalEpoch() // let's say time has passed
		const atomC = atom('', 1)
		const atomCEpoch = globalEpoch

		const child = emptyChild()

		const originalParents = child.parents
		const originalParentEpochs = child.parentEpochs

		startCapturingParents(child)
		maybeCaptureParent(atomA)
		maybeCaptureParent(atomB)
		maybeCaptureParent(atomC)
		stopCapturingParents()

		expect(child.parents).toEqual([atomA, atomB, atomC])
		expect(child.parents).toBe(originalParents)

		startCapturingParents(child)
		maybeCaptureParent(atomB)
		maybeCaptureParent(atomA)
		stopCapturingParents()

		expect(child.parents).toEqual([atomB, atomA])
		expect(child.parentEpochs).toEqual([atomBEpoch, atomAEpoch])
		expect(child.parents).toBe(originalParents)

		startCapturingParents(child)
		stopCapturingParents()

		expect(child.parents).toEqual([])
		expect(child.parentEpochs).toEqual([])
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toBe(originalParentEpochs)

		startCapturingParents(child)
		maybeCaptureParent(atomC)
		stopCapturingParents()

		expect(child.parents).toEqual([atomC])
		expect(child.parentEpochs).toEqual([atomCEpoch])
		expect(child.parents).toBe(originalParents)
		expect(child.parentEpochs).toBe(originalParentEpochs)
	})

	it('doesnt do anything if you dont start capturing', () => {
		expect(() => {
			maybeCaptureParent(atom('', 1))
		}).not.toThrow()
	})
})
