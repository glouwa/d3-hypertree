// Generates fixtures/filesystem.d3.json: a made-up file system tree with 10k nodes,
// the same on every run (seeded random numbers). Every node has
//   name, type ('dir' | 'file'),
//   size   bytes (a folder: the sum of everything below it),
//   files  number of files (a file: 1, a folder: all files below it),
//   dirs   number of folders below (a file: 0).
//
// Like real file systems, sizes and counts are heavy-tailed: most files are small,
// a few are huge (videos, disk images, databases); most folders hold a few files,
// a few hold thousands (node_modules, photo dumps, caches, logs). Only some folders
// are both (raw photos): node_modules has many tiny files, videos few huge ones.
//
// Usage (in test/): node fixtures/gen-filesystem.mjs [targetNodes]
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const target = Number(process.argv[2] || 10000)

// mulberry32: small seeded PRNG
const SEED = 20261123
let seed = SEED
let scale = 1   // scales the file counts so the tree lands near the target (see below)
const rand = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
}
const pick = a => a[Math.floor(rand() * a.length)]
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())
// Pareto: xmin * u^(-1/alpha); small alpha = heavier tail
const pareto = (xmin, alpha, max) => Math.min(max, Math.floor(xmin * Math.pow(1 - rand(), -1 / alpha)))

// file types: extensions, log-normal sizes (median e^mu bytes) and a share of
// outliers that are many times bigger (Pareto factor)
const fileTypes = {
    text:   { ext: ['txt', 'md', 'json', 'yml', 'csv'], mu: 7.5, sigma: 1.6, tail: .02, names: ['notes', 'readme', 'config', 'data', 'todo', 'changelog', 'list'] },
    office: { ext: ['docx', 'xlsx', 'pptx', 'odt'],     mu: 10.5, sigma: 1.3, tail: .03, names: ['report', 'budget', 'slides', 'letter', 'plan', 'minutes'] },
    pdf:    { ext: ['pdf'],                             mu: 11.5, sigma: 1.4, tail: .03, names: ['invoice', 'contract', 'manual', 'paper', 'statement'] },
    photo:  { ext: ['jpg', 'heic', 'png'],              mu: 14.7, sigma: .6,  tail: .01, names: ['IMG', 'DSC', 'photo', 'PXL'] },
    raw:    { ext: ['cr2', 'nef', 'dng'],               mu: 17.0, sigma: .3,  tail: 0,   names: ['IMG', 'DSC'] },
    audio:  { ext: ['mp3', 'flac', 'm4a'],              mu: 15.3, sigma: .7,  tail: .02, names: ['track', 'song', 'episode', 'take'] },
    video:  { ext: ['mp4', 'mkv', 'mov'],               mu: 20.5, sigma: 1.1, tail: .05, names: ['movie', 'clip', 'recording', 'VID'] },
    disk:   { ext: ['vmdk', 'iso', 'qcow2', 'img'],     mu: 22.5, sigma: .8,  tail: 0,   names: ['ubuntu', 'windows11', 'backup', 'disk'] },
    code:   { ext: ['js', 'ts', 'mjs', 'map', 'json'],  mu: 7.6, sigma: 1.4, tail: .01, names: ['index', 'main', 'util', 'lib', 'types', 'package'] },
    log:    { ext: ['log', 'gz'],                       mu: 9.5, sigma: 1.8, tail: .02, names: ['syslog', 'access', 'error', 'kern', 'app'] },
    cache:  { ext: ['cache', 'tmp', 'bin'],             mu: 9.0, sigma: 2.0, tail: .01, names: ['f', 'data', 'entry', 'blob'] },
    db:     { ext: ['db', 'sqlite', 'ibd'],             mu: 18.0, sigma: 2.0, tail: .1,  names: ['main', 'index', 'mail', 'history'] },
    binary: { ext: ['so', 'bin', 'a', 'o'],             mu: 12.0, sigma: 1.8, tail: .02, names: ['lib', 'tool', 'core', 'mod'] },
}

