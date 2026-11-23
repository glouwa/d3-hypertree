import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors } from './helpers.mjs'


// The playground (../playground) must keep working: it loads, its controls change
// the configuration (URL and tree), and "Open as test" opens the same configuration
// in the test harness.

// the playground is made for wide screens (options | tree | layers)
test.use({ viewport: { width: 1600, height: 900 } })

// opens a collapsed group of the layer list (Indicators, Labels, Links, Nodes)
const openGroup = (page, name) => page.locator(`tr[data-group="${name}"]`).click({ position: { x: 20, y: 8 } })
const ready = page => page.waitForFunction(() => window.ht && window.ht.data && document.querySelector('#tree #link-arcs'), null, { timeout: 15000 })

test('loads with the defaults and renders the tree', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    expect(await page.locator('#controls details').count()).toBeGreaterThan(6)
    expect(await page.locator('table.layers tbody tr').count()).toBeGreaterThan(15)
    expect(await page.evaluate(() => document.querySelectorAll('#tree #nodes circle').length)).toBeGreaterThan(10)
    // sections in the order of the pipeline: data, setup, layout, filter, then rendering;
    // the layers in their own panel on the right
    expect(await page.locator('#controls summary').evaluateAll(s => s.map(e => e.firstChild.textContent.trim())))
        .toEqual(['Data', 'Initialization', 'Layout', 'Filter', 'Geometry', 'Interaction', 'API'])
    expect(await page.locator('#layer-controls summary').evaluateAll(s => s.map(e => e.firstChild.textContent.trim()))).toEqual(['Layers'])
    // nothing is marked as changed in the default state
    expect(await page.locator('summary .badge').evaluateAll(b => b.map(e => e.textContent).filter(Boolean))).toEqual([])
    expect(await page.locator('table.layers tr.changed').count()).toBe(0)
    // icons are off by default: the emoji layer is the slowest one
    expect(await page.evaluate(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length)).toBe(0)
    expectNoErrors(errors)
})

test('controls change URL and tree; the panel stays clickable', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    // regression: the component's mouse capture circle used to cover the panel
    expect(await page.evaluate(() => document.elementFromPoint(40, 300).closest('#panel') !== null)).toBe(true)

    await page.locator('#controls select').first().selectOption('file:fixtures/flare.csv')
    await page.waitForFunction(() => window.ht && window.ht.data && window.ht.data.descendants().length === 252)
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('file=fixtures/flare.csv')
    // real names as labels for data with names
    await page.waitForTimeout(800)
    const labels = await page.evaluate(() => [...document.querySelectorAll('#tree #labels text, #tree #labels-force text')].map(t => t.textContent))
    expect(labels.some(l => /^Node \d+$/.test(l))).toBe(false)

    await page.locator('tr[data-layer="cells"] input[type=checkbox]').first().check()
    await page.waitForFunction(() => document.querySelectorAll('#tree #cells > *').length > 0)
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('"cells":{"invisible":false}')
    expectNoErrors(errors)
})

test('a configuration survives a reload and opens as a test', async ({ page, context }) => {
    const query = 'gen=nTree&depth=5&childs=3&labels=1&layoutType=spiral&filter=off&click=select'
    await page.goto(`../playground/?${query}`)
    await ready(page)
    expect(await page.locator('.row', { hasText: 'Type' }).locator('select').inputValue()).toBe('spiral')
    expect(await page.locator('.row', { hasText: 'Click on a node' }).locator('select').inputValue()).toBe('select')

    const [harness] = await Promise.all([context.waitForEvent('page'), page.click('#btn-harness')])
    await harness.waitForFunction(() => window.harness && window.harness.ht.data)
    const url = decodeURIComponent(harness.url())
    expect(url).toContain('harness.html?')
    expect(url).toContain('layoutType=spiral')
    expect(url).not.toContain('click=')   // playground-only parameter
    expect(await harness.evaluate(() => harness.ht.data.descendants().length)).toBe(364)
})

