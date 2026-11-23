// Generates fixtures/filesystem.d3.json: a made-up file system tree with ~10k nodes,
// the same on every run (seeded random numbers). Every node has
//   name, type ('dir' | 'file'),
//   size   bytes (a folder: the sum of everything below it),
//   files  number of files (a file: 1, a folder: all files below it),
//   dirs   number of folders below (a file: 0).
// Usage (in test/): node fixtures/gen-filesystem.mjs [targetNodes]
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const target = Number(process.argv[2] || 10000)

// mulberry32: small seeded PRNG
let seed = 20261123
const rand = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
}
const pick = a => a[Math.floor(rand() * a.length)]
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())

// folder kinds: names of subfolders and the file types found in them
const kinds = {
    root:     { dirs: ['home', 'usr', 'var', 'opt', 'etc', 'tmp'], files: [] },
    home:     { dirs: ['alice', 'bob', 'carol', 'dave'], files: [] },
    user:     { dirs: ['Documents', 'Pictures', 'Music', 'Videos', 'projects', 'Downloads', '.cache'], files: ['text'] },
    docs:     { dirs: ['2023', '2024', '2025', 'invoices', 'letters', 'archive'], files: ['text', 'office', 'pdf'] },
    pictures: { dirs: ['holidays', 'family', 'screenshots', 'raw', '2024', '2025'], files: ['image'] },
    music:    { dirs: ['rock', 'jazz', 'classical', 'podcasts', 'live'], files: ['audio'] },
    videos:   { dirs: ['movies', 'clips', 'recordings'], files: ['video'] },
    projects: { dirs: ['src', 'test', 'docs', 'build', 'node_modules', 'assets', 'lib', 'scripts'], files: ['code', 'text'] },
    code:     { dirs: ['components', 'models', 'utils', 'api', 'styles', 'core', 'internal'], files: ['code'] },
    modules:  { dirs: ['d3', 'react', 'lodash', 'vite', 'typescript', 'eslint', 'sass', 'xml2js', 'chalk', 'debug'], files: ['code', 'text'] },
    cache:    { dirs: ['thumbnails', 'fonts', 'browser', 'npm'], files: ['binary'] },
    system:   { dirs: ['bin', 'lib', 'share', 'include', 'local', 'log', 'cache', 'spool'], files: ['binary', 'text'] },
}
const kindOf = (parentKind, name) => ({
    home: 'user', usr: 'system', var: 'system', opt: 'projects', etc: 'system', tmp: 'cache',
    alice: 'user', bob: 'user', carol: 'user', dave: 'user',
    Documents: 'docs', Pictures: 'pictures', Music: 'music', Videos: 'videos', projects: 'projects',
    Downloads: 'docs', '.cache': 'cache', src: 'code', lib: 'code', test: 'code', node_modules: 'modules',
})[name] || (parentKind === 'modules' ? 'projects' : parentKind)

// file types: extensions and log-normal sizes (median e^mu bytes)
const fileTypes = {
    text:   { ext: ['txt', 'md', 'json', 'yml', 'csv'], mu: 8,  sigma: 1.5, names: ['notes', 'readme', 'config', 'data', 'todo', 'changelog', 'list'] },
    office: { ext: ['docx', 'xlsx', 'pptx', 'odt'],     mu: 11, sigma: 1.2, names: ['report', 'budget', 'slides', 'letter', 'plan', 'minutes'] },
    pdf:    { ext: ['pdf'],                             mu: 12, sigma: 1.3, names: ['invoice', 'contract', 'manual', 'paper', 'statement'] },
    image:  { ext: ['jpg', 'png', 'heic', 'cr2'],       mu: 14.5, sigma: 1.0, names: ['IMG', 'DSC', 'photo', 'scan', 'screenshot'] },
    audio:  { ext: ['mp3', 'flac', 'm4a'],              mu: 15.5, sigma: 0.8, names: ['track', 'song', 'episode', 'take'] },
    video:  { ext: ['mp4', 'mkv', 'mov'],               mu: 19.5, sigma: 1.2, names: ['movie', 'clip', 'recording', 'VID'] },
    code:   { ext: ['ts', 'js', 'mjs', 'scss', 'html', 'py'], mu: 8.3, sigma: 1.1, names: ['index', 'main', 'util', 'app', 'model', 'view', 'layer', 'test'] },
    binary: { ext: ['bin', 'so', 'dat', 'cache', 'db'], mu: 12.5, sigma: 2.2, names: ['lib', 'data', 'blob', 'index', 'store'] },
}

let count = 0
function makeFile(type) {
    const t = fileTypes[type]
    count++
    const name = `${pick(t.names)}${rand() < .6 ? '-' + int(1, 999) : ''}.${pick(t.ext)}`
    return { name, type: 'file', size: Math.max(1, Math.round(Math.exp(t.mu + t.sigma * normal()))), files: 1, dirs: 0 }
}
function makeDir(name, kind, depth) {
    count++
    const k = kinds[kind]
    const node = { name, type: 'dir', children: [] }
    // fewer subfolders deeper down; stop when the target is reached
    const nDirs = depth === 0 ? k.dirs.length : depth === 1 ? k.dirs.length : Math.max(0, int(0, Math.round(6 - depth * 1.2)))
    const names = [...k.dirs].sort(() => rand() - .5).slice(0, Math.min(nDirs, k.dirs.length))
    for (const sub of names) {
        if (count >= target) break
        node.children.push(makeDir(sub, kindOf(kind, sub), depth + 1))
    }
    if (k.files.length && count < target) {
        const nFiles = int(0, depth < 2 ? 4 : 22)
        for (let i = 0; i < nFiles && count < target; i++) node.children.push(makeFile(pick(k.files)))
    }
    if (!node.children.length) delete node.children
    return node
}

// several rounds over the top folders until the target is reached (more users, more projects)
const root = makeDir('/', 'root', 0)
let round = 0
while (count < target && round < 500) {
    round++
    const users = root.children.find(c => c.name === 'home')
    users.children.push(makeDir(`user${round}`, 'user', 1))
}

// sums bottom-up
function sum(n) {
    if (!n.children) { if (n.type === 'dir') Object.assign(n, { size: 0, files: 0, dirs: 0 }); return n }
    let size = 0, files = 0, dirs = 0
    for (const c of n.children) {
        sum(c)
        size += c.size; files += c.files; dirs += c.dirs + (c.type === 'dir' ? 1 : 0)
    }
    Object.assign(n, { size, files, dirs })
    return n
}
sum(root)

const out = fileURLToPath(new URL('filesystem.d3.json', import.meta.url))
writeFileSync(out, JSON.stringify(root))
console.log(`${count} nodes, ${root.files} files, ${root.dirs} folders, ${(root.size / 2 ** 30).toFixed(1)} GiB -> ${out}`)
