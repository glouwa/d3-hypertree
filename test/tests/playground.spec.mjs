import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors } from './helpers.mjs'

// The playground (../playground, docs/dev/PLAYGROUND.md): the controls come from the
// option descriptors, the state is the stack of overlays in the URL, a control
// change is applied live with configure(), and "Open as test" opens the same
// configuration in the test harness.

// the playground is made for wide screens (options | tree | layers)
test.use({ viewport: { width: 1600, height: 900 } })

const openGroup = (page, name) => page.locator(`tr[data-group="${name}"]`).click({ position: { x: 20, y: 8 } })
const openSection = (page, name) => page.locator('summary').filter({ hasText: new RegExp(`^${name}`) }).click()
const ready = page => page.waitForFunction(() => window.ht && window.ht.data && document.querySelector('#tree #link-arcs'), null, { timeout: 15000 })
const opt = (page, path) => page.locator(`.row.opt[data-path="${path}"]`)
const stackOf = async page => JSON.parse(decodeURIComponent(await page.evaluate(() => new URLSearchParams(location.search).get('stack'))))
const urlOverlay = async page => ((await stackOf(page)).find(e => e.name === 'url') || { overlay: {} }).overlay

test('loads with the defaults and renders the tree', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    expect(await page.locator('#controls details').count()).toBeGreaterThan(6)
    expect(await page.locator('table.layers tbody tr').count()).toBeGreaterThan(15)
    expect(await page.evaluate(() => document.querySelectorAll('#tree #nodes circle').length)).toBeGreaterThan(10)
    // sections in the order of the pipeline; the layers in their own panel on the right; no "Other"
    expect(await page.locator('#controls summary').evaluateAll(s => s.map(e => e.firstChild.textContent.trim())))
        .toEqual(['Data', 'Presets', 'Initialization', 'Layout', 'Filter', 'Geometry', 'Interaction', 'API'])
    expect(await page.locator('#layer-controls summary').evaluateAll(s => s.map(e => e.firstChild.textContent.trim()))).toEqual(['Layers'])
    // nothing is marked as changed in the default state; the stack is the playground preset and the url
    expect(await page.locator('summary .badge').evaluateAll(b => b.map(e => e.textContent).filter(Boolean))).toEqual([])
    expect(await page.locator('table.layers tr.changed').count()).toBe(0)
    expect(await page.locator('.stack .entry').evaluateAll(e => e.map(x => x.dataset.entry))).toEqual(['defaults', 'playground', 'url'])
    expect(await stackOf(page)).toEqual([{ name: 'playground' }])
    // the playground preset: the emoji layer (the slowest one) is off, 750 nodes at most
    expect(await page.evaluate(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length)).toBe(0)
    expect(await page.evaluate(() => window.ht.args.filter.weightFilter.rangeNodes.max)).toBe(750)
    expectNoErrors(errors)
})

test('every described option has a control (or is a callback, state, the layers)', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=3')
    await ready(page)
    const r = await page.evaluate(() => {
        const paths = [...document.querySelectorAll('#controls .row.opt')].map(r => r.dataset.path)
        const expected = Object.entries(hytOptions.options)
            .filter(([, i]) => !['callback', 'state', 'layers', 'data'].includes(i.kind) && !(i.kind === 'object' && !i.nullable) && !i.internal)
            .map(([p]) => p)
        return { missing: expected.filter(p => !paths.includes(p)), extra: paths.filter(p => !expected.includes(p)), count: paths.length }
    })
    expect(r.missing).toEqual([])
    expect(r.extra).toEqual([])
    expect(r.count).toBeGreaterThan(30)
})

test('a control change goes into the url entry, is applied live and shows its provenance; reset removes it', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=5&childs=3&labels=1')
    await ready(page)
    const before = await page.evaluate(() => window.ht)
    await openSection(page, 'Filter')
    const row = opt(page, 'filter.cullingRadius')
    await row.locator('input[type=range]').fill('0.7')
    await page.waitForFunction(() => window.ht.args.filter.cullingRadius === .7)
    expect(await urlOverlay(page)).toEqual({ filter: { cullingRadius: .7 } })
    await expect(row.locator('.prov')).toHaveText('url')
    await expect(row).toHaveClass(/changed/)
    expect(await page.locator('summary').filter({ hasText: /^Filter/ }).locator('.badge').textContent()).toBe('1 changed')
    // live: the same component, a log line names the effect
    expect(await page.evaluate(() => window.ht === window.__before)).toBe(false) // sanity: evaluate cannot compare handles
    await expect(page.locator('#log li.conf').first()).toContainText('filter.cullingRadius = 0.7 → frame')
    expect(await page.evaluate(() => window.ht.data.descendants().length)).toBe(364)
    // reset: the value below (the library default) shows again
    await row.locator('button.reset').click()
    await page.waitForFunction(() => window.ht.args.filter.cullingRadius === .99)
    expect(await urlOverlay(page)).toEqual({})
    await expect(row.locator('.prov')).toBeHidden()
    expectNoErrors(errors)
})

