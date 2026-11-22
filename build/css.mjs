// Builds the theme stylesheets dist/d3-hypertree-light.css and -dark.css, as the
// previous Gulp build did: every src/**/*light.scss (or *dark.scss) is compiled on
// its own and the results are concatenated in path order.
//
//   node build/css.mjs           build once
//   node build/css.mjs --watch   rebuild when a .scss file changes
import * as sass from 'sass'
import { readdirSync, statSync, writeFileSync, mkdirSync, watch } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')
const dist = join(root, 'dist')

const walk = dir => readdirSync(dir).sort().flatMap(name => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
})

// the sources are from 2018: @import, darken()/lighten(), / as division
const silenceDeprecations = ['import', 'global-builtin', 'color-functions', 'slash-div']

function build() {
    const t0 = performance.now()
    mkdirSync(dist, { recursive: true })
    const files = walk(src).filter(f => f.endsWith('.scss'))
    for (const theme of ['light', 'dark']) {
        const parts = files.filter(f => f.endsWith(`${theme}.scss`)).map(f =>
            `/* ${relative(src, f).replaceAll('\\', '/')} */\n` +
            sass.compile(f, { style: 'expanded', silenceDeprecations }).css)
        writeFileSync(join(dist, `d3-hypertree-${theme}.css`), parts.join('\n'))
    }
    console.log(`css: built in ${Math.round(performance.now() - t0)} ms`)
}

const tryBuild = () => { try { build() } catch (e) { console.error('css:', e.message) } }
tryBuild()
if (process.argv.includes('--watch')) {
    let timer
    watch(src, { recursive: true }, (_, name) => {
        if (!name || !name.endsWith('.scss')) return
        clearTimeout(timer); timer = setTimeout(tryBuild, 50)
    })
    console.log('css: watching src/**/*.scss')
}
