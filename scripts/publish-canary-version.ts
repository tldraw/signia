/* eslint-disable no-console */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { parse } from 'semver'
import { pathToFileURL } from 'url'

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	const bumpType = process.argv[2] as 'major' | 'minor' | 'patch'
	if (!bumpType) {
		throw new Error('No bump type provided')
	} else if (!['major', 'minor', 'patch'].includes(bumpType)) {
		throw new Error('Invalid bump type provided')
	}

	const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))

	if (packageJson.private) {
		console.log('Skipping canary publish for private package', packageJson.name)
		process.exit(0)
	}

	const currentVerison = parse(packageJson.version)

	const nextVersion = currentVerison?.inc(bumpType)

	if (!nextVersion) {
		throw new Error('Could not parse current version')
	}

	const sha = execSync('git rev-parse --short HEAD').toString().trim()

	const versionString = `${nextVersion.major}.${nextVersion.minor}.${nextVersion.patch}-canary.${sha}`

	console.log(`Setting ${packageJson.name} version to ${versionString}`)

	writeFileSync('package.json', JSON.stringify({ ...packageJson, version: versionString }, null, 2))

	execSync('npm publish --tag canary')
}