test('a configuration survives a reload and opens as a test; older links are translated into the url entry', async ({ page, context }) => {
    const query = 'gen=nTree&depth=5&childs=3&labels=1&layoutType=spiral&filter=off&ripple=1'
    await page.goto(`../playground/?${query}`)
    await ready(page)
    // the older parameters became the url entry (layout.type as a named value)
    const url = await urlOverlay(page)
    expect(url.layout).toEqual({ type: '@spiral' })
    expect(url.filter.weightFilter.rangeNodes).toEqual({ min: 1e9, max: 1e10 })
    expect(await page.evaluate(() => decodeURIComponent(location.search))).not.toContain('layoutType=')
    await openSection(page, 'Layout')
    expect(await opt(page, 'layout.type').locator('select').first().inputValue()).toBe('@spiral')
    expect(await page.locator('label.check', { hasText: /^Ripple on click/ }).locator('input').isChecked()).toBe(true)

    const [harness] = await Promise.all([context.waitForEvent('page'), page.click('#btn-harness')])
    await harness.waitForFunction(() => window.harness && window.harness.ht.data)
    const hurl = decodeURIComponent(harness.url())
    expect(hurl).toContain('harness.html?')
    expect(hurl).toContain('"@spiral"')
    expect(hurl).not.toContain('ripple=')   // playground-only parameter
    // the same stack: the playground preset, then the url entry (filter=off: an unreachable rangeNodes)
    expect(await harness.evaluate(() => [harness.ht.data.descendants().length, harness.ht.args.layout.type === hyt.layouts.layoutSpiral,
        harness.ht.args.filter.weightFilter.rangeNodes.max, harness.ht.args.interaction.clickAction])).toEqual([364, true, 1e10, 'goto'])
})

test('callbacks are logged and a click can select a node (interaction.clickAction)', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    await openSection(page, 'Interaction')
    await opt(page, 'interaction.clickAction').locator('select').selectOption('select')
    await page.waitForFunction(() => window.ht.args.interaction.clickAction === 'select')
    await page.waitForTimeout(800)
    const target = await page.evaluate(() => {
        const c = [...document.querySelectorAll('#tree #nodes circle')].filter(c => c.__data__ && c.__data__.depth >= 2)[0]
        const r = c.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.click(target.x, target.y)
    await page.waitForTimeout(500)
    const log = await page.locator('#log').innerText()
    expect(log).toContain('onNodeHover')
    expect(log).toContain('onNodeClick')
    expect(log).toContain('onNodeSelect')
    expect(await page.evaluate(() => window.ht.args.objects.selections.length)).toBe(1)
})

test('each layer has its own options; geometry applies to several layers', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    const lopt = (layer, key) => page.locator(`tr[data-layer-options="${layer}"] .row.opt[data-path="geometry.layerOptions.${layer}.${key}"]`)
    await openGroup(page, 'Nodes')
    await openGroup(page, 'Links')

    // nodes: fill (constant color)
    await page.click('tr[data-layer="nodes"] button.expander')
    await lopt('nodes', 'fill').locator('select').first().selectOption('constant')
    await lopt('nodes', 'fill').locator('input[type=color]').fill('#ff0000')
    await page.waitForFunction(() => document.querySelector('#tree #nodes circle') && document.querySelector('#tree #nodes circle').style.fill === 'rgb(255, 0, 0)')

    // geometry.linkCurvature '0' turns both arc layers into straight lines...
    await openSection(page, 'Geometry')
    await opt(page, 'geometry.linkCurvature').locator('select').selectOption('0')
    await page.waitForFunction(() => { const l = document.querySelector('#tree #link-arcs > *'); return l && !/A/.test(l.getAttribute('d')) })

    // ...unless a layer overrides it
    await page.click('tr[data-layer="link-arcs"] button.expander')
    await lopt('link-arcs', 'curvature').locator('select').selectOption('+')
    await page.waitForFunction(() => { const l = document.querySelector('#tree #link-arcs > *'); return l && /A/.test(l.getAttribute('d')) })

    const url = await urlOverlay(page)
    expect(url.geometry.linkCurvature).toBe('0')
    expect(url.geometry.layerOptions).toEqual({ nodes: { fill: '#ff0000' }, 'link-arcs': { curvature: '+' } })
    await expect(lopt('link-arcs', 'curvature').locator('.prov')).toHaveText('url')
    expectNoErrors(errors)
})