test('callbacks are logged and a click can select a node', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1&click=select')
    await ready(page)
    await page.waitForTimeout(1000)
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
    const opt = (layer, key) => page.locator(`tr[data-layer-options="${layer}"] .row`)
        .filter({ has: page.locator('label', { hasText: new RegExp(`^${key}$`) }) })
    await openGroup(page, 'Nodes')
    await openGroup(page, 'Links')

    // nodes: fill (constant color)
    await page.click('tr[data-layer="nodes"] button.expander')
    await opt('nodes', 'fill').locator('select').selectOption('const')
    await opt('nodes', 'fill').locator('input[type=color]').fill('#ff0000')
    await page.waitForFunction(() => document.querySelector('#tree #nodes circle') && document.querySelector('#tree #nodes circle').style.fill === 'rgb(255, 0, 0)')

    // geometry.linkCurvature '0' turns both arc layers into straight lines...
    await page.locator('summary').filter({ hasText: /^Geometry/ }).click()
    await page.locator('.row', { has: page.locator('label', { hasText: /^linkCurvature$/ }) }).locator('select').selectOption('0')
    await page.waitForFunction(() => { const l = document.querySelector('#tree #link-arcs > *'); return l && !/A/.test(l.getAttribute('d')) })

    // ...unless a layer overrides it
    await page.click('tr[data-layer="link-arcs"] button.expander')
    await opt('link-arcs', 'curvature').locator('select').selectOption('+')
    await page.waitForFunction(() => { const l = document.querySelector('#tree #link-arcs > *'); return l && /A/.test(l.getAttribute('d')) })

    const url = decodeURIComponent(await page.evaluate(() => location.search))
    expect(url).toContain('geometry={"linkCurvature":"0"}')
    expect(url).toContain('"nodes":{"fill":"#ff0000"}')
    expect(url).toContain('"link-arcs":{"curvature":"+"}')
    expectNoErrors(errors)
})

test('a click anywhere on a layer row toggles its options, its checkboxes do not', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await openGroup(page, 'Nodes')
    const opts = page.locator('tr[data-layer-options="nodes"]')
    await expect(opts).toBeHidden()
    await page.locator('tr[data-layer="nodes"] td').nth(0).click({ position: { x: 150, y: 5 } })
    await expect(opts).toBeVisible()
    await page.locator('tr[data-layer="nodes"] td').nth(1).click({ position: { x: 5, y: 5 } })
    await expect(opts).toBeHidden()
    await page.locator('tr[data-layer="nodes"] input[type=checkbox]').first().click()
    await expect(opts).toBeHidden()
    await page.locator('tr[data-layer="nodes"] button.expander').click()
    await expect(opts).toBeVisible()
})

test('the emoji layer is off by default; turned on it shows the icons, also after a reload', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    await openGroup(page, 'Nodes')
    const box = () => page.locator('tr[data-layer="emojis"] input[type=checkbox]').first()
    expect(await box().isChecked()).toBe(false)
    await box().check()
    await page.waitForFunction(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length > 3)
    await page.reload()
    await ready(page)
    await page.waitForFunction(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length > 3)
    // labels off: icons without labels used to crash
    await page.locator('summary').filter({ hasText: /^Initialization/ }).click()
    await page.locator('.init-steps .check', { hasText: /^Labels$/ }).locator('input').uncheck()
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => document.querySelectorAll('#tree #emojis > text, #tree #emojis > image').length)).toBeGreaterThan(3)
    expectNoErrors(errors)
})

test('the initialization section lists every step with its current value', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=6&childs=3&labels=1')
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Initialization/ }).click()
    const steps = page.locator('ol.init-steps > li')
    expect(await steps.count()).toBe(8)
    const text = await steps.allInnerTexts()
    expect(text[0]).toContain('dataloader')
    expect(text[0]).toContain('hyt.nTree(depth 6, 3 children)')
    expect(text[5]).toContain('langInitBFS')
    expect(text[5]).toContain('Node 0')
    // the controls in a step change the configuration and the shown value
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
    // other layers are not in the group
    await expect(page.locator('tr[data-layer="cells"]')).toBeVisible()
    expectNoErrors(errors)
})

