/* eslint-disable no-console */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
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
	if (!existsSync(path.join(sourcePackageDir, 'src/index.ts'))) {
		throw new Error(`No src/index.ts file found in '${sourcePackageDir}'!`)
	}

	const manifest = JSON.parse(readFileSync(path.join(sourcePackageDir, 'package.json'), 'utf8'))

	await buildPackage({ sourcePackageDir })

	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(sourcePackageDir, 'dist/cjs/index.d.cts')
	)

	copyFileSync(
		path.join(sourcePackageDir, `api/public.d.ts`),
		path.join(sourcePackageDir, 'dist/esm/index.d.mts')
	)

	// save package.json and reinstate it in postpack
	copyFileSync(
		path.join(sourcePackageDir, 'package.json'),
		path.join(sourcePackageDir, 'package.json.bak')
	)

	// construct the final package.json
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const newManifest = structuredClone({
		// filter out comments and `types`
		...Object.fromEntries(
			Object.entries(manifest).filter(([key]) => !key.startsWith('/*') && key !== 'types')
		),
		main: 'dist/cjs/index.cjs',
		module: 'dist/esm/index.mjs',
		source: 'src/index.ts',
		exports: {
			'.': {
				import: './dist/esm/index.mjs',
				require: './dist/cjs/index.cjs',
			},
		},
		files: ['dist', 'src'],
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