// folder kinds: subfolder names, how many subfolders (Pareto: xmin, alpha, max), which
// file types and how many files (Pareto: xmin, alpha, max). Most folders are small;
// the kinds with a heavy tail are where the big folders come from.
const kinds = {
    root:     { sub: ['home', 'usr', 'var', 'opt', 'etc', 'tmp', 'srv'], all: true, files: [] },
    home:     { sub: ['alice', 'bob', 'carol'], all: true, files: [] },
    user:     { sub: ['Documents', 'Pictures', 'Music', 'Videos', 'projects', 'Downloads', '.cache', 'VMs'], all: true, files: ['text'], nf: [1, 1.5, 8] },
    docs:     { sub: ['2022', '2023', '2024', 'invoices', 'letters', 'archive', 'scans'], ns: [1, 1.2, 6], files: ['text', 'office', 'pdf'], nf: [1, 1.1, 120] },
    pictures: { sub: ['2021', '2022', '2023', '2024', 'holidays', 'family', 'phone-dump', 'raw'], ns: [1, 1.0, 8], files: ['photo'], nf: [4, .8, 2500] },
    raw:      { sub: ['shoot-01', 'shoot-02', 'wedding', 'landscape'], ns: [1, 1.2, 4], files: ['raw'], nf: [10, .9, 1200] },
    music:    { sub: ['rock', 'jazz', 'classical', 'podcasts', 'live'], ns: [1, 1.3, 5], files: ['audio'], nf: [2, 1.0, 300] },
    videos:   { sub: ['movies', 'clips', 'recordings'], ns: [0, 1.5, 3], files: ['video'], nf: [1, 1.6, 25] },
    vms:      { sub: [], files: ['disk'], nf: [1, 2.5, 4] },
    projects: { sub: ['webapp', 'tool', 'site', 'api', 'game', 'thesis'], ns: [1, 1.4, 4], files: ['text'], nf: [1, 1.5, 6] },
    project:  { sub: ['src', 'test', 'docs', 'node_modules', 'build', 'assets'], ns: [2, 1.3, 6], files: ['code', 'text'], nf: [1, 1.3, 15] },
    src:      { sub: ['components', 'models', 'utils', 'api', 'styles'], ns: [0, 1.4, 5], files: ['code'], nf: [1, 1.0, 80] },
    modules:  { sub: ['d3', 'react', 'lodash', 'vite', 'typescript', 'eslint', 'sass', 'xml2js', 'chalk', 'debug', 'rxjs', 'core-js', 'esbuild', 'rollup', 'babel'], ns: [5, .9, 15], files: ['code'], nf: [1, 1.2, 10] },
    package:  { sub: ['dist', 'lib', 'esm', 'types'], ns: [0, 1.2, 4], files: ['code', 'text'], nf: [2, .85, 2500] },
    cache:    { sub: ['thumbnails', 'fonts', 'browser', 'npm', 'pip'], ns: [1, 1.2, 5], files: ['cache'], nf: [2, .8, 3000] },
    system:   { sub: ['bin', 'lib', 'share', 'include', 'local', 'log', 'spool', 'mysql'], ns: [1, 1.2, 8], files: ['binary', 'text'], nf: [1, 1.0, 200] },
    log:      { sub: ['nginx', 'journal', 'apps'], ns: [0, 1.5, 3], files: ['log'], nf: [3, .85, 2000] },
    database: { sub: [], files: ['db'], nf: [1, 1.5, 12] },
    build:    { sub: [], files: ['code'], nf: [2, .8, 600] },
    assets:   { sub: [], files: ['photo'], nf: [1, 1.0, 80] },
}
const kindOf = (parentKind, name) => ({
    home: 'home', usr: 'system', var: 'system', opt: 'projects', etc: 'system', tmp: 'cache', srv: 'projects',
    alice: 'user', bob: 'user', carol: 'user',
    Documents: 'docs', Downloads: 'docs', Pictures: 'pictures', raw: 'raw', Music: 'music', Videos: 'videos',
    VMs: 'vms', projects: 'projects', '.cache': 'cache', src: 'src', test: 'src', docs: 'docs', node_modules: 'modules',
    build: 'build', assets: 'assets', log: 'log', mysql: 'database',
})[name] || (parentKind === 'projects' ? 'project' : parentKind === 'modules' ? 'package' : parentKind)

