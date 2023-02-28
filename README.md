<div alt style="text-align: center; transform: scale(.5);">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://github.com/tldraw/signia/raw/main/assets/hero-dark@2x.png" />
		<img alt="Signia" src="https://github.com/tldraw/signia/raw/main/assets/hero-light@2x.png" />
	</picture>
</div>

**Signia** is a small, fast, and scaleable signals library for JavaScript and TypeScript.

It uses an epochal pull-based (i.e. lazy) reactivity model that provides a lot of leverage to keep performance high and spaghetti low as the size and complexity of an application grows.

Check the [docs](https://tldraw.github.io/signia)

## What are signals?

## How is Signia different?

The key difference is scalability. Signia uses a unique reactivity model which allows signals to emit both ordinary values, and 'deltas' between successive values over time.

Imagine something like the following:

```ts
const todos = atom([{ title: 'buy milk', completed: false}, ...])
const incompleteTodos = computed(() => todos.value.filter(t => !t.completed))
```

Every time you add a new todo item, `incompleteTodos` will be recomputed from scratch, running the filter predicate on all todo items regardless of whether they have changed.

With Signia, you can get only the changes since last time, and do with them what you like.
