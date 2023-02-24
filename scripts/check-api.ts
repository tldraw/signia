/* eslint-disable no-console */

import { readdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { exec } from './lib/exec'
import { readFileIfExists, readJsonIfExists } from './lib/file'

const packagesOurTypesCanDependOn = ['@types/react', '@types/react-dom']

main()

async function main() {
	await exec('pnpm', ['build'])

	const ownPackageJson = await readJsonIfExists('package.json')
	if (!ownPackageJson) throw new Error('No package.json found')

	const tsconfig: any = {
		compilerOptions: {
			lib: ['es2015', 'dom'],
			strict: true,
			rootDir: '.',
			paths: {},
			esModuleInterop: true,
		},
		files: [],
	}

	const tempDir = (await exec('mktemp', ['-d'])).trim()
	console.log(`Working in ${tempDir}`)

	for (const packageName of readdirSync('packages')) {
		const packageJson = await readJsonIfExists(`packages/${packageName}/package.json`)
		if (!packageJson) continue

		const dtsFile = await readFileIfExists(`packages/${packageName}/api/public.d.ts`)
		if (!dtsFile) {
			console.log(`No public.d.ts for ${packageJson.name}, skipping`)
			continue
		}

		writeFileSync(`${tempDir}/${packageName}.d.ts`, dtsFile, 'utf8')
		tsconfig.compilerOptions.paths[packageJson.name] = [`./${packageName}.d.ts`]
		tsconfig.files.push(`./${packageName}.d.ts`)
	}

	console.log('Checking with tsconfig:', tsconfig)
	writeFileSync(`${tempDir}/tsconfig.json`, JSON.stringify(tsconfig, null, '\t'), 'utf8')
	writeFileSync(`${tempDir}/package.json`, JSON.stringify({ dependencies: {} }, null, '\t'), 'utf8')

	await exec('pnpm', ['add', ...packagesOurTypesCanDependOn], { pwd: tempDir })
	await exec(resolve('./node_modules/.bin/tsc'), [], { pwd: tempDir })

	await exec('rm', ['-rf', tempDir])
}