function makeFile(type) {
    const t = fileTypes[type]
    let size = Math.exp(t.mu + t.sigma * normal())
    if (rand() < t.tail) size *= pareto(5, 1.0, 2000)        // the few huge ones
    const name = `${pick(t.names)}${rand() < .7 ? '-' + int(1, 9999) : ''}.${pick(t.ext)}`
    return { name, type: 'file', size: Math.max(1, Math.round(size)) }
}

// same: how many levels this kind already repeats (a subfolder without its own kind
// gets its parent's kind, but only one level deep may have subfolders again)
function makeDir(name, kind, depth, same = 0) {
    const k = kinds[kind]
    const node = { name, type: 'dir', children: [] }
    if (depth < 9 && same < 2) {
        const nSub = k.all ? k.sub.length : k.ns ? pareto(k.ns[0] || 1, k.ns[1], k.ns[2]) - (k.ns[0] ? 0 : 1) : 0
        const names = [...k.sub].sort(() => rand() - .5).slice(0, Math.max(0, Math.min(nSub, k.sub.length)))
        for (const sub of names) {
            const kk = kindOf(kind, sub)
            node.children.push(makeDir(sub, kk, depth + 1, kk === kind ? same + 1 : 0))
        }
        // node_modules: many packages, more than the listed names
        if (kind === 'modules') for (let i = 0; i < pareto(5, 1.2, 50); i++) node.children.push(makeDir(`pkg-${int(1, 99999)}`, 'package', depth + 1, 0))
    }
    if (k.files.length) {
        const nFiles = Math.max(k.nf[0] ? 1 : 0, Math.round(pareto(k.nf[0], k.nf[1], k.nf[2]) * scale))
        for (let i = 0; i < nFiles; i++) node.children.push(makeFile(pick(k.files)))
    }
    if (!node.children.length) delete node.children
    return node
}

const countNodes = n => 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0)

// the same tree for a scale of the file counts: more users while it is too small
function build() {
    seed = SEED
    const root = makeDir('/', 'root', 0)
    const home = root.children.find(c => c.name === 'home')
    for (let u = 1; countNodes(root) < target && u < 200; u++) home.children.push(makeDir(`user${u}`, 'user', 2))
    return root
}
// the largest scale (step 0.95) that is at most 3 % over the target, so only few
// files are removed below and the rare huge ones stay
let root = build()
while (countNodes(root) > target * 1.03 && scale > .02) { scale *= .95; root = build() }
console.log(`file count scale ${scale.toFixed(3)}, ${countNodes(root)} nodes before trimming`)

// then down to exactly the target: remove random files (keeps the shape of the
// distributions), then empty folders
const files = []
const collect = (n, parent) => { if (n.type === 'file') files.push([parent, n]); (n.children || []).forEach(c => collect(c, n)) }
collect(root, null)
let excess = countNodes(root) - target
while (excess > 0 && files.length) {
    const [parent, f] = files.splice(Math.floor(rand() * files.length), 1)[0]
    parent.children.splice(parent.children.indexOf(f), 1)
    if (!parent.children.length) delete parent.children
    excess--
}

// sums bottom-up
function sum(n) {
    if (n.type === 'file') return Object.assign(n, { files: 1, dirs: 0 })
    let size = 0, nf = 0, nd = 0
    for (const c of n.children || []) {
        sum(c)
        size += c.size; nf += c.files; nd += c.dirs + (c.type === 'dir' ? 1 : 0)
    }
    return Object.assign(n, { size, files: nf, dirs: nd })
}
sum(root)

const out = fileURLToPath(new URL('filesystem.d3.json', import.meta.url))
writeFileSync(out, JSON.stringify(root))
console.log(`${countNodes(root)} nodes, ${root.files} files, ${root.dirs} folders, ${(root.size / 2 ** 30).toFixed(1)} GiB -> ${out}`)