test('a click anywhere on a layer row toggles its options, its checkboxes and tools do not', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await ready(page)
    await openGroup(page, 'Nodes')
    const opts = () => page.locator('tr[data-layer-options="nodes"]')
    await expect(opts()).toHaveCount(0)
    await page.locator('tr[data-layer="nodes"] td').nth(0).click({ position: { x: 150, y: 5 } })
    await expect(opts()).toBeVisible()
    await page.locator('tr[data-layer="nodes"] td').nth(1).click({ position: { x: 5, y: 5 } })
    await expect(opts()).toHaveCount(0)
    await page.locator('tr[data-layer="nodes"] input[type=checkbox]').first().click()
    await expect(opts()).toHaveCount(0)
    await page.locator('tr[data-layer="nodes"] button.expander').click()
    await expect(opts()).toBeVisible()
})

test('the emoji layer is off in the playground preset; turned on it shows the icons, also after a reload', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    await openGroup(page, 'Nodes')
    const box = () => page.locator('tr[data-layer="emojis"] input[type=checkbox]').first()
    expect(await box().isChecked()).toBe(false)
    await box().check()
    await page.waitForFunction(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length > 3)
    expect(await urlOverlay(page)).toEqual({ geometry: { layerOptions: { emojis: { invisible: false } } } })
    await page.reload()
    await ready(page)
    await page.waitForFunction(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length > 3)
    // labels off: icons without labels used to crash
    await openSection(page, 'Initialization')
    await page.locator('.init-steps .check', { hasText: /^Labels$/ }).locator('input').uncheck()
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length)).toBeGreaterThan(3)
    expectNoErrors(errors)
})

test('the initialization section lists every step with its current value', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=6&childs=3&labels=1')
    await ready(page)
    await openSection(page, 'Initialization')
    const steps = page.locator('ol.init-steps > li')
    expect(await steps.count()).toBe(8)
    const text = await steps.allInnerTexts()
    expect(text[0]).toContain('dataloader')
    expect(text[0]).toContain('hyt.nTree(depth 6, 3 children)')
    expect(text[5]).toContain('langInitBFS')
    expect(text[5]).toContain('Node 0')
    await steps.nth(5).locator('.check', { hasText: /^Labels$/ }).locator('input').uncheck()
    await expect(steps.nth(5)).toContainText('none (library default: no labels)')
    expect(decodeURIComponent(await page.evaluate(() => location.search))).not.toContain('labels=')
    expectNoErrors(errors)
})

test('the voronoi cells are recognizable as a layer and can be turned on', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    const row = page.locator('tr[data-layer="cells"]')
    await expect(row).toContainText('voronoi')
    await row.locator('input[type=checkbox]').first().check()
    await page.waitForFunction(() => document.querySelectorAll('#tree #cells > *').length > 10)
})

test('the indicator layers form the group Indicators', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    const group = page.locator('tr[data-group="Indicators"]')
    const members = ['culling-r', 'mouse-r', 'focus-r', 'labels-r-𝐖', 'λ']
    await expect(group).toContainText('5 layers')
    for (const m of members) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeHidden()
    // the group's checkbox switches all members on
    await group.locator('input[type=checkbox]').first().check()
    await page.waitForFunction(() => ['culling-r', 'mouse-r', 'focus-r'].every(id => document.querySelector(`#tree [id="${id}"] > *`)))
    await group.click({ position: { x: 20, y: 8 } })
    for (const m of members) {
        await expect(page.locator(`tr[data-layer="${m}"]`)).toBeVisible()
        expect(await page.locator(`tr[data-layer="${m}"] input[type=checkbox]`).first().isChecked()).toBe(true)
    }
    // one member off: the group shows a mixed state
    await page.locator('tr[data-layer="mouse-r"] input[type=checkbox]').first().uncheck()
    await page.waitForFunction(() => document.querySelector('tr[data-group="Indicators"] input').indeterminate)
    await expect(page.locator('tr[data-layer="cells"]')).toBeVisible()
    expectNoErrors(errors)
})

