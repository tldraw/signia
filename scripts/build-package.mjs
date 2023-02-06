#!/usr/bin/env node

import { build } from 'esbuild'
import { existsSync, readFileSync, statSync } from 'fs'
import glob from 'glob'
import { gzipSizeSync } from 'gzip-size'
import kleur from 'kleur'
import rimraf from 'rimraf'

if (!existsSync('src/index.ts')) {
	console.error(kleur.red('No src/index.ts file found!'))
	process.exit(1)
}

const packageName = process.cwd().split('/').pop()
const minifiedBundleName = `dist/${packageName}.min.js`

const files = glob
	.sync('src/**/*.ts?(x)')
	// ignore test files
	.filter((file) => !(file.includes('__tests__') || file.includes('.test.ts')))

async function run() {
	rimraf('dist')

	const res = await build({
		entryPoints: files,
		outdir: 'dist',
		bundle: false,
		platform: 'neutral',
		sourcemap: true,
		format: 'esm',
		outExtension: { '.js': '.mjs' },
	})

	if (res.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		process.exit(1)
	}

	const res2 = await build({
		entryPoints: files,
		outdir: 'dist',
		bundle: false,
		platform: 'neutral',
		sourcemap: true,
		format: 'cjs',
	})

	if (res2.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		process.exit(1)
	}

	const bundleRes = await build({
		entryPoints: ['src/index.ts'],
		outfile: minifiedBundleName,
		bundle: true,
		platform: 'neutral',
		sourcemap: true,
		minify: true,
	})

	if (bundleRes.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(bundleRes.errors)
		process.exit(1)
	}

	const size = statSync(minifiedBundleName).size

	const gzippedSize = gzipSizeSync(readFileSync(minifiedBundleName, 'utf8'))

	const inKb = (/** @type {number} */ bytes) => (bytes / 1024).toFixed(2)
	console.log(kleur.bold().green('Build succeeded!'))
	console.log(`Total bundled size: ${kleur.bold(inKb(size))} kb`)
	console.log(`Total bundled gzipped size: ${kleur.bold(kleur.green(inKb(gzippedSize)))} kb`)
}

run()
