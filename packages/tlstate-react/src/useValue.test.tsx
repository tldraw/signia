import { Atom, Computed } from '@tldraw/tlstate'
import { useState } from 'react'
import ReactTestRenderer from 'react-test-renderer'
import { useAtom } from './useAtom'
import { useComputed } from './useComputed'
import { useValue } from './useValue'

test('useValue returns a value from a computed', async () => {
	let theComputed = null as null | Computed<number>
	let theAtom = null as null | Atom<number>
	function Component() {
		const a = useAtom('a', 1)
		theAtom = a
		const b = useComputed('a+1', () => a.value + 1, [])
		theComputed = b
		return <>{useValue(b)}</>
	}

	let view: ReactTestRenderer.ReactTestRenderer
	await ReactTestRenderer.act(() => {
		view = ReactTestRenderer.create(<Component />)
	})

	expect(theComputed).not.toBeNull()
	expect(theComputed?.value).toBe(2)
	expect(theComputed?.name).toBe('useComputed(a+1)')
	expect(view!.toJSON()).toMatchInlineSnapshot(`"2"`)

	await ReactTestRenderer.act(() => {
		theAtom?.set(5)
	})
	expect(view!.toJSON()).toMatchInlineSnapshot(`"6"`)
})

test('useValue returns a value from an atom', async () => {
	let theAtom = null as null | Atom<number>
	function Component() {
		const a = useAtom('a', 1)
		theAtom = a
		return <>{useValue(a)}</>
	}

	let view: ReactTestRenderer.ReactTestRenderer
	await ReactTestRenderer.act(() => {
		view = ReactTestRenderer.create(<Component />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`"1"`)

	await ReactTestRenderer.act(() => {
		theAtom?.set(5)
	})
	expect(view!.toJSON()).toMatchInlineSnapshot(`"5"`)
})

test('useValue returns a value from a compute function', async () => {
	let theAtom = null as null | Atom<number>
	let setB = null as null | ((b: number) => void)
	function Component() {
		const a = useAtom('a', 1)
		const [b, _setB] = useState(1)
		setB = _setB
		theAtom = a
		const c = useValue('a+b', () => a.value + b, [b])
		return <>{c}</>
	}

	let view: ReactTestRenderer.ReactTestRenderer
	await ReactTestRenderer.act(() => {
		view = ReactTestRenderer.create(<Component />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`"2"`)

	await ReactTestRenderer.act(() => {
		theAtom?.set(5)
	})
	expect(view!.toJSON()).toMatchInlineSnapshot(`"6"`)

	await ReactTestRenderer.act(() => {
		setB!(5)
	})
	expect(view!.toJSON()).toMatchInlineSnapshot(`"10"`)
})