test('the label layers form the group Labels', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    const group = page.locator('tr[data-group="Labels"]')
    await expect(group).toContainText('3 layers')
    for (const m of ['labels', 'labels-force', 'labels-placed']) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeHidden()
    await group.click({ position: { x: 20, y: 8 } })
    for (const m of ['labels', 'labels-force', 'labels-placed']) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeVisible()
    await expect(page.locator('tr[data-layer="labels-r-𝐖"]')).toBeHidden()
    // mixed at the start (labels on, labels-force off): the group's checkbox turns both on, then both off
    const box = () => group.locator('input[type=checkbox]').first()
    expect(await box().evaluate(b => b.indeterminate)).toBe(true)
    await box().check()
    await page.waitForFunction(() => document.querySelectorAll('#tree [id="labels-force"] > *').length > 0)
    await box().uncheck()
    await page.waitForFunction(() => document.querySelectorAll('#tree #labels text').length === 0)
})

test('Node data: the share of nodes with an icon is adjustable', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=4&childs=3&labels=1&filter=off&icons=1&iconPercent=25&stack=[]')
    await ready(page)
    const icons = () => page.evaluate(() => { let c = 0; window.ht.data.each(n => { if (n.precalc.icon) c++ }); return c })
    expect(await icons()).toBe(30)
    await openSection(page, 'Initialization')
    const step = page.locator('ol.init-steps > li', { hasText: 'dataInitBFS' })
    await expect(step).toContainText('25 % of the nodes')
    await step.locator('input[type=range]').fill('0')
    await page.waitForFunction(() => !location.search.includes('icons='))
    await page.waitForFunction(() => { let c = 0; window.ht.data.each(n => { if (n.precalc.icon) c++ }); return c === 0 })
    await step.locator('input[type=range]').fill('100')
    await page.waitForFunction(() => location.search.includes('icons=1') && !location.search.includes('iconPercent'))
    await page.waitForFunction(() => { let c = 0; window.ht.data.each(n => { if (n.precalc.icon) c++ }); return c === 121 })
    await expect(step).toContainText('every node')
    expectNoErrors(errors)
})

test('by default 10 % of the nodes get an icon', async ({ page }) => {
    await page.goto('../playground/')
    await ready(page)
    const r = await page.evaluate(() => { let n = 0, c = 0; window.ht.data.each(d => { n++; if (d.precalc.icon) c++ }); return { n, c } })
    expect(r.c).toBe(Math.floor(r.n * 0.1))
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('iconPercent=10')
})

test('cells: hover and selection highlighting are layer options', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    await page.click('tr[data-layer="cells"] button.expander')
    const box = key => page.locator(`tr[data-layer-options="cells"] .row.opt[data-path="geometry.layerOptions.cells.${key}"] input[type=checkbox]`)
    await box('hover').uncheck()
    await box('selection').uncheck()
    await page.waitForFunction(() => window.ht.unitdisk.layerStack.layers.cells.args.hover === false
        && window.ht.unitdisk.layerStack.layers.cells.args.selection === false)
    expect((await urlOverlay(page)).geometry.layerOptions.cells).toEqual({ hover: false, selection: false })
})

test('nodes: option show offers leaves and all', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1&filter=off')
    await ready(page)
    await openGroup(page, 'Nodes')
    await page.click('tr[data-layer="nodes"] button.expander')
    await page.locator('tr[data-layer-options="nodes"] .row.opt[data-path="geometry.layerOptions.nodes.show"] select').selectOption('all')
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].some(c => c.__data__ && c.__data__.children && c.__data__.parent))
    expect((await urlOverlay(page)).geometry.layerOptions.nodes).toEqual({ show: 'all' })
})

