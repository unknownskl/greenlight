import { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
    testDir: 'tests/',
    testMatch: [
        '*.spec.ts',
    ],
    timeout: 60000,
    workers: 1,
    expect: {
        toMatchSnapshot: { threshold: 0.2 },
    },
    webServer: {
        command: 'yarn test-serve',
        url: 'http://127.0.0.1:3000/home.html',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
    },
}

export default config