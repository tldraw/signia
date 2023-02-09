/* eslint-disable no-console */

import { execSync } from 'child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import kleur from 'kleur'
import path from 'path'
import { pathToFileURL } from 'url'
import { buildPackage } from './build-package'

function isPackageJsonClean({ sourcePackageDir }: { sourcePackageDir: string }) {
	const gitStatus = execSync('git status --porcelain package.json', { cwd: sourcePackageDir })
		.toString()
		.trim()
	return !gitStatus
}

/**
 * Prepares the package for publishing. the tarball in case it will be written to disk.
 *
 * @param param0
 * @returns
 */
export async function preparePackage({ sourcePackageDir }: { sourcePackageDir: string }) {
	if (!existsSync(path.join(sourcePackageDir, 'src/index.ts'))) {
		throw new Error(`No src/index.ts file found in '${sourcePackageDir}'!`)
	}

	if (process.env.ALLOW_DIRTY_PACK !== 'true' && !isPackageJsonClean({ sourcePackageDir })) {
		console.error(kleur.red(`File '${sourcePackageDir}/package.json' is not clean!`))
		console.error()
		console.error(kleur.red('Please commit all changes before publishing, or set'))
		console.error()
		console.error(kleur.bold('   ALLOW_DIRTY_PACK=true'))
		console.error()
		process.exit(1)
	}

	const manifest = JSON.parse(readFileSync(path.join(sourcePackageDir, 'package.json'), 'utf8'))

	await buildPackage({ sourcePackageDir })

	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(sourcePackageDir, 'index.d.ts')
	)

	// construct the final package.json
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const newManifest = structuredClone({
		...manifest,
		main: 'dist/index.js',
		module: 'dist/index.mjs',
		source: 'dist/index.ts',
		types: 'index.d.ts',
		files: ['dist', 'index.d.ts'],
	})
	writeFileSync(
		path.join(sourcePackageDir, 'package.json'),
		JSON.stringify(newManifest, null, `\t`)
	)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	;(async () => {
		await preparePackage({
			sourcePackageDir: path.resolve(path.normalize(process.argv[2] ?? process.cwd())),
		})
	})()
}
