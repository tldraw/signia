import { times } from 'lodash'
import { atom, Atom } from '../Atom'
import { computed, Computed } from '../Computed'
import { Reactor, reactor } from '../EffectScheduler'
import { transaction } from '../transactions'

class RandomSource {
	private seed: number

	constructor(seed: number) {
		this.seed = seed
	}

	nextFloat(): number {
		this.seed = (this.seed * 9301 + 49297) % 233280
		return this.seed / 233280
	}

	nextInt(max: number): number {
		return Math.floor(this.nextFloat() * max)
	}

	nextIntInRange(min: number, max: number): number {
		return this.nextInt(max - min) + min
	}

	nextId(): string {
		return this.nextInt(Number.MAX_SAFE_INTEGER).toString(36)
	}

	selectOne<T>(arr: readonly T[]): T {
		return arr[this.nextInt(arr.length)]
	}

	choice(probability: number): boolean {
		return this.nextFloat() < probability
	}

	executeOne<Result>(
		_choices: Record<string, (() => Result) | { weight?: number; do(): Result }>
	): Result {
		const choices = Object.values(_choices).map((choice) => {
			if (typeof choice === 'function') {
				return { weight: 1, do: choice }
			}
			return choice
		})
		const totalWeight = Object.values(choices).reduce(
			(total, choice) => total + (choice.weight ?? 1),
			0
		)
		const randomWeight = this.nextInt(totalWeight)
		let weight = 0
		for (const choice of Object.values(choices)) {
			weight += choice.weight ?? 1
			if (randomWeight < weight) {
				return choice.do()
			}
		}
		throw new Error('unreachable')
	}
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'A', 'B', 'C', 'D', 'E', 'F'] as const
type Letter = (typeof LETTERS)[number]

const toUpper = (letter: Letter): Letter => letter.toUpperCase() as Letter
const toLower = (letter: Letter): Letter => letter.toLowerCase() as Letter

const conversions = {
	toUpper,
	toLower,
	none: (x: Letter) => x,
}
type Conversion = keyof typeof conversions

type AtomDep = { type: 'atom'; atom: Atom<Letter>; value: Letter }
type AtomInAtomDep = { type: 'atomInAtom'; atomInAtom: Atom<Atom<Letter>>; innerAtomId: string }
type DerivationDep = {
	type: 'derivation'
	derivation: Computed<Letter>
	sneakyGet: () => Letter
	conversion: Conversion
	isPush: boolean
}
type DerivationInDerivationDep = {
	type: 'derivationInDerivation'
	derivationInDerivation: Computed<Computed<Letter>>
	innerDerivationId: string
	isPush: boolean
}
type AtomInDerivationDep = {
	type: 'atomInDerivation'
	atomInDerivation: Computed<Atom<Letter>>
	innerAtomId: string
	isPush: boolean
}

type Dep = AtomDep | AtomInAtomDep | DerivationDep | DerivationInDerivationDep | AtomInDerivationDep

type FuzzSystemState = {
	atoms: Record<string, AtomDep>
	atomsInAtoms: Record<string, AtomInAtomDep>
	derivations: Record<string, DerivationDep>
	derivationsInDerivations: Record<string, DerivationInDerivationDep>
	atomsInDerivations: Record<string, AtomInDerivationDep>
	reactors: Record<
		string,
		{
			reactor: Reactor
			result: string
			dependencies: Dep[]
			sneakyResult: string
		}
	>
}

type Op =
	| { type: 'update_atom'; id: string; value: Letter }
	| { type: 'update_atom_in_atom'; id: string; atomId: string }
	| { type: 'deref_derivation'; id: string }
	| { type: 'deref_derivation_in_derivation'; id: string }
	| { type: 'deref_atom_in_derivation'; id: string }
	| { type: 'run_several_ops_in_transaction'; ops: Op[] }
	| { type: 'start_reactor'; id: string }
	| { type: 'stop_reactor'; id: string }

const MAX_ATOMS = 10
const MAX_ATOMS_IN_ATOMS = 10
const MAX_DERIVATIONS = 10
const MAX_DERIVATIONS_IN_DERIVATIONS = 10
const MAX_ATOMS_IN_DERIVATIONS = 10
const MAX_REACTORS = 10
const MAX_DEPENDENCIES_PER_REACTOR = 3
const MAX_OPS_IN_TRANSACTION = 10

class Test {
	source: RandomSource
	systemState: FuzzSystemState = {
		atoms: {},
		atomsInAtoms: {},
		derivations: {},
		derivationsInDerivations: {},
		atomsInDerivations: {},
		reactors: {},
	}

	unpack = (value: Dep): Letter => {
		switch (value.type) {
			case 'atom':
				return value.atom.value
			case 'atomInAtom':
				return value.atomInAtom.value.value
			case 'derivation':
				return value.derivation.value
			case 'derivationInDerivation':
				return value.derivationInDerivation.value.value
			case 'atomInDerivation':
				return value.atomInDerivation.value.value
		}
	}

	unpack_sneaky = (value: Dep): Letter => {
		switch (value.type) {
			case 'atom':
				return value.value
			case 'atomInAtom':
				return this.systemState.atoms[value.innerAtomId].value
			case 'derivation':
				return value.sneakyGet()
			case 'derivationInDerivation':
				return this.systemState.derivations[value.innerDerivationId].sneakyGet()
			case 'atomInDerivation':
				return this.systemState.atoms[value.innerAtomId].value
		}
	}

	getResultComparisons() {
		const result: { expected: Record<string, string>; actual: Record<string, string | null> } = {
			expected: {},
			actual: {},
		}
		for (const [
			reactorId,
			{ result: actualResult, sneakyResult: expectedResult },
		] of Object.entries(this.systemState.reactors)) {
			result.expected[reactorId] = expectedResult
			result.actual[reactorId] = actualResult
		}

		return result
	}

	constructor(seed: number) {
		this.source = new RandomSource(seed)

		times(this.source.nextIntInRange(1, MAX_ATOMS), () => {
			const atomId = this.source.nextId()
			const initial = this.source.selectOne(LETTERS)
			this.systemState.atoms[atomId] = { type: 'atom', atom: atom(atomId, initial), value: initial }
		})

		times(this.source.nextIntInRange(1, MAX_ATOMS_IN_ATOMS), () => {
			const atomId = this.source.nextId()
			const innerAtomId = this.source.selectOne(Object.keys(this.systemState.atoms))
			this.systemState.atomsInAtoms[atomId] = {
				type: 'atomInAtom',
				atomInAtom: atom(atomId, this.systemState.atoms[innerAtomId].atom),
				innerAtomId,
			}
		})

		times(this.source.nextIntInRange(1, MAX_ATOMS_IN_DERIVATIONS), () => {
			const derivationId = this.source.nextId()
			const innerAtomId = this.source.selectOne(Object.keys(this.systemState.atoms))
			const isPush = this.source.selectOne([false, false])
			this.systemState.atomsInDerivations[derivationId] = {
				type: 'atomInDerivation',
				atomInDerivation: computed(derivationId, () => this.systemState.atoms[innerAtomId].atom, {
					isPush,
				}),
				innerAtomId,
				isPush,
			}
		})

		times(this.source.nextIntInRange(1, MAX_DERIVATIONS), () => {
			const derivationId = this.source.nextId()
			const derivables = [
				...Object.values(this.systemState.atoms),
				...Object.values(this.systemState.atomsInAtoms),
				...Object.values(this.systemState.atomsInDerivations),
				...Object.values(this.systemState.derivations),
			]
			const inputA = this.source.selectOne(derivables)
			const inputB = this.source.selectOne(derivables)
			const inputC = this.source.selectOne(derivables)
			const inputD = this.source.selectOne(derivables)
			const conversion = this.source.selectOne(Object.keys(conversions)) as Conversion
			const isPush = this.source.selectOne([false, false])
			this.systemState.derivations[derivationId] = {
				type: 'derivation',
				derivation: computed(
					derivationId,
					() => {
						if (this.unpack(inputA) === this.unpack(inputB)) {
							return conversions[conversion](this.unpack(inputC))
						} else {
							return conversions[conversion](this.unpack(inputD))
						}
					},
					{
						isPush,
					}
				),
				isPush,
				conversion,
				sneakyGet: () => {
					if (this.unpack_sneaky(inputA) === this.unpack_sneaky(inputB)) {
						return conversions[conversion](this.unpack_sneaky(inputC))
					} else {
						return conversions[conversion](this.unpack_sneaky(inputD))
					}
				},
			}
		})

		times(this.source.nextIntInRange(1, MAX_DERIVATIONS_IN_DERIVATIONS), () => {
			const derivationId = this.source.nextId()
			const innerDerivationId = this.source.selectOne(Object.keys(this.systemState.derivations))
			const isPush = this.source.selectOne([false, false])
			this.systemState.derivationsInDerivations[derivationId] = {
				type: 'derivationInDerivation',
				derivationInDerivation: computed(
					derivationId,
					() => this.systemState.derivations[innerDerivationId].derivation,
					{
						isPush,
					}
				),
				isPush,
				innerDerivationId,
			}
		})

		times(this.source.nextIntInRange(1, MAX_REACTORS), () => {
			const reactorId = this.source.nextId()
			const dependencies: Dep[] = []

			times(this.source.nextIntInRange(1, MAX_DEPENDENCIES_PER_REACTOR), () => {
				this.source.executeOne({
					'add a random atom': () => {
						dependencies.push(this.source.selectOne(Object.values(this.systemState.atoms)))
					},
					'add a random atom in atom': () => {
						dependencies.push(this.source.selectOne(Object.values(this.systemState.atomsInAtoms)))
					},
					'add a random derivation': () => {
						dependencies.push(this.source.selectOne(Object.values(this.systemState.derivations)))
					},
					'add a random derivation in derivation': () => {
						dependencies.push(
							this.source.selectOne(Object.values(this.systemState.derivationsInDerivations))
						)
					},
					'add a random atom in derivation': () => {
						dependencies.push(
							this.source.selectOne(Object.values(this.systemState.atomsInDerivations))
						)
					},
				})
				dependencies.push(this.source.selectOne(Object.values(this.systemState.atoms)))
			})

			this.systemState.reactors[reactorId] = {
				reactor: reactor(reactorId, () => {
					this.systemState.reactors[reactorId].result = dependencies.map(this.unpack).join(':')
				}),
				sneakyResult: '',
				result: '',
				dependencies,
			}
		})
	}

	readonly ops: Op[] = []

	getNextOp(): Op {
		return this.source.executeOne<Op>({
			'update atom': () => {
				return {
					type: 'update_atom',
					id: this.source.selectOne(Object.keys(this.systemState.atoms)),
					value: this.source.selectOne(LETTERS),
				}
			},
			'update atom in atom': () => {
				return {
					type: 'update_atom_in_atom',
					id: this.source.selectOne(Object.keys(this.systemState.atomsInAtoms)),
					atomId: this.source.selectOne(Object.keys(this.systemState.atoms)),
				}
			},
			'deref atom in derivation': () => {
				return {
					type: 'deref_atom_in_derivation',
					id: this.source.selectOne(Object.keys(this.systemState.atomsInDerivations)),
				}
			},
			'deref derivation in derivation': () => {
				return {
					type: 'deref_derivation_in_derivation',
					id: this.source.selectOne(Object.keys(this.systemState.derivationsInDerivations)),
				}
			},
			'deref derivation': () => {
				return {
					type: 'deref_derivation',
					id: this.source.selectOne(Object.keys(this.systemState.derivations)),
				}
			},
			'run several ops in a transaction': () => {
				return {
					type: 'run_several_ops_in_transaction',
					ops: times(this.source.nextIntInRange(2, MAX_OPS_IN_TRANSACTION), () => this.getNextOp()),
				}
			},
			start_reactor: () => {
				return {
					type: 'start_reactor',
					id: this.source.selectOne(Object.keys(this.systemState.reactors)),
				}
			},
			stop_reactor: () => {
				return {
					type: 'stop_reactor',
					id: this.source.selectOne(Object.keys(this.systemState.reactors)),
				}
			},
		})
	}

	applyOp(op: Op) {
		switch (op.type) {
			case 'update_atom': {
				this.systemState.atoms[op.id].atom.set(op.value)
				this.systemState.atoms[op.id].value = op.value
				break
			}
			case 'deref_atom_in_derivation': {
				this.systemState.atomsInDerivations[op.id].atomInDerivation.value
				break
			}
			case 'deref_derivation': {
				this.systemState.derivations[op.id].derivation.value
				break
			}
			case 'deref_derivation_in_derivation': {
				this.systemState.derivationsInDerivations[op.id].derivationInDerivation.value
				break
			}
			case 'update_atom_in_atom': {
				this.systemState.atomsInAtoms[op.id].atomInAtom.set(this.systemState.atoms[op.atomId].atom)
				this.systemState.atomsInAtoms[op.id].innerAtomId = op.atomId
				break
			}
			case 'run_several_ops_in_transaction': {
				transaction(() => {
					op.ops.forEach((op) => this.applyOp(op))
				})
				break
			}
			case 'start_reactor': {
				this.systemState.reactors[op.id].reactor.start()
				this.systemState.reactors[op.id].sneakyResult = this.systemState.reactors[
					op.id
				].dependencies
					.map(this.unpack_sneaky)
					.join(':')
				break
			}
			case 'stop_reactor': {
				this.systemState.reactors[op.id].reactor.stop()
				break
			}
			default: {
				throw new Error(`Unknown op type: ${op}`)
			}
		}
	}

	tick(op = this.getNextOp()) {
		this.ops.push(op)
		this.applyOp(op)
		for (const reactor of Object.values(this.systemState.reactors)) {
			if (reactor.reactor.scheduler.isActivelyListening) {
				reactor.sneakyResult = reactor.dependencies.map(this.unpack_sneaky).join(':')
			}
		}
	}
}

const NUM_TESTS = 1000
const NUM_OPS_PER_TEST = 300

function runTest(seed: number, ops?: Op[]) {
	const test = new Test(seed)
	if (ops) {
		ops.forEach((op) => test.tick(op))
		const { expected, actual } = test.getResultComparisons()
		expect(expected).toEqual(actual)
		return
	}
	// console.log(test.systemState)
	for (let i = 0; i < NUM_OPS_PER_TEST; i++) {
		test.tick()
		const { expected, actual } = test.getResultComparisons()
		try {
			expect(expected).toEqual(actual)
		} catch (e) {
			console.log(JSON.stringify(test.ops, null, 2))
			throw e
		}
	}
}

for (let i = 0; i < NUM_TESTS; i++) {
	const seed = Math.floor(Math.random() * 1000000)
	test('fuzzzzzz ' + seed, () => {
		runTest(seed)
	})
}