test('the label layers form the group Labels', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1')
    await ready(page)
    const group = page.locator('tr[data-group="Labels"]')
    await expect(group).toContainText('2 layers')
    for (const m of ['labels', 'labels-force']) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeHidden()
    await group.click({ position: { x: 20, y: 8 } })
    for (const m of ['labels', 'labels-force']) await expect(page.locator(`tr[data-layer="${m}"]`)).toBeVisible()
    // labels-r-𝐖 stays in Indicators
    await expect(page.locator('tr[data-layer="labels-r-𝐖"]')).toBeHidden()
    // mixed at the start (labels on, labels-force off): the group's checkbox
    // turns both on, then both off
    const box = group.locator('input[type=checkbox]').first()
    expect(await box.evaluate(b => b.indeterminate)).toBe(true)
    await box.check()
    await page.waitForFunction(() => document.querySelectorAll('#tree [id="labels-force"] > *').length > 0)
    await box.uncheck()
    await page.waitForFunction(() => document.querySelectorAll('#tree #labels text').length === 0)
})

test('Node data: the share of nodes with an icon is adjustable', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=4&childs=3&labels=1&filter=off&icons=1&iconPercent=25&layers={}')
    await ready(page)
    const icons = () => page.evaluate(() => { let c = 0; window.ht.data.each(n => { if (n.precalc.icon) c++ }); return c })
    expect(await icons()).toBe(30)
    await page.locator('summary').filter({ hasText: /^Initialization/ }).click()
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
    const opt = key => page.locator('tr[data-layer-options="cells"] .row')
        .filter({ has: page.locator('label', { hasText: new RegExp(`^${key}$`) }) }).locator('select')
    await opt('hover').selectOption('off')
    await opt('selection').selectOption('off')
    await page.waitForFunction(() => window.ht.unitdisk.layerStack.layers.cells.args.hover === false
        && window.ht.unitdisk.layerStack.layers.cells.args.selection === false)
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('"hover":false,"selection":false')
})

test('nodes: option show offers leaves and all', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1&filter=off')
    await ready(page)
    await openGroup(page, 'Nodes')
    await page.click('tr[data-layer="nodes"] button.expander')
    const sel = page.locator('tr[data-layer-options="nodes"] .row').filter({ has: page.locator('label', { hasText: /^show$/ }) }).locator('select')
    await sel.selectOption('all')
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].some(c => c.__data__ && c.__data__.children && c.__data__.parent))
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('"nodes":{"show":"all"}')
})

test('interaction strategies: selection "single" replaces, hover "none" hovers nothing', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=6&childs=2&labels=1&filter=off')
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Interaction/ }).click()
    const row = label => page.locator('.row', { has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('select')
    await row('Selection').selectOption('single')
    await row('Hover').selectOption('none')
    await page.waitForFunction(() => window.ht.args.interaction.selection === 'single' && window.ht.args.interaction.hover === 'none')
    expect(decodeURIComponent(await page.evaluate(() => location.search))).toContain('"hover":"none","selection":"single"')
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
    const groups = { Links: ['path-arcs', 'link-arcs', 'stem-arc'], Nodes: ['nodes', 'symbols', 'images', 'emojis'], Root: ['(0,0)', 'center-node'] }
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
    await page.locator('summary').filter({ hasText: /^Interaction/ }).click()
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
    await ready(page)
    expect(await hoverMiddle()).toEqual({ path: true, cell: true })

    await box('Hover path').uncheck()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"path-arcs":{"hover":"none"}'))
    await ready(page)
    expect(await hoverMiddle()).toEqual({ path: false, cell: true })
})

