import { defineConfig } from '@playwright/test'

const port = 4180

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    workers: 1,
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
