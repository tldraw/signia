import './style.css'
import { Atom, Derivation, reactor } from '@tldraw/tlstate-core'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <p id="counter">Count: 0, Doubles: 0</span></p>
    <button id="increment">Increment</button>
    <button id="decrement">Decrement</button>
  </div>
`

const counter = document.querySelector<HTMLSpanElement>('#counter')!
const incrementButton = document.querySelector<HTMLButtonElement>('#increment')!
const decrementButton = document.querySelector<HTMLButtonElement>('#decrement')!

const count = new Atom<number>('count', 0)
const doubles = new Derivation('doubles', () => count.get() * 2)

const updateUI = reactor('update ui', () => {
	counter.textContent = `Count: ${count.get()}, Doubles: ${doubles.get()}`
})

updateUI.start()

incrementButton.onclick = () => count.set(count.get() + 1)
decrementButton.onclick = () => count.set(count.get() - 1)