test('click: goto or select, ripple in addition', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Interaction/ }).click()
    const sel = page.locator('.row', { has: page.locator('label', { hasText: /^Click on a node$/ }) }).locator('select')
    expect(await sel.locator('option').evaluateAll(o => o.map(x => x.value))).toEqual(['goto', 'select', 'none'])
    await sel.selectOption('select')
    await page.locator('label.check', { hasText: /^Ripple on click/ }).locator('input').check()
    await page.waitForFunction(() => /click=select/.test(location.search) && /ripple=1/.test(location.search))
    // older links: click=ripple
    await page.goto('../playground/?gen=nTree&depth=4&click=ripple')
    await ready(page)
    expect(await sel.inputValue()).toBe('none')
    expect(await page.locator('label.check', { hasText: /^Ripple on click/ }).locator('input').isChecked()).toBe(true)
})

test('initialization: multi-line labels', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=3&childs=2&labels=1&filter=off')
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Initialization/ }).click()
    await page.locator('label.check', { hasText: /^Multi-line labels$/ }).locator('input').check()
    await page.waitForFunction(() => /multiline=1/.test(location.search))
    await page.waitForFunction(() => window.ht && window.ht.data && window.ht.data.descendants().every(n => !n.precalc.label || n.precalc.label.includes('\n')))
})

test('filter: rangeNodes max defaults to 750 in the playground', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await ready(page)
    expect(await page.evaluate(() => window.ht.args.filter.weightFilter.rangeNodes.max)).toBe(750)
})

test('geometry: node radius for leaves and inner nodes, inner like the leaves', async ({ page }) => {
    const layers = encodeURIComponent(JSON.stringify({ nodes: { show: 'all' } }))
    await page.goto(`../playground/?gen=nTree&depth=3&childs=3&filter=off&layers=${layers}`)
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Geometry/ }).click()
    const radiusRow = label => page.locator('.row', { has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) })
    const radii = () => page.evaluate(() => {
        const r = c => +c.getAttribute('r')
        const cs = [...document.querySelectorAll('#tree #nodes circle')].filter(c => c.__data__.parent)
        return { leaves: [...new Set(cs.filter(c => !c.__data__.children).map(r))], inner: [...new Set(cs.filter(c => c.__data__.children).map(r))] }
    })
    await radiusRow('radius: leaves').locator('input[type=checkbox]').check()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"nodeRadius":{"leaves":0.015}'))
    await ready(page)
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].some(c => c.getAttribute('r') === '0.015'))
    let r = await radii()
    expect(r.leaves).toEqual([0.015])
    expect(r.inner).not.toContain(0.015)
    await page.locator('label.check', { hasText: /^Inner nodes like the leaves$/ }).locator('input').check()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"nodeRadius":{"leaves":0.015,"inner":"leaves"}'))
    await expect(radiusRow('radius: inner')).toBeHidden()
    await page.waitForFunction(() => [...document.querySelectorAll('#tree #nodes circle')].filter(c => c.__data__.parent).every(c => c.getAttribute('r') === '0.015'))
})

test('geometry: the rectangular view (half-plane) in a wide tree element', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/?gen=nTree&depth=5&childs=3')
    await ready(page)
    await page.locator('summary').filter({ hasText: /^Geometry/ }).click()
    await page.locator('label.check', { hasText: /^Rectangular view/ }).locator('input').check()
    await page.waitForFunction(() => decodeURIComponent(location.search).includes('"halfPlane":true'))
    await page.waitForFunction(() => window.ht && window.ht.args.geometry.halfPlane && window.ht.unitdisk.cache && window.ht.unitdisk.cache.unculledNodes.length > 10)
    const r = await page.evaluate(() => {
        const box = document.querySelector('#tree').getBoundingClientRect()
        const [, , w, h] = document.querySelector('#tree .unitdisk-nav > svg').getAttribute('viewBox').split(' ').map(Number)
        return { wide: box.width > box.height * 1.05, viewWide: w > h * 1.05, mapped: window.ht.unitdisk.cache.unculledNodes.every(n => n.cacheDisk) }
    })
    expect(r).toEqual({ wide: true, viewWide: true, mapped: true })
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
