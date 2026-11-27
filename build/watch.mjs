// Development: rebuilds dist/ on every change (JavaScript with Vite, theme CSS with
// build/css.mjs). With --playground also serves the playground on port 3100.
//
//   node build/watch.mjs [--playground]
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const colors = { js: 36, css: 35, playground: 32 }

function run(name, command) {
    const p = spawn(command, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const prefix = `\x1b[${colors[name]}m[${name}]\x1b[0m `
    const out = stream => data => String(data).split(/\r?\n/).filter(Boolean)
        .forEach(line => stream.write(prefix + line + '\n'))
    p.stdout.on('data', out(process.stdout))
    p.stderr.on('data', out(process.stderr))
    p.on('exit', code => { console.log(`${prefix}exited (${code})`); process.exit(code ?? 1) })
    return p
}

run('js', 'npx vite build --watch')
run('css', 'node build/css.mjs --watch')
if (process.argv.includes('--playground')) run('playground', 'npm run playground')
