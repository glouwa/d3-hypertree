import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 1400, height: 800 } })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
const g = encodeURIComponent(JSON.stringify({ halfPlane: true }))
await p.goto(`http://localhost:3100/test/harness.html?${process.argv[3]}&geometry=${g}`)
await p.waitForTimeout(2500)
await p.addStyleTag({ content: '#tree{width:1300px!important;height:700px!important;max-width:none!important}' })
await p.evaluate(() => window.dispatchEvent(new Event('resize')))
await p.waitForTimeout(500)
console.log(JSON.stringify(await p.evaluate(() => ({ visible: harness.ht.unitdisk.cache.unculledNodes.length,
  viewBox: document.querySelector('.unitdisk-nav > svg').getAttribute('viewBox') }))), errs)
await p.screenshot({ path: process.argv[2] })
await b.close()