test('interaction strategies: selection "single" replaces, highlightNode "none" hovers nothing', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1&filter=off')
    await ready(page)
    await openSection(page, 'Interaction')
    await opt(page, 'interaction.selection').locator('select').selectOption('single')
    await opt(page, 'interaction.highlightNode').locator('select').selectOption('none')
    await page.waitForFunction(() => window.ht.args.interaction.selection === 'single' && window.ht.args.interaction.highlightNode === 'none')
    expect((await urlOverlay(page)).interaction).toEqual({ selection: 'single', highlightNode: 'none' })
    const ids = await page.evaluate(() => {
        const [a, b] = window.ht.data.leaves()
        window.ht.api.toggleSelection(a); window.ht.api.toggleSelection(b)
        return window.ht.args.objects.selections.map(n => n.mergeId).concat([b.mergeId])
    })
    expect(ids[0]).toBe(ids[1])
})

test('the groups Links, Nodes and Root', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await ready(page)
    const groups = { Links: ['path-arcs', 'link-arcs', 'stem-arc'], Nodes: ['nodes', 'symbols', 'images', 'emoji-backgrounds', 'emojis'], Root: ['(0,0)', 'center-node'] }
    for (const [name, members] of Object.entries(groups)) {
        await expect(page.locator(`tr[data-group="${name}"]`)).toContainText(`${members.length} layers`)
        for (const m of members) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeHidden()
        await openGroup(page, name)
        for (const m of members) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeVisible()
    }
    await expect(page.locator('tr[data-layer="cells"]')).toBeVisible()
})

test('interaction: hover path and hover cell switch independently', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&filter=off')
    await ready(page)
    await openSection(page, 'Interaction')
    const box = label => page.locator('label.check', { hasText: new RegExp(`^${label}$`) }).locator('input')
    const hoverMiddle = async () => {
        const b = await page.locator('#tree svg').first().boundingBox()
        await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3)
        await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.4, { steps: 3 })
        await page.waitForTimeout(300)
        return page.evaluate(() => ({
            path: document.querySelectorAll('#tree [id="path-arcs"] > *').length > 0,
            cell: document.querySelectorAll('#tree [id="cells"] .hovered').length > 0 }))
    }
    expect(await box('Hover path').isChecked()).toBe(true)
    expect(await box('Hover cell').isChecked()).toBe(false)
    expect(await hoverMiddle()).toEqual({ path: true, cell: false })

    await box('Hover cell').check()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"cells":{"invisible":false}'))
    expect(await hoverMiddle()).toEqual({ path: true, cell: true })

    await box('Hover path').uncheck()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"path-arcs":{"hover":"none"}'))
    expect(await hoverMiddle()).toEqual({ path: false, cell: true })
})

test('interaction: the highlight marker switches on (layer highlight-marker)', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&filter=off')
    await ready(page)
    await openSection(page, 'Interaction')
    const box = page.locator('label.check', { hasText: /^Highlight marker$/ }).locator('input')
    const shown = () => page.evaluate(() => { const c = document.querySelector('#tree circle.highlight-marker'); return !!c && c.style.display !== 'none' })
    const hover = async () => {
        const b = await page.locator('#tree svg').first().boundingBox()
        await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.4, { steps: 3 })
        await page.waitForTimeout(400)
    }
    expect(await box.isChecked()).toBe(false)
    await hover()
    expect(await shown()).toBe(false)
    await box.check()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"highlight-marker":{"invisible":false}'))
    await hover()
    expect(await shown()).toBe(true)
})

test('initialization: multi-line labels', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=3&childs=2&labels=1&filter=off')
    await ready(page)
    await openSection(page, 'Initialization')
    await page.locator('label.check', { hasText: /^Multi-line labels$/ }).locator('input').check()
    await page.waitForFunction(() => /multiline=1/.test(location.search))
    await page.waitForFunction(() => window.ht && window.ht.data && window.ht.data.descendants().every(n => !n.precalc.label || n.precalc.label.includes('\n')))
})

