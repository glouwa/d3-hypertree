# d3-hypertree: notes for Claude Code

A generic, public hyperbolic tree visualization library (npm `d3-hypertree`, real
users beside our own app). Branch `modernize` is the v2 line (new major version,
backward compatibility not required; prereleases as `2.0.0-alpha.x` on dist-tag `next`).

## The two repositories

- `d3-hypertree` (this repo): the library. Stays generic: nothing from the Open Tree of
  Life, Wikipedia or language maps goes in here. When the app needs something new, it
  gets a generic extension point (option, layer option, callback, projection), never a
  special case.
- `../hypertree-of-life`: the application (pages, presets, data pipeline). App behavior
  lives in its presets (`src/presets.ts`, overlays of this library's configuration
  model). It bundles `../d3-hypertree/dist/d3-hypertree.mjs` through a Vite alias; no
  npm link, no shared workspace root. Its rules: `../hypertree-of-life/CLAUDE.md`.
- Library topics go into this repo's plan (`docs/dev/MODERNIZATION.md`), app topics into
  the app's. Don't propose merging the repos.

## Code and configuration

- Source by pipeline stage: `src/config` (schema, resolve, migrate, presets), `data`,
  `layout`, `geometry`, `filter`, `projection`, `view`, `layers`, `interaction`, `state`,
  `styles`; `src/hypertree.ts` is the facade, `src/index.ts` the public API.
  Applications import only from `d3-hypertree`, never from internal paths.
- Configuration (`docs/dev/REFACTORING.md` §2): a default lives exactly once, next to
  the option (core options in `src/config/schema.ts`, layer options as the layer's
  `static defaults`). The model is resolved once as an overlay over the defaults:
  objects merge, arrays and functions replace, `null` switches an option off,
  `undefined` is ignored. `ht.args` is the resolved model, `ht.configure(overlay)` the
  one door for runtime changes. No `||` fallbacks at the place of use.
- Rendering is SVG and stays SVG. A canvas renderer may only be added as an optional
  layer or view next to the SVG layers, never replacing or rewriting them.
- Frame pipeline terms (frame reasons `data` / `transform` / `style`, `cacheUpdate`,
  the weight filter's settle): read `src/view/unitdisk.ts` and `src/filter/culling.ts`
  before touching them; don't re-explain them in docs.
- Layouts use absolute coordinates with the root at the origin; the depth limits and
  the focus-rooted alternative are in `docs/dev/FOCUS-ROOTED-LAYOUT.md`.

## Every new option needs

1. The default and a doc comment at its definition (schema or layer defaults).
2. A descriptor in `playground/options.js` (kind, bounds, doc). The descriptors live in
   the playground, not in the library bundle; `test/tests/options.spec.mjs` fails
   until every option is described and every descriptor matches an option.
3. A line in `readme.md` (options cheat sheet) or `docs/readme.md` (API reference), and
   a `CHANGELOG.md` entry. Documented features must work: `test/tests/documented.spec.mjs`
   checks the documentation's claims.
4. A test.

## Changelog and docs

- `CHANGELOG.md` at the root, section "Unreleased (2.0.0)" with the subsections
  Changed behavior / Added / Fixed / Deprecated (still work, with a warning) / Removed /
  Performance / Packaging and development. Entries name the file or module in
  parentheses and say what the user notices.
- Development notes go to `docs/dev/` in English (uppercase file names). `docs/_config.yml`
  excludes `dev` from the GitHub Pages site: dev docs are never deployed.
- Every hand-written markdown file ends with the footer `---` and
  `Created YYYY-MM-DD · Last edit YYYY-MM-DD`. A new file gets both dates; every edit
  updates "Last edit". Generated files (`docs/dev/performance/*`) carry their own date.
- Measures, proposals, options, plan items and decisions in docs are task-list items:
  `[x]` implemented, `[ ]` not (or no longer) implemented, with a short note where the
  state needs one (partly done, superseded, resolved differently). Mark them when
  writing and update them when the state changes, in every markdown that lists them.

## Build, run, test

```bash
npm run build          # dist/: UMD + ESM bundle, theme CSS, type declarations (d/)
npm run dev            # rebuild on change + playground on http://localhost:3100/playground/
npm run typecheck      # tsc
cd test && npx playwright test                 # all browser tests (build first: they load dist/)
cd test && npx playwright test tests/x.spec.mjs
cd test && npm run test:update                 # accept new scene/screenshot references
```

- Tests run in the locally installed Microsoft Edge (Playwright channel `msedge`),
  on generated trees (`gen=nTree|star|path|deepStar|fan`) and small fixtures, never
  on application data. Scene snapshots (`test/tests/__scenes__`) compare what is drawn
  with tolerances (`test/tests/helpers.mjs`); don't loosen tolerances to pass.
- `../hypertree-of-life`: `npm run dev` there builds this library on every change too
  and serves the app on :3000; `npm test` there runs the app's e2e tests.
- Stopping a background process (dev server, watch) needs the user's approval; ask
  instead of killing.

## Performance

- Before/after of a change: measure with this repo's suite (`npm run perf`, `npm run
  perf:quick`; generated trees, layers, features, presets) and the app's suite (`npm run
  perf` in `../hypertree-of-life`; the real pages) and read the printed comparison with
  `last-commit` and `longterm` (`docs/dev/PERFORMANCE-SUITE.md`). Never stash or
  rebuild old code to measure it; the reference is the measured last commit.
  `last-commit` is written right after a commit (`npm run perf:commit`, clean tree);
  `longterm` only when the user asks (`npm run perf:longterm`).
- The older trace-based benchmarks for the cost per layer and per pipeline phase:
  `test/bench-layers.mjs`, `test/bench-interaction.mjs` (`docs/dev/PERFORMANCE.md`).
- The user's main goal is pleasant zooming, pinching and dragging; render and
  update-pipeline time matter more than bundle size.

## Working rules

- Commit or push only when asked. Commit messages end without
  Co-Authored-By: Claude...
- Deploying the app (GitHub Pages checkout `../htol-deploy`) is a separate step the
  user confirms; never a side effect of other work.
- Write file content only with the Write/Edit tools, never through shell strings
  (backticks and `$` in markdown or code have executed commands before).
- No personal data leaves the machine. The Wikimedia contact e-mail of the data
  pipeline lives only in the app's git-ignored `res/data/pipeline-contact.txt` and
  must not appear in logs, reports or commits. Scratchpad paths with a user name
  don't go into docs.
- Ask when a requirement is unclear; the user wants decisions on scope, not guesses.
- End every work session with the preset summary (in German): per change, whether it
  was doable with a preset alone and with which lines, otherwise which new options
  were added (name, section or layer, default, descriptor).
  And a performance changes summary

---

Created 2026-11-27 · Last edit 2026-11-27
