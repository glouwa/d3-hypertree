import { expect } from '@playwright/test'

export function collectErrors(page) {
    const errors = []
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
    page.on('console', m => m.type() === 'error' && errors.push(`console: ${m.text()}`))
    return errors
}

export function expectNoErrors(errors) {
    expect(errors, errors.join('\n')).toEqual([])
}

/** Opens the harness with the given query and waits until the tree has loaded and come to rest. */
export async function openTree(page, query) {
    await page.goto(`harness.html?${query}`)
    await page.waitForFunction(() => window.harness)
    await page.evaluate(() => harness.ready)
    await waitForStable(page)
}

/** Waits until no transition runs and node positions stay unchanged over several samples. */
export async function waitForStable(page, timeout = 30_000) {
    await page.evaluate(() => { window.__stable = { sig: '', count: 0 } })
    await page.waitForFunction(() => {
        const sig = [...document.querySelectorAll('#nodes circle')].slice(0, 50)
            .map(c => c.getAttribute('transform')).join('|')
        const w = window.__stable
        if (!harness.ht.transition && sig && sig === w.sig) w.count++
        else { w.sig = sig; w.count = 0 }
        return w.count >= 5
    }, null, { timeout, polling: 200 })
}

export async function counts(page) {
    return page.evaluate(() => ({
        nodes:  document.querySelectorAll('#nodes circle').length,
        links:  document.querySelectorAll('#link-arcs path').length,
        emojis: document.querySelectorAll('#emojis text').length,
        labels: document.querySelectorAll('#labels text, #labels2 text, #labels-force text').length,
    }))
}

/** Bounding box of the unit disk svg. */
export async function diskBox(page) {
    return page.locator('svg').filter({ has: page.locator('#nodes') }).first().boundingBox()
}
