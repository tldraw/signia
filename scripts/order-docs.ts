/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

type Ordering = Array<string | [string, Ordering] | [string]>

function orderDocs(packageName: string) {
	const orderingFile = join('packages', packageName, 'docs-ordering.json')
	if (!existsSync(orderingFile)) {
		return
	}
	console.log('Ordering docs for ' + packageName)

	const ordering: Ordering = JSON.parse(readFileSync(orderingFile, 'utf8'))

	function applyOrdering(ordering: Ordering, filesDir: string) {
		for (const entry of ordering) {
			if (Array.isArray(entry)) {
				const [dirName, subOrdering] = entry
				const dirPath = join(filesDir, dirName)
				if (!statSync(dirPath).isDirectory()) {
					throw new Error(`Dir ${dirPath} does not exist`)
				}
				writeFileSync(join(dirPath, '_category_.yml'), `position: ${ordering.indexOf(entry)}`)
				if (subOrdering) {
					applyOrdering(subOrdering, dirPath)
				}
			} else {
				const filePath = join(filesDir, entry + '.md')
				if (!existsSync(filePath)) {
					throw new Error(`File ${filePath} does not exist`)
				}
				console.log('Ordering file ' + filePath)
				writeFileSync(
					filePath,
					`---\nsidebar_position: ${ordering.indexOf(entry)}\n---\n\n` +
						readFileSync(filePath, 'utf8')
				)
			}
		}
	}

	applyOrdering(ordering, `docs/docs/API/${packageName.replace(/-/g, '_')}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	// module was called directly
	for (const packageName of readdirSync('packages')) {
		orderDocs(packageName)
	}
}
