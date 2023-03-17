/* eslint-disable no-console */

import { build } from 'esbuild'
import { existsSync } from 'fs'
import glob from 'glob'
import kleur from 'kleur'
import path from 'path'
import rimraf from 'rimraf'
import { pathToFileURL } from 'url'
import { buildApi } from './build-api'

/**
 * Prepares the package for publishing. the tarball in case it will be written to disk.
 *
 * @param param0
 * @returns
 */
export async function buildPackage({ sourcePackageDir }: { sourcePackageDir: string }) {
	if (!existsSync(path.join(sourcePackageDir, 'src/index.ts'))) {
		throw new Error(`No src/index.ts file found in '${sourcePackageDir}'!`)
	}

	rimraf.sync(path.join(sourcePackageDir, 'dist'))

	// first build the public .d.ts file
	await buildApi({ sourcePackageDir })

	// then copy over the source .ts files
	const sourceFiles = glob
		.sync(path.join(sourcePackageDir, 'src/**/*.ts?(x)'))
		// ignore test files
		.filter((file) => !(file.includes('__tests__') || file.includes('.test.ts')))

	// build js files to /dist
	await buildEsm({ sourceFiles, sourcePackageDir })
	await buildCjs({ sourceFiles, sourcePackageDir })
}

/** This uses esbuild to build the esm version of the package */
async function buildEsm({
	sourceFiles,
	sourcePackageDir,
}: {
	sourceFiles: string[]
	sourcePackageDir: string
}) {
	const res = await build({
		entryPoints: sourceFiles,
		outdir: path.join(sourcePackageDir, 'dist/esm'),
		bundle: true,
		platform: 'neutral',
		sourcemap: true,
		format: 'esm',
		outExtension: { '.js': '.mjs' },
		plugins: [
			{
				name: 'add-mjs',
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (args.importer) return { path: args.path.replace(/\.js$/, '.mjs'), external: true }
					})
				},
			},
		],
	})

	if (res.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		throw new Error('esm build failed')
	}
}

/** This uses esbuild to build the cjs version of the package */
async function buildCjs({
	sourceFiles,
	sourcePackageDir,
}: {
	sourceFiles: string[]
	sourcePackageDir: string
}) {
	const res = await build({
		entryPoints: sourceFiles,
		outdir: path.join(sourcePackageDir, 'dist/cjs'),
		bundle: true,
		platform: 'neutral',
		sourcemap: true,
		format: 'cjs',
		outExtension: { '.js': '.cjs' },
		plugins: [
			{
				name: 'add-cjs',
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (args.importer) return { path: args.path.replace(/\.js$/, '.cjs'), external: true }
					})
				},
			},
		],
	})

	if (res.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		throw new Error('commonjs build failed')
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	;(async () => {
		await buildPackage({
			sourcePackageDir: path.resolve(path.normalize(process.argv[2] ?? process.cwd())),
		})
	})()
}
