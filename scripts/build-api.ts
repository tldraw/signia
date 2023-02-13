import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import glob from 'glob'
import isCI from 'is-ci'
import path from 'path'
import { rimraf } from 'rimraf'

/**
 * Builds the typescript types for the given package. This means first running tsc to build the
 * typescript, then running api-extractor to generate the public types, then copying the public
 * types to the root of the destination package.
 */
export async function buildApi({ sourcePackageDir }: { sourcePackageDir: string }) {
	// clear typecsript build files if running locally
	if (!isCI) {
		rimraf.sync(path.join(sourcePackageDir, '.tsbuild'))
		rimraf.sync(glob.sync(path.join(sourcePackageDir, '*.tsbuildinfo')))
	}
	// build typescript again
	writeFileSync(
		path.join(sourcePackageDir, 'tsconfig.build.json'),
		JSON.stringify(
			{
				...JSON.parse(readFileSync(path.join(sourcePackageDir, 'tsconfig.json'), 'utf8')),
				extends: './tsconfig.json',
				exclude: ['node_modules', 'src/**/*.test.ts', '**/__tests__/**', '.tsbuild'],
			},
			null,
			2
		)
	)
	execSync('../../node_modules/.bin/tsc --build tsconfig.build.json', {
		stdio: 'inherit',
		cwd: sourcePackageDir,
	})
	// clear api-extractor build files
	rimraf.sync(glob.sync(path.join(sourcePackageDir, 'api')))
	// extract public api
	execSync('../../node_modules/.bin/api-extractor run --local', {
		stdio: 'inherit',
		cwd: sourcePackageDir,
	})

	rimraf.sync(path.join(sourcePackageDir, 'tsconfig.build.json'))
}
