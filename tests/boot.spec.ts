import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// import authHelper from './lib/auth'

let appWindow
let electronApp

test.beforeAll('Setup', async () => {

    electronApp = await electron.launch({
        args: ['background.js'],
        cwd: 'app/',
    })

    appWindow = await electronApp.firstWindow()
   
})

test('Application can launch', async () => {
    await expect(appWindow).toHaveTitle(/Greenlight/)
})

test('Application opens a new authentication window on fresh install', async () => {
    while(electronApp.windows().length < 2) {
        await delay(100)
    }
    const authWindow = await electronApp.windows()[1]

    await expect(authWindow).toHaveTitle(/Sign in to your Microsoft account/)
})

// test('Can perform authentication', async () => {
//     while(electronApp.windows().length < 2) {
//         await delay(100)
//     }
//     const authWindow = await electronApp.windows()[1]

//     await expect(authWindow).toHaveTitle(/Sign in to your Microsoft account/)

//     await authWindow.isVisible('div#lightbox input#i0116')
//     await delay(500)
//     await authWindow.locator('div#lightbox input#i0116').fill(process.env.XBOX_USERNAME)
//     await authWindow.isVisible('div#lightbox input#idSIButton9')
//     await delay(500)
//     await authWindow.locator('div#lightbox input#idSIButton9').click()

//     await authWindow.isVisible('input#i0118')
//     await delay(500)
//     await authWindow.locator('input#i0118').fill(process.env.XBOX_PASSWORD)
//     await authWindow.isVisible('input#idSIButton9')
//     await delay(500)
//     await authWindow.locator('input#idSIButton9').click()

//     await appWindow.isVisible('div#component_header')
//     await delay(500)
//     await expect(appWindow.locator('div#component_header a[href="/profile"]')).toHaveText('GreenlightE2E')
// })

// test('Is still authenticated', async () => {
//     await expect(appWindow.locator('div#component_header a[href="/profile"]')).toHaveText('GreenlightE2E')
// })

test.afterAll('Setup', async () => {
    // await appWindow.screenshot({path: 'screenshots/final-screen.png'})
    // await delay(30*1000)
    await electronApp.close()
})