import { atom, computed } from '@tldraw/tlstate'

interface Todo {
	id: number
	title: string
	completed: boolean
}

export class TodoList {
	readonly todos = atom<Todo[]>('todos', [
		{
			id: 0,
			title: 'Use TLState',
			completed: false,
		},
	])
	readonly filter = atom<'all' | 'active' | 'completed'>(
		'filter',
		window.location.hash === '#/active'
			? 'active'
			: window.location.hash === '#/completed'
			? 'completed'
			: 'all'
	)

	@computed
	get filteredTodos(): Todo[] {
		const filter = this.filter.value
		return this.todos.value.filter(
			(todo) =>
				filter === 'all' ||
				(filter === 'active' && !todo.completed) ||
				(filter === 'completed' && todo.completed)
		)
	}

	addTodo = (title: string) => {
		this.todos.update((todos) => [...todos, { id: todos.length, title, completed: false }])
	}

	toggleCompleted = (id: number) => {
		this.todos.update((todos) =>
			todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
		)
	}

	toggleAll = () => {
		const areAllCompleted = this.todos.value.every((todo) => todo.completed)

		this.todos.update((todos) =>
			todos.map((todo) => ({ ...todo, completed: areAllCompleted ? false : true }))
		)
	}

	clearCompleted = () => {
		this.todos.update((todos) => todos.filter((todo) => !todo.completed))
	}

	get numIncomplete() {
		return this.todos.value.filter((todo) => !todo.completed).length
	}
}
