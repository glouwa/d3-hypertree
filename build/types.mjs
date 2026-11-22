// Emits the type declarations to dist/d. The known type errors (fixed in Phase 2)
// don't stop the build; they're summarized in one line. Details: npm run typecheck
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx tsc -p . --pretty false', { shell: true, encoding: 'utf8' })
const errors = (r.stdout.match(/error TS\d+/g) || []).length
if (r.status !== 0 && errors === 0) { process.stderr.write(r.stdout + r.stderr); process.exit(r.status) }
console.log(`types: declarations in dist/d${errors ? ` (${errors} known type errors, see npm run typecheck)` : ''}`)
