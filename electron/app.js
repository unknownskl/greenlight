const { app, BrowserWindow, session, protocol } = require('electron')
const path  = require('path')
const express = require('../app.js'); //your express app

const appIcon = path.join(__dirname, '../assets/icon.ico');

function createWindow () {
    const win = new BrowserWindow({
        width: 1500,
        height: 900,
        // fullscreen: true,

        title: 'Xbox Cloud Gaming',
        icon: appIcon,
        spellcheck: false,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js')
        }
    })

    // win.loadFile(path.join(__dirname, '../www/stream.html'))
    win.loadURL('http://127.0.0.1:3000/app.html');
}

app.whenReady().then(() => {
    createWindow()
})