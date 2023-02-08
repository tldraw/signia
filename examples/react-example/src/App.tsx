import { track } from 'tlstate-react'
import { useMemo } from 'react'
import 'todomvc-app-css/index.css'
import { TodoList } from './TodoList'

const App = track(function App() {
	const todos = useMemo(() => new TodoList(), [])
	return (
		<section className="todoapp">
			<header className="header">
				<h1>todos</h1>
				<input
					className="new-todo"
					placeholder="What needs to be done?"
					onKeyDown={(e) => {
						// on enter
						if (e.key === 'Enter' && e.currentTarget.value.trim()) {
							todos.addTodo(e.currentTarget.value)
							e.currentTarget.value = ''
						}
					}}
					autoFocus
				/>
			</header>
			<section className="main">
				<input id="toggle-all" className="toggle-all" type="checkbox" onChange={todos.toggleAll} />
				<label htmlFor="toggle-all">Mark all as complete</label>
				<ul className="todo-list">
					{todos.filteredTodos.map((todo) => (
						<li key={todo.id} className={todo.completed ? 'completed' : undefined}>
							<div className="view">
								<input
									className="toggle"
									type="checkbox"
									checked={todo.completed}
									onInput={() => todos.toggleCompleted(todo.id)}
								/>
								<label>{todo.title}</label>
								<button className="destroy"></button>
							</div>
							<input className="edit" value={todo.title} />
						</li>
					))}
				</ul>
			</section>
			<footer className="footer">
				<span className="todo-count">
					<strong>{todos.numIncomplete}</strong> item(s) left
				</span>
				<ul className="filters">
					<li>
						<a
							className={todos.filter.value === 'all' ? 'selected' : undefined}
							href="#/"
							onClick={() => todos.filter.set('all')}
						>
							All
						</a>
					</li>
					<li>
						<a
							className={todos.filter.value === 'active' ? 'selected' : undefined}
							href="#/active"
							onClick={() => todos.filter.set('active')}
						>
							Active
						</a>
					</li>
					<li>
						<a
							className={todos.filter.value === 'completed' ? 'selected' : undefined}
							href="#/completed"
							onClick={() => todos.filter.set('completed')}
						>
							Completed
						</a>
					</li>
				</ul>
				<button className="clear-completed" onClick={todos.clearCompleted}>
					Clear completed
				</button>
			</footer>
		</section>
	)
})

export default App
