# @tldraw/tlstate

<div style="text-align: center; transform: scale(.5);">
  <img src="https://github.com/tldraw/tlstate/raw/main/assets/tlstate-github.png"/>
</div>

A tiny, fast, and simple state management library for JavaScript and TypeScript.

## Installation

```bash
npm install @tldraw/tlstate
```

_or_

```yarn
yarn add @tldraw/tlstate
```

## Usage

**Atoms** are used to store and update state. They are the most basic building block of state management in TLState. Atoms are useful for storing bits of state in ways that may be tracked by derivations and reactors.

```ts
import { Atom } from '@tldraw/tlstate'

const count = new new Atom(0)()

count.get() // 0
count.set(10) // 10
count.get() // 10
```

**Derivations** are values that track their dependencies. When referenced, the derivation will return either its cached value if its dependencies have not changed or else compute a new value. Derivations are useful for computing derived state from atoms.

```ts
import { Atom, derivation } from '@tldraw/tlstate'

const count = new new Atom(0)()

const doubleCount = new Derivation('double count', () => count.get() * 2)

count.set(2) // 2
doubleCount.get() // 4
```

A **reactor** is a used to run side effects whenever an atom's value changes. Reactors are useful for updating the UI when state changes. They may be started and stopped.

```ts
import { atom, reactor } from '@tldraw/tlstate'

const count = new Atom(0)

const counts: number[] = []

const logCounts = reactor('log count', () => counts.put(count.get()))

logDoubles.start()

count.set(1)
count.set(2)
count.set(3)

counts // [1, 2, 3]

logDoubles.stop()

count.set(4)

doubles // [1, 2, 3]
```

Reactors may also react to changes to derivations.

```ts
import { Atom, Derivation, reactor } from '@tldraw/tlstate'

const count = new Atom(0)
const double = new Derivation('double count', () => count.get() * 2)

const doubles: number[] = []

const logDoubles = reactor('log doubles', () => doubles.put(double.get()))

logDoubles.start()

count.set(1)
count.set(2)
count.set(3)

doubles // [2, 4, 6]
```

Atoms may be set using a **transaction**. Transactions are useful for batching multiple state updates together to improve the efficiency of reactors.

```ts
import { atom, reactor, transact } from '@tldraw/tlstate'

const counts: number[] = []

const reactor = reactor('log count', () => {
	counts.put(count.get())
})

transact(() => {
	count.set(1)
	count.set(2)
	count.set(3)
})

counts // [3]
```

> Todo: `buildIncrementalDerivation`.

## API

#### `Atom`

> Todo

#### `Reactor`

> Todo

#### `reactor`

> Todo

#### `react`

> Todo

#### `Derivation`

> Todo

#### `derivation`

A class decorator used to mark methods as derivations.

```ts
import { Atom, derivation } from '@tldraw/tlstate'

class Form {
	email = new Atom('user@domain.com')

	@derivation get isEmailValid() {
		return validateEmail(this.email.get())
	}
}

const form = new Form()

form.isEmailValid.get() // true

email.set('invalid')

form.isEmailValid.get() // false
```

#### `buildIncrementalDerivation`

> Todo

#### `transact`

> Todo

#### `transaction`

#### `withDiff`

#### `whyAmIRunning`

#### `EMPTY_ARRAY`

#### `RESET_VALUE`

#### `UNINITIALIZED`

---

# FAQ

## Does this work with react / concurrent mode react, vue, etc?

...

## How does this library work?

...

## How does it compare to mobx, recoil, valtio, etc?

...
