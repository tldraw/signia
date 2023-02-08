/* eslint-disable no-console */

import Arborist from '@npmcli/arborist'
import { build } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import glob from 'glob'
import kleur from 'kleur'
import pacote, { Manifest } from 'pacote'
import path from 'path'
import tmp from 'tmp'
import { pathToFileURL } from 'url'
import { buildApi } from './build-api'

/**
 * Builds the package in the given dir, returning the tarball (in memory) and a filename for
 * the tarball in case it will be written to disk.
 * @param param0
 * @returns
 */
export async function buildPackage({ sourcePackageDir }: { sourcePackageDir: string }) {
	if (!existsSync(path.join(sourcePackageDir, 'src/index.ts'))) {
		throw new Error(`No src/index.ts file found in '${sourcePackageDir}'!`)
	}

	// The way this works is by creating a temporary directory and copying/generating all the files we
	// want to publish into the temporary directory. Then we build a tarball from the temporary directory.
	const { name: destPackageDir } = tmp.dirSync({ unsafeCleanup: true })

	const manifest = JSON.parse(readFileSync(path.join(sourcePackageDir, 'package.json'), 'utf8'))
	const packageName = path.basename(manifest.name)
	const packageVersion = manifest.version

	// first build the public .d.ts file
	await buildApi({ sourcePackageDir })
	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(destPackageDir, 'index.d.ts')
	)

	// then copy over the source .ts files
	const sourceFiles = glob
		.sync(path.join(sourcePackageDir, 'src/**/*.ts?(x)'))
		// ignore test files
		.filter((file) => !(file.includes('__tests__') || file.includes('.test.ts')))
	copySourceFilesToDest({ sourcePackageDir, sourceFiles, destPackageDir })

	// build js files
	await buildEsm({ sourceFiles, destPackageDir })
	await buildCjs({ sourceFiles, destPackageDir })

	// construct the final package.json
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const newManifest = structuredClone({
		...manifest,
		main: 'src/index.js',
		module: 'src/index.mjs',
		source: 'src/index.ts',
		types: 'index.d.ts',
		files: ['src', 'index.d.ts'],
	})
	replaceSiblingPackageVersions({ manifest: newManifest, sourcePackageDir })
	writeFileSync(path.join(destPackageDir, 'package.json'), JSON.stringify(newManifest, null, 2))

	// copy over the readme
	copyFileSync(path.join(sourcePackageDir, 'README.md'), path.join(destPackageDir, `README.md`))
	// TODO: add license

	// build the tarball
	const tarball = await buildTarball({ destPackageDir })
	const tarballName = `${packageName}-${packageVersion}.tgz`

	return { tarball, tarballName }
}

/**
 * Mutates a package.json to make sure any 'sibling' dependencies are using the current version
 *
 * e.g.
 *
 *   "@tldraw/tlstate": "workspace:*"
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
		outdir: path.join(destPackageDir, 'src'),
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
		outdir: path.join(destPackageDir, 'src'),
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