test('geometry: node radius as a named value (leaves only), then a constant for every node', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=3&childs=3&filter=off&layers={"nodes":{"show":"all"}}')
    await ready(page)
    await openSection(page, 'Geometry')
    const row = opt(page, 'geometry.nodeRadius')
    const radii = () => page.evaluate(() => {
        const r = c => +c.getAttribute('r')
        const cs = [...document.querySelectorAll('#tree #nodes circle')].filter(c => c.__data__.parent)
        return { leaves: [...new Set(cs.filter(c => !c.__data__.children).map(r))], inner: [...new Set(cs.filter(c => c.__data__.children).map(r))] }
    })
    await row.locator('select').first().selectOption('@leaves 0.015')
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].some(c => c.getAttribute('r') === '0.015'))
    let r = await radii()
    expect(r.leaves).toEqual([0.015])
    expect(r.inner).not.toContain(0.015)
    expect((await urlOverlay(page)).geometry.nodeRadius).toBe('@leaves 0.015')
    await row.locator('select').first().selectOption('constant')
    await row.locator('input[type=range]').fill('0.015')
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].filter(c => c.__data__.parent).every(c => c.getAttribute('r') === '0.015'))
    expect((await urlOverlay(page)).geometry.nodeRadius).toBe(0.015)
})

test('a scale: node fill by depth with a d3 interpolator, link width by weight', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=5&childs=3&filter=off')
    await ready(page)
    await openGroup(page, 'Nodes')
    await page.click('tr[data-layer="nodes"] button.expander')
    const fill = page.locator('tr[data-layer-options="nodes"] .row.opt[data-path="geometry.layerOptions.nodes.fill"]')
    await fill.locator('select').first().selectOption('scale')
    await fill.locator('select.scale').nth(0).selectOption('depth')
    await fill.locator('select.scale').nth(2).selectOption('Turbo')
    await page.waitForFunction(() => {
        const cs = [...document.querySelectorAll('#tree #nodes circle')]
        return cs.length > 5 && new Set(cs.map(c => c.style.fill)).size > 1 && cs.every(c => /^rgb/.test(c.style.fill))
    })
    expect((await urlOverlay(page)).geometry.layerOptions.nodes.fill).toEqual({ '@scale': { value: 'depth', scale: 'sqrt', interpolator: 'Turbo', opacity: 1 } })

    await openSection(page, 'Geometry')
    const width = opt(page, 'geometry.linkWidth')
    await width.locator('select').first().selectOption('scale')
    await page.waitForFunction(() => {
        const ws = [...document.querySelectorAll('#tree #link-arcs path')].map(p => +p.style.strokeWidth || +p.getAttribute('stroke-width'))
        return ws.length > 5 && new Set(ws).size > 1
    })
    const spec = (await urlOverlay(page)).geometry.linkWidth['@scale']
    expect(spec.value).toBe('weight')
    expect(spec.range).toEqual([.0005, .03])
    expectNoErrors(errors)
})

test('geometry: the rectangular view (half-plane) in a wide tree element', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=5&childs=3')
    await ready(page)
    await openSection(page, 'Geometry')
    await opt(page, 'geometry.view').locator('select').selectOption('halfplane')
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"view":"halfplane"'))
    await page.waitForFunction(() => window.ht && window.ht.args.geometry.view === 'halfplane' && window.ht.unitdisk.cache && window.ht.unitdisk.cache.unculledNodes.length > 10)
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
        const box = document.querySelector('#tree').getBoundingClientRect()
        const [, , w, h] = document.querySelector('#tree .unitdisk-nav > svg').getAttribute('viewBox').split(' ').map(Number)
        return { wide: box.width > box.height * 1.05, viewWide: w > h * 1.05, mapped: window.ht.unitdisk.cache.unculledNodes.every(n => n.cacheDisk) }
    })
    expect(r).toEqual({ wide: true, viewWide: true, mapped: true })
    expectNoErrors(errors)
})

test('labels-force and labels-placed: option transition (0 = off)', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=5&childs=3&labels=1')
    await ready(page)
    await openGroup(page, 'Labels')
    for (const layer of ['labels-force', 'labels-placed']) {
        await page.click(`tr[data-layer="${layer}"] button.expander`)
        const row = page.locator(`tr[data-layer-options="${layer}"] .row.opt[data-path="geometry.layerOptions.${layer}.transition"]`)
        await row.locator('input[type=range]').fill('0')
        await page.waitForFunction(l => window.ht.unitdisk.layerStack.layers[l].args.transition === 0, layer)
        expect((await urlOverlay(page)).geometry.layerOptions[layer]).toEqual({ transition: 0 })
    }
})

