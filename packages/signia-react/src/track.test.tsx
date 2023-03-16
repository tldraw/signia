import { createRef, forwardRef, memo, useEffect, useImperativeHandle } from 'react'
import { act, create, ReactTestRenderer } from 'react-test-renderer'
import { atom } from 'signia'
import { track } from './track.js'

test("tracked components are memo'd", async () => {
	let numRenders = 0
	const Component = track(function Component({ a, b, c }: { a: string; b: string; c: string }) {
		numRenders++
		return (
			<>
				{a}
				{b}
				{c}
			</>
		)
	})

	let view: ReactTestRenderer
	await act(() => {
		view = create(<Component a="a" b="b" c="c" />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "a",
		  "b",
		  "c",
		]
	`)

	expect(numRenders).toBe(1)

	await act(() => {
		view!.update(<Component a="a" b="b" c="c" />)
	})

	expect(numRenders).toBe(1)

	await act(() => {
		view!.update(<Component a="a" b="b" c="d" />)
	})

	expect(numRenders).toBe(2)

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "a",
		  "b",
		  "d",
		]
	`)
})

test("it's fine to call track on components that are already memo'd", async () => {
	let numRenders = 0
	const Component = track(
		memo(function Component({ a, b, c }: { a: string; b: string; c: string }) {
			numRenders++
			return (
				<>
					{a}
					{b}
					{c}
				</>
			)
		})
	)

	let view: ReactTestRenderer
	await act(() => {
		view = create(<Component a="a" b="b" c="c" />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "a",
		  "b",
		  "c",
		]
	`)

	expect(numRenders).toBe(1)

	await act(() => {
		view!.update(<Component a="a" b="b" c="c" />)
	})

	expect(numRenders).toBe(1)

	await act(() => {
		view!.update(<Component a="a" b="b" c="d" />)
	})

	expect(numRenders).toBe(2)

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "a",
		  "b",
		  "d",
		]
	`)
})

test('tracked components can use refs', async () => {
	const Component = track(
		forwardRef<{ handle: string }, { prop: string }>(function Component({ prop }, ref) {
			useImperativeHandle(ref, () => ({ handle: prop }), [prop])
			return <>output</>
		})
	)

	const ref = createRef<{ handle: string }>()

	let view: ReactTestRenderer
	await act(() => {
		view = create(<Component prop="hello" ref={ref} />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot('"output"')

	expect(ref.current?.handle).toBe('hello')

	await act(() => {
		view.update(<Component prop="world" ref={ref} />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot('"output"')

	expect(ref.current?.handle).toBe('world')
})

test('tracked components update when the state they refernce updates', async () => {
	const a = atom('a', 1)

	const C = track(function Component() {
		return <>{a.value}</>
	})

	let view: ReactTestRenderer

	await act(() => {
		view = create(<C />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`"1"`)

	await act(() => {
		a.set(2)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`"2"`)
})

test('things referenced in effects do not trigger updates', async () => {
	const a = atom('a', 1)
	let numRenders = 0

	const Component = track(function Component() {
		numRenders++
		useEffect(() => {
			a.value
		}, [])
		return <>hi</>
	})

	let view: ReactTestRenderer

	await act(() => {
		view = create(<Component />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`"hi"`)
	expect(numRenders).toBe(1)

	await act(() => {
		a.set(2)
	})

	expect(numRenders).toBe(1)
	expect(view!.toJSON()).toMatchInlineSnapshot(`"hi"`)
})
