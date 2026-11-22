// Type check and declarations (dist/d) in one tsc run. Type errors fail the build.
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx tsc -p .', { shell: true, encoding: 'utf8' })
if (r.status !== 0) {
    process.stderr.write(r.stdout + r.stderr)
    console.error('types: type errors, the build fails')
    process.exit(1)
}
console.log('types: no type errors, declarations in dist/d')
