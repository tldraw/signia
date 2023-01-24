import { defineConfig } from 'tsup'

export default defineConfig((options) => {
	return {
		entry: ['src/index.ts'],
		splitting: false,
		sourcemap: true,
		clean: true,
		dts: true,
		format: ['esm', 'cjs'],
		minify: !options.watch,
		tsconfig: 'tsconfig.build.json',
	}
})
