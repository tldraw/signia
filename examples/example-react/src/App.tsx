import './App.css'
import { useAtom, useDerivedValue, useReactor } from '@tldraw/tlstate-react'

function App() {
	const count = useAtom(0, 'count')

	const currentCount = useDerivedValue(() => {
		return count.get()
	}, 'count')

	const currentDoubles = useDerivedValue(() => {
		return count.get() * 2
	}, 'doubles')

	useReactor(() => {
		console.log(`Count: ${count.get()}`)
	}, 'reactor')

	return (
		<div className="App">
			Count {currentCount}, Doubles: {currentDoubles}
			<div>
				<button onClick={() => count.set(count.get() + 1)}>Increment</button>
				<button onClick={() => count.set(count.get() - 1)}>Decrement</button>
			</div>
		</div>
	)
}

export default App
