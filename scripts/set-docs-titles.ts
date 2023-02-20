import { readFileSync, writeFileSync } from 'fs'

for (const packageName of ['tlstate', 'tlstate-react']) {
	const indexFile = `docs/docs/${packageName}/index.md`
	const contents = readFileSync(indexFile, 'utf8')

	// remove first line and add frontmatter
	const frontmatter = `---
title: ${packageName}
---
`
	const newContents = frontmatter + contents.split(/\r?\n/g).slice(1).join('\n')
	writeFileSync(indexFile, newContents)
}
