#!/usr/bin/env node
/* eslint-disable no-console */

import Arborist from '@npmcli/arborist'
import { execSync } from 'child_process'
import { build } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import glob from 'glob'
import kleur from 'kleur'
import pacote, { Manifest } from 'pacote'
import path from 'path'
import rimraf from 'rimraf'
import tmp from 'tmp'

/**
 * Builds the package in the given dir, returning the tarball (in memory) and a filename for
 * the tarball in case it will be written to disk.
 * @param param0
 * @returns
 */
export async function buildPackage({ sourcePackageDir }: { sourcePackageDir: string }) {
	// sanity chekcs
	if (!existsSync(path.join(sourcePackageDir, 'src/index.ts'))) {
		throw new Error(`No src/index.ts file found in '${sourcePackageDir}'!`)
	}

	// The way this works is by creating a temporary directory and copying/generating all the files we
	// want to publish into the temporary directory. Then we build a tarball from the temporary directory.
	const { name: destPackageDir } = tmp.dirSync({ unsafeCleanup: true })

	const manifest = JSON.parse(readFileSync(path.join(sourcePackageDir, 'package.json'), 'utf8'))
	const packageName = path.basename(manifest.name)
	const packageVersion = manifest.version

	const sourceFiles = glob
		.sync(path.join(sourcePackageDir, 'src/**/*.ts?(x)'))
		// ignore test files
		.filter((file) => !(file.includes('__tests__') || file.includes('.test.ts')))

	await buildTypes({ sourcePackageDir, destPackageDir })

	copySourceFilesToDest({ sourcePackageDir, sourceFiles, destPackageDir })

	copyFileSync(path.join(sourcePackageDir, 'README.md'), path.join(destPackageDir, `README.md`))

	await buildEsm({ sourceFiles, destPackageDir })
	await buildCjs({ sourceFiles, destPackageDir })

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { scripts, devDependencies, ...others } = manifest

	const newManifest = structuredClone({
		...others,
		main: 'cjs/index.js',
		module: 'esm/index.mjs',
		source: 'src/index.ts',
		types: 'index.d.ts',
		files: ['src', 'index.d.ts'],
	})

	replaceSiblingPackageVersions({ manifest: newManifest, sourcePackageDir })

	writeFileSync(path.join(destPackageDir, 'package.json'), JSON.stringify(newManifest, null, 2))

	const tarball = await buildTarball({ destPackageDir })

	const tarballName = `${packageName}-${packageVersion}.tgz`

	return { tarball, tarballName }
}

/**
 * Mutates a package.json to make sure any 'sibling' dependencies are using the current version
 *
 * e.g.
 *
 *   "@tldraw/tlstate": "*"
 *
 * becomes
 *
 *  "@tldraw/tlstate": "1.2.3"
 */
function replaceSiblingPackageVersions({
	manifest,
	sourcePackageDir,
}: {
	manifest: Manifest
	sourcePackageDir: string
}) {
	const allMonorepoPackageVersions = glob
		.sync(path.join(sourcePackageDir, '../*/package.json'))
		.map((f) => JSON.parse(readFileSync(f, 'utf8')))
		.reduce((acc, { name, version }) => {
			acc[name] = version
			return acc
		}, {})

	for (const deps of [
		manifest.dependencies,
		manifest.peerDependencies,
		manifest.optionalDependencies,
	]) {
		if (!deps) continue
		for (const dep of Object.keys(deps)) {
			if (allMonorepoPackageVersions[dep]) {
				deps[dep] = allMonorepoPackageVersions[dep]
			}
		}
	}
}

/**
 * Builds the typescript types for the given package.
 * This means first running tsc to build the typescript, then running api-extractor to generate the
 * public types, then copying the public types to the root of the destination package.
 */
async function buildTypes({
	sourcePackageDir,
	destPackageDir,
}: {
	sourcePackageDir: string
	destPackageDir: string
}) {
	// clear typecsript build cache
	rimraf.sync(path.join(sourcePackageDir, '.tsbuild'))
	rimraf.sync(glob.sync(path.join(sourcePackageDir, '*.tsbuildinfo')))
	// build typescript again
	execSync('../../node_modules/.bin/tsc --build tsconfig.build.json', {
		stdio: 'inherit',
		cwd: sourcePackageDir,
	})
	execSync('../../node_modules/.bin/api-extractor run --local', {
		stdio: 'inherit',
		cwd: sourcePackageDir,
	})
	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(destPackageDir, 'index.d.ts')
	)
}

/**
 * This just copies all the src typescript files to the destination package
 */
async function copySourceFilesToDest({
	destPackageDir,
	sourcePackageDir,
	sourceFiles,
}: {
	destPackageDir: string
	sourcePackageDir: string
	sourceFiles: string[]
}) {
	for (const file of sourceFiles) {
		const dest = file.replace(sourcePackageDir, destPackageDir)
		const destDir = path.dirname(dest)
		if (!existsSync(destDir)) {
			mkdirSync(destDir, { recursive: true })
		}
		copyFileSync(file, dest)
	}
}

/**
 * This uses esbuild to build the esm version of the package
 */
async function buildEsm({
	sourceFiles,
	destPackageDir,
}: {
	sourceFiles: string[]
	destPackageDir: string
}) {
	const res = await build({
		entryPoints: sourceFiles,
		outdir: path.join(destPackageDir, 'esm'),
		bundle: false,
		platform: 'neutral',
		sourcemap: true,
		format: 'esm',
		outExtension: { '.js': '.mjs' },
	})

	if (res.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		throw new Error('esm build failed')
	}
}

/**
 * This uses esbuild to build the cjs version of the package
 */
async function buildCjs({
	sourceFiles,
	destPackageDir,
}: {
	sourceFiles: string[]
	destPackageDir: string
}) {
	const res = await build({
		entryPoints: sourceFiles,
		outdir: path.join(destPackageDir, 'cjs'),
		bundle: false,
		platform: 'neutral',
		sourcemap: true,
		format: 'cjs',
	})

	if (res.errors.length) {
		console.error(kleur.red('Build failed with errors:'))
		console.error(res.errors)
		throw new Error('commonjs build failed')
	}
}

async function buildTarball({ destPackageDir }: { destPackageDir: string }) {
	return await pacote.tarball('file:' + destPackageDir, { Arborist })
}

import { pathToFileURL } from 'url'

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	;(async () => {
		const { tarballName, tarball } = await buildPackage({
			sourcePackageDir: path.resolve(path.normalize(process.argv[2] ?? process.cwd())),
		})
		writeFileSync(tarballName, tarball)
		console.log(kleur.bold().green('Package built at'), kleur.bold(tarballName))
	})()
}
