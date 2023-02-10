/* eslint-disable no-console */

import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { buildPackage } from './build-package'

/**
 * Prepares the package for publishing. the tarball in case it will be written to disk.
 *
 * @param param0
 * @returns
 */
export async function preparePackage({ sourcePackageDir }: { sourcePackageDir: string }) {
	if (!existsSync(path.join(sourcePackageDir, 'lib/index.ts'))) {
		throw new Error(`No lib/index.ts file found in '${sourcePackageDir}'!`)
	}

	const manifest = JSON.parse(readFileSync(path.join(sourcePackageDir, 'package.json'), 'utf8'))

	await buildPackage({ sourcePackageDir })

	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(sourcePackageDir, 'index.d.ts')
	)

	// save package.json and reinstate it in postpack
	copyFileSync(
		path.join(sourcePackageDir, 'package.json'),
		path.join(sourcePackageDir, 'package.json.bak')
	)

	// construct the final package.json
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const newManifest = structuredClone({
		// filter out comments
		...Object.fromEntries(Object.entries(manifest).filter(([key]) => !key.startsWith('/*'))),
		main: 'lib/index.js',
		module: 'lib/index.mjs',
		source: 'lib/index.ts',
		types: 'index.d.ts',
		files: ['lib', 'index.d.ts'],
	})
	writeFileSync(
		path.join(sourcePackageDir, 'package.json'),
		JSON.stringify(newManifest, null, `\t`)
	)

	// swap out lib with dist
	renameSync(path.join(sourcePackageDir, 'lib'), path.join(sourcePackageDir, 'lib.bak'))
	renameSync(path.join(sourcePackageDir, 'dist'), path.join(sourcePackageDir, 'lib'))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	;(async () => {
		await preparePackage({
			sourcePackageDir: path.resolve(path.normalize(process.argv[2] ?? process.cwd())),
		})
	})()
}