test('labels: option asImage', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=5&childs=3&labels=1')
    await ready(page)
    await openGroup(page, 'Labels')
    await page.click('tr[data-layer="labels"] button.expander')
    await page.locator('tr[data-layer-options="labels"] .row.opt[data-path="geometry.layerOptions.labels.asImage"] input[type=checkbox]').check()
    await page.waitForFunction(() => window.ht.unitdisk.layerStack.layers.labels.args.asImage === true)
    await page.waitForFunction(() => document.querySelectorAll('#tree [id="labels"] image').length > 3)
})

test('layout: child order balanced', async ({ page }) => {
    await page.goto('../playground/?file=fixtures/primates.treeml.xml&labels=name')
    await ready(page)
    await openSection(page, 'Layout')
    await opt(page, 'layout.childOrder').locator('select').selectOption('balanced')
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"childOrder":"balanced"'))
    await page.waitForFunction(() => window.ht && window.ht.args.layout.childOrder === 'balanced' && window.ht.data)
})

test('geometry: start position', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=5&childs=3')
    await ready(page)
    await openSection(page, 'Geometry')
    const row = opt(page, 'geometry.startPosition')
    await row.locator('input[type=checkbox]').check()
    await row.locator('input[type=range]').nth(1).fill('0.5')
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"startPosition":{"re":0,"im":0.5}'))
    await page.waitForFunction(() => window.ht && window.ht.args.geometry.startPosition && window.ht.args.geometry.startPosition.im === 0.5)
})

test('the stack: a preset added, its options shown with provenance; own preset saved, combined, switched off', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=5&childs=3&labels=1&values=1')
    await ready(page)
    // add the infovis preset: it is applied, its values carry its badge
    await page.locator('.row', { hasText: 'Add preset' }).locator('select').selectOption('infovis')
    await page.locator('.row', { hasText: 'Add preset' }).locator('button').click()
    await page.waitForFunction(() => window.ht && window.ht.args.geometry.shrinkAtRim === 'full' && window.ht.data)
    expect(await page.locator('.stack .entry').evaluateAll(e => e.map(x => x.dataset.entry))).toEqual(['defaults', 'playground', 'infovis', 'url'])
    await openSection(page, 'Geometry')
    await expect(opt(page, 'geometry.shrinkAtRim').locator('.prov')).toHaveText('infovis')
    await expect(opt(page, 'geometry.shrinkAtRim').locator('.prov')).toHaveClass(/preset/)
    // the entry expands to the options it sets
    await page.locator('.entry[data-entry="infovis"] button.expander').click()
    await expect(page.locator('.entry-details .path', { hasText: 'geometry.shrinkAtRim' })).toContainText('full')
    // a change on top, saved as an own preset: the url entry is empty again, the own entry is in the stack and the URL
    await opt(page, 'geometry.shrinkAtRim').locator('select').selectOption('none')
    await page.waitForFunction(() => window.ht.args.geometry.shrinkAtRim === 'none')
    await expect(page.locator('.entry-details .path', { hasText: 'geometry.shrinkAtRim' })).toContainText('overridden by url')
    page.once('dialog', d => d.accept('mine'))
    await page.locator('button', { hasText: 'Save url changes as preset' }).click()
    await page.waitForFunction(() => document.querySelector('.entry[data-entry="mine"]'))
    await ready(page)
    const stack = await stackOf(page)
    expect(stack.map(e => e.name)).toEqual(['playground', 'infovis', 'mine'])
    expect(stack[2]).toEqual({ name: 'mine', own: true, overlay: { geometry: { shrinkAtRim: 'none' } } })
    await expect(opt(page, 'geometry.shrinkAtRim').locator('.prov')).toHaveText('mine')
    expect(await page.evaluate(() => window.ht.args.geometry.shrinkAtRim)).toBe('none')
    // switched off: the preset below shows again
    await page.locator('.entry[data-entry="mine"] input[type=checkbox]').uncheck()
    await page.waitForFunction(() => window.ht && window.ht.args.geometry.shrinkAtRim === 'full' && window.ht.data)
    expect((await stackOf(page))[2].enabled).toBe(false)
    // the own preset survives a reload from the URL
    await page.reload()
    await ready(page)
    expect(await page.locator('.stack .entry').evaluateAll(e => e.map(x => x.dataset.entry))).toEqual(['defaults', 'playground', 'infovis', 'mine', 'url'])
    expectNoErrors(errors)
})

