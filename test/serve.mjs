// Minimal static file server for the repo root (no dependencies).
// Usage: node serve.mjs [port]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const port = Number(process.argv[2] || process.env.PORT || 4180)

const types = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map':  'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.xml':  'application/xml',
    '.csv':  'text/csv',
}

createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
        if (path.endsWith('/')) path += 'index.html'
        const file = normalize(join(root, path))
        if (!file.startsWith(root)) { res.writeHead(403).end(); return }
        if (!(await stat(file)).isFile()) throw new Error('not a file')
        res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream' })
        res.end(await readFile(file))
    } catch {
        res.writeHead(404).end('not found')
    }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`))
