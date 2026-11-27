import { defineConfig } from '@playwright/test'
import { cpus } from 'node:os'

const port = 4180

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    // the tests are independent: in parallel (CI runners have 4 cores; locally up to 8,
    // at most half the cores). 6.5 min with one worker, 1 min with eight
    fullyParallel: true,
    workers: process.env.CI ? 2 : Math.max(1, Math.min(8, Math.floor(cpus().length / 2))),
    reporter: [['list']],
    expect: {
        // Generated trees render deterministically; keep a tiny margin.
        toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled' },
    },
    snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
    use: {
        baseURL: `http://localhost:${port}/test/`,
        // Uses the locally installed Microsoft Edge, no browser download needed.
        channel: 'msedge',
        viewport: { width: 900, height: 900 },
        deviceScaleFactor: 1,
    },
    webServer: {
        command: `node serve.mjs ${port}`,
        url: `http://localhost:${port}/test/harness.html`,
        reuseExistingServer: true,
    },
})