test('the stack: editing target, reorder and remove', async ({ page }) => {
    const stack = encodeURIComponent(JSON.stringify([{ name: 'a', own: true, overlay: { filter: { cullingRadius: .8 } } }, { name: 'b', own: true, overlay: { filter: { cullingRadius: .9 } } }]))
    await page.goto(`../playground/?gen=nTree&depth=4&childs=3&stack=${stack}`)
    await ready(page)
    expect(await page.evaluate(() => window.ht.args.filter.cullingRadius)).toBe(.9)
    await openSection(page, 'Filter')
    const row = opt(page, 'filter.cullingRadius')
    await expect(row.locator('.prov')).toHaveText('b')
    // b moved above a: a wins
    await page.locator('.entry[data-entry="b"] button[title="up"]').click()
    await page.waitForFunction(() => window.ht && window.ht.args.filter.cullingRadius === .8 && window.ht.data)
    expect((await stackOf(page)).map(e => e.name)).toEqual(['b', 'a'])
    // editing target a: a change goes into a
    await page.locator('.entry[data-entry="a"] button[title^="edit"]').click()
    await row.locator('input[type=range]').fill('0.6')
    await page.waitForFunction(() => window.ht.args.filter.cullingRadius === .6)
    expect((await stackOf(page)).find(e => e.name === 'a').overlay).toEqual({ filter: { cullingRadius: .6 } })
    // a removed: b shows again
    await page.locator('.entry[data-entry="a"] button[title="remove from the stack"]').click()
    await page.waitForFunction(() => window.ht && window.ht.args.filter.cullingRadius === .9 && window.ht.data)
    expect((await stackOf(page)).map(e => e.name)).toEqual(['b'])
})

test('the layer panel: a layer added, moved and removed writes geometry.layers by name', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=4&childs=3&filter=off')
    await ready(page)
    const add = page.locator('.row', { hasText: 'Add layer' })
    await add.locator('select').selectOption('nodes')
    await add.locator('input[type=text]').fill('big')
    await add.locator('button').click()
    await page.waitForFunction(() => window.ht.unitdisk.layerStack.layers.big)
    let layers = (await urlOverlay(page)).geometry.layers
    expect(layers[0]).toBe('background')
    expect(layers[layers.length - 1]).toEqual({ type: 'nodes', name: 'big' })
    expect(await page.locator('tr[data-layer="big"]')).toBeVisible()
    // its options: a bigger constant radius, all nodes
    await page.click('tr[data-layer="big"] button.expander')
    const r = page.locator('tr[data-layer-options="big"] .row.opt[data-path="geometry.layerOptions.big.r"]')
    await r.locator('select').first().selectOption('constant')
    await r.locator('input[type=range]').fill('0.05')
    await page.waitForFunction(() => document.querySelector('#tree [id="big"] circle') && document.querySelector('#tree [id="big"] circle').getAttribute('r') === '0.05')
    // moved up (drawn earlier), then removed
    await page.hover('tr[data-layer="big"]')
    await page.locator('tr[data-layer="big"] button[title^="draw earlier"]').click()
    await page.waitForFunction(() => Object.keys(window.ht.unitdisk.layerStack.layers).indexOf('big') === Object.keys(window.ht.unitdisk.layerStack.layers).length - 2)
    await page.hover('tr[data-layer="big"]')
    await page.locator('tr[data-layer="big"] button[title="remove from the stack"]').click()
    await page.waitForFunction(() => !window.ht.unitdisk.layerStack.layers.big)
    expect((await urlOverlay(page)).geometry.layers).toBeUndefined()
    expectNoErrors(errors)
})

test('layout: options on the left, the tree, the layer list in its own panel on the right', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('../playground/?gen=nTree&depth=4')
    await ready(page)
    const r = await page.evaluate(() => {
        const box = sel => document.querySelector(sel).getBoundingClientRect()
        const left = box('#panel'), tree = box('#stage'), right = box('#layers-panel')
        return {
            order: left.right <= tree.left + 1 && tree.right <= right.left + 1,
            leftWidth: Math.round(left.width), rightWidth: Math.round(right.width),
            layersInRight: !!document.querySelector('#layers-panel table.layers'),
            layersNotLeft: !document.querySelector('#panel table.layers'),
            open: document.querySelector('#layers-panel details').open,
        }
    })
    expect(r).toEqual({ order: true, leftWidth: 389, rightWidth: 389, layersInRight: true, layersNotLeft: true, open: true })
})
