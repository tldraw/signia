/* eslint-disable no-undef */

import fs from 'fs'
import { gzipSizeSync } from 'gzip-size'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, 'dist', 'index.js')
const size = fs.statSync(file).size
const gzipped = gzipSizeSync(fs.readFileSync(file, 'utf8'))

const { log } = console
const inKb = (bytes) => (bytes / 1024).toFixed(2)
log(`✅ @tldraw/tlstate-react: ${inKb(size)}kb / ${inKb(gzipped)}kb gzipped`)
