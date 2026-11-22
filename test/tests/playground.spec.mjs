import { test, expect } from '@playwright/test'
import { collectErrors, expectNoErrors } from './helpers.mjs'

// The playground (../playground) must keep working: it loads, its controls change
// the configuration (URL and tree), and "Open as test" opens the same configuration
// in the test harness.

test.use({ viewport: { width: 1400, height: 900 } })

const ready = page => page.waitForFunction(() => window.ht && window.ht.data && document.querySelector('#tree #link-arcs'), null, { timeout: 15000 })

test('loads with the defaults and renders the tree', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('../playground/')
    await ready(page)
    expect(await page.locator('#controls details').count()).toBeGreaterThan(6)
    expect(await page.locator('table.layers tbody tr').count()).toBeGreaterThan(15)
    expect(await page.evaluate(() => document.querySelectorAll('#tree #nodes circle').length)).toBeGreaterThan(10)
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

    await page.click('summary:has-text("Layers")')
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
    await page.locator('summary').filter({ hasText: /^Layers/ }).click()

    // nodes: fill (constant color)
    await page.click('tr[data-layer="nodes"] button.expander')
    await opt('nodes', 'fill').locator('select').selectOption('const')
    await opt('nodes', 'fill').locator('input[type=color]').fill('#ff0000')
    await page.waitForFunction(() => document.querySelector('#tree #nodes circle') && document.querySelector('#tree #nodes circle').style.fill === 'rgb(255, 0, 0)')

    // geometry.linkCurvature 'l' turns both arc layers into lines...
    await page.locator('summary').filter({ hasText: /^Geometry/ }).click()
    await page.locator('.row', { has: page.locator('label', { hasText: /^linkCurvature$/ }) }).locator('select').selectOption('l')
    await page.waitForFunction(() => document.querySelector('#tree #link-arcs > *') && document.querySelector('#tree #link-arcs > *').tagName === 'line')

    // ...unless a layer overrides it
    await page.click('tr[data-layer="link-arcs"] button.expander')
    await opt('link-arcs', 'curvature').locator('select').selectOption('+')
    await page.waitForFunction(() => document.querySelector('#tree #link-arcs > *') && document.querySelector('#tree #link-arcs > *').tagName === 'path')

    const url = decodeURIComponent(await page.evaluate(() => location.search))
    expect(url).toContain('geometry={"linkCurvature":"l"}')
    expect(url).toContain('"nodes":{"fill":"#ff0000"}')
    expect(url).toContain('"link-arcs":{"curvature":"+"}')
    expectNoErrors(errors)
})

test('a click anywhere on a layer row toggles its options, its checkboxes do not', async ({ page }) => {
    await page.goto('../playground/?gen=nTree&depth=4')
    await page.locator('summary').filter({ hasText: /^Layers/ }).click()
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
