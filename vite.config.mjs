import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const shim = name => fileURLToPath(new URL(`./build/shims/${name}.js`, import.meta.url))

// Library build: dist/d3-hypertree.js (UMD, global `hyt`, for <script> tags and
// CommonJS) and dist/d3-hypertree.mjs (ES module). Like the previous Webpack
// bundle, both contain all dependencies (d3, xml2js, d3-force-gravity).
// The theme CSS is built separately by build/css.mjs.
export default defineConfig({
    resolve: {
        alias: {
            // Node built-ins required by xml2js / sax
            events:         fileURLToPath(new URL('./node_modules/events/events.js', import.meta.url)),
            timers:         shim('timers'),
            stream:         shim('stream'),
            string_decoder: shim('string_decoder'),
        },
    },
    build: {
        // same language level as the previous TypeScript output (ES2017), so older
        // bundlers (e.g. the application's Webpack 3) can still read the bundle
        target: 'es2017',
        sourcemap: true,
        minify: false,
        emptyOutDir: false,       // the CSS and the declarations live in dist/ too
        lib: {
            entry: 'src/index.ts',
            name: 'hyt',
            formats: ['umd', 'es'],
            fileName: format => format === 'es' ? 'd3-hypertree.mjs' : 'd3-hypertree.js',
        },
    },
})
