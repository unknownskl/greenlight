import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

let appWindow;
let electronApp;

test.beforeAll('Setup', async () => {

    electronApp = await electron.launch({
        args: ['background.js'],
        cwd: 'app/',
    });

    // while(electronApp.windows().length < 2) {
    //     await delay(100);
    // }

    appWindow = await electronApp.firstWindow();
   
});

test('Application can launch', async () => {
    // Expect a title "to contain" a substring.
    await expect(appWindow).toHaveTitle(/Greenlight/);
});

test('Application opens a new authentication window on fresh install', async () => {
    while(electronApp.windows().length < 2) {
        await delay(100);
    }
    const authWindow = await electronApp.windows()[1];

    await expect(authWindow).toHaveTitle(/Sign in to your Microsoft account/);
});

test.afterAll('Setup', async () => {

    await appWindow.screenshot({path: 'screenshots/final-screen.png'});
   
    await electronApp.close();
});