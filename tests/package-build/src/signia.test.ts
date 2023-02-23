import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { setupTestProject } from './setupTestProject'

test('i can import `atom` and use it in a .mjs file', () => {
	const { dir } = setupTestProject('signia')
	writeFileSync(
		`${dir}/test.mjs`,
		`import s from 'signia'; console.log(s.atom('test', 'value').value)`
	)
	const output = execSync(`node test.mjs`, { cwd: dir, encoding: 'utf8' }).trim()
	expect(output).toBe('value')
})

test('i can import `atom` and use it in a .ts file and typescript is cool with that', () => {
	const { dir } = setupTestProject('signia', ['typescript'])
	execSync('npx tsc --init', { cwd: dir })
	writeFileSync(
		`${dir}/test.ts`,
		`import {atom} from 'signia'; console.log(atom('test', 'value').value)`
	)
	execSync('npx tsc', { cwd: dir })
	const output = execSync(`node test.js`, { cwd: dir, encoding: 'utf8' }).trim()
	expect(output).toBe('value')
})
