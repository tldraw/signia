import { createRef, forwardRef, lazy, memo, Suspense, useEffect, useImperativeHandle } from 'react'
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

test('tracked components update when the state they reference updates', async () => {
	const a = atom('a', 1)

	const Component = function Component() {
		return <>{a.value}</>
	}

	const Tracked = track(Component)

	let view: ReactTestRenderer

	await act(() => {
		view = create(<Tracked />)
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

test("tracked zombie-children don't throw", async () => {
	const theAtom = atom<Record<string, number>>('map', { a: 1, b: 2, c: 3 })
	const Parent = track(function Parent() {
		const ids = Object.keys(theAtom.value)
		return (
			<>
				{ids.map((id) => (
					<Child key={id} id={id} />
				))}
			</>
		)
	})
	const Child = track(function Child({ id }: { id: string }) {
		if (!(id in theAtom.value)) throw new Error('id not found!')
		const value = theAtom.value[id]
		return <>{value}</>
	})

	let view: ReactTestRenderer
	await act(() => {
		view = create(<Parent />)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "1",
		  "2",
		  "3",
		]
	`)

	// remove id 'b' creating a zombie-child
	await act(() => {
		theAtom?.update(({ b: _, ...rest }) => rest)
	})

	expect(view!.toJSON()).toMatchInlineSnapshot(`
		[
		  "1",
		  "3",
		]
	`)
})

describe('lazy components', () => {
	test("are memo'd when tracked", async () => {
		let numRenders = 0
		const Component = function Component({ a, b, c }: { a: string; b: string; c: string }) {
			numRenders++
			return (
				<>
					{a}
					{b}
					{c}
				</>
			)
		}

		const Lazy = lazy(() => Promise.resolve({ default: Component }))
		const TrackedLazy = track(Lazy)

		let view: ReactTestRenderer
		await act(() => {
			view = create(
				<Suspense>
					<TrackedLazy a="a" b="b" c="c" />
				</Suspense>
			)
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
			view!.update(
				<Suspense>
					<TrackedLazy a="a" b="b" c="c" />
				</Suspense>
			)
		})

		expect(numRenders).toBe(1)

		await act(() => {
			view!.update(
				<Suspense>
					<TrackedLazy a="a" b="b" c="d" />
				</Suspense>
			)
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

	test('update when the state they reference updates', async () => {
		const a = atom('a', 1)

		const Component = function Component() {
			return <>{a.value}</>
		}

		const Lazy = lazy(() => Promise.resolve({ default: Component }))
		const TrackedLazy = track(Lazy)

		let view: ReactTestRenderer

		await act(() => {
			view = create(
				<Suspense>
					<TrackedLazy />
				</Suspense>
			)
		})

		expect(view!.toJSON()).toMatchInlineSnapshot(`"1"`)

		await act(() => {
			a.set(2)
		})

		expect(view!.toJSON()).toMatchInlineSnapshot(`"2"`)
	})
})
