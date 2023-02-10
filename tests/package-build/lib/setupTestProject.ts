import { execSync } from 'child_process'
import tmp from 'tmp'

export function setupTestProject(packageName: string, otherPackages: string[] = []) {
	const dir = tmp.dirSync({ unsafeCleanup: true })

	const tgzFilename = execSync(`npm pack --pack-destination ${dir.name}`, {
		cwd: '../../packages/' + packageName,
	})
		.toString()
		.trim()
		.split(/\s+/g)
		.pop()!

	execSync(`npm init -y`, { cwd: dir.name })
	execSync(`npm install file:./${tgzFilename} ${otherPackages.join(' ')}`, { cwd: dir.name })

	return { dir: dir.name, tgzFilename }
}
