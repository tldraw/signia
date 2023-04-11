// @ts-check

/** @type {import('lazyrepo').LazyConfig} */
export default {
	tasks: {
		test: {
			cache: {
				inputs: ['src/**/*.ts'],
			},
		},
	},
}
