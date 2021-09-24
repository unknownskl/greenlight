import { app, BrowserWindow, session } from 'electron';
import https from 'https'
import interceptToken from './backend/cookieIntercept'
import interceptRequest from './backend/requestIntercept'
import TokenStore from './backend/TokenStore'
import appMenu from './backend/appMenu'
import Plugins from './backend/plugins'
import Updater from './backend/updater'

import { OpentrackPluginBackend as OpentrackPlugin } from './plugins/backend/opentrack'
import { WebuiPluginBackend as WebuiPlugin } from './plugins/backend/webui'

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindow:BrowserWindow
const tokenStore = new TokenStore()

const createWindow = (): void => {
  // Create the browser window.
    mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    autoHideMenuBar: true,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false,
      devTools: (process.env.ISDEV !== undefined) ? true : false
    }
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools if we are in dev mode
  if(process.env.ISDEV !== undefined) {
    mainWindow.webContents.openDevTools();
  }
};

app.on('ready', () => {

  new Updater().check()

  session.defaultSession.webRequest.onBeforeRedirect({
    urls: [
      'https://account.xbox.com/*'
    ]
  }, interceptToken.bind(tokenStore))

  session.defaultSession.webRequest.onSendHeaders({
    urls: [
      'https://www.xbox.com/*',
      'https://account.xbox.com/*'
    ]
  }, interceptToken.bind(tokenStore))


  session.defaultSession.webRequest.onBeforeSendHeaders({
    urls: [
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    ]
  }, interceptRequest.bind(tokenStore))

  // Handle login
  tokenStore.addEventListener('onwebtoken', (tokens:any) => {
    mainWindow.webContents.executeJavaScript("setWebTokens('"+tokens.uhs+"', '"+tokens.userToken+"');");
    console.log('web tokens set')
  })

  tokenStore.addEventListener('onstreamingtoken', (token:any) => {
    mainWindow.webContents.executeJavaScript("setStreamingToken('"+token+"');");
    console.log('xhome tokens set')
  })

  tokenStore.addEventListener('onxcloudstreamingtoken', (token:any) => {
    mainWindow.webContents.executeJavaScript("setxCloudStreamingToken('"+token.token+"', '"+token.host+"');");
    console.log('xcloud tokens set')
  })

  tokenStore.addEventListener('onmsaltoken', (token:any) => {
    mainWindow.webContents.executeJavaScript("setxCloudMSALToken('"+token+"');");
    console.log('xcloud msal token set')
  })

  tokenStore.addEventListener('onmsal', (tuple:any) => {
    const data = tokenStore._msalData[0].bytes

    const headers:Record<string,string> = tokenStore._msalHeaders
    headers['Content-Length'] = data.byteLength.toString()

    const options = {
        hostname: 'login.microsoftonline.com',
        port: 443,
        path: '/consumers/oauth2/v2.0/token',
        method: 'POST',
        headers: {
          'Origin': 'https://www.xbox.com',
          ...tokenStore._msalHeaders,
        }
    }
    const req = https.request(options, (res) => {
        let responseData = ''
        
        res.on('data', (data) => {
            responseData += data
        })

        res.on('close', () => {
            if(res.statusCode == 200){
                // console.log('MSAL SUCESS!!!')
                // console.log('body: ', responseData.toString())

                console.log('msal tokens set')
                const msalBody = JSON.parse(responseData.toString())
                tokenStore.setMSALToken(msalBody.access_token)

            } else {
                console.log('- Error while retrieving from url: ...')
                console.log('  statuscode:', res.statusCode)
                console.log('  body:', responseData.toString())
            }
        })
    })
    
    req.on('error', (error) => {
        console.log('- Error while retrieving from url: ...')
        console.log('  Error:', error)
    })

    req.write(data)
    req.end()
  })

  createWindow()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// appMenu().renderMenu()
const menu = new appMenu()

// Create plugin instance and load plugins
const plugins = new Plugins(menu, tokenStore)
plugins.load('opentrack', OpentrackPlugin)
plugins.load('webui', WebuiPlugin)

// Render initial menu
menu.renderMenu()