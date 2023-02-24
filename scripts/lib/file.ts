import { readFile } from 'fs/promises'

export async function readJsonIfExists(file: string) {
	try {
		return JSON.parse(await readFile(file, 'utf8'))
	} catch {
		return null
	}
}

export async function readFileIfExists(file: string) {
	try {
		return await readFile(file, 'utf8')
	} catch {
		return null
	}
}
