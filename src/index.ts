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
import * as path from 'path';

declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

const switches = {
  fullscreen: false,
  autoconnect: false,
  connectConsoleId: ''
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const stateStore = {
  xCloudHost: ''
}

let mainWindow:BrowserWindow
const tokenStore = new TokenStore()

const createWindow = (): void => {
  // Create the browser window.
    mainWindow = new BrowserWindow({
    width: 1500,
    height: 875,
    fullscreen: switches.fullscreen,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false,
      devTools: (process.env.ISDEV !== undefined) ? true : false
    }
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    // setup SteamOS font injector script
    mainWindow.webContents.setWindowOpenHandler(() => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            preload: path.join(__dirname, 'preload.js')
          }
        }
      }
    });
  }

  // Check if we already have tokens..
  console.log('tokenStore:', tokenStore)
  if(tokenStore._web.uhs && tokenStore._web.userToken){ mainWindow.webContents.executeJavaScript("setWebTokens('"+tokenStore._web.uhs+"', '"+tokenStore._web.userToken+"');"); }
  if(tokenStore._streamingToken){ mainWindow.webContents.executeJavaScript("setStreamingToken('"+tokenStore._streamingToken+"');"); }
  if(tokenStore._web.uhs){ mainWindow.webContents.executeJavaScript("setxCloudStreamingToken('"+tokenStore._xCloudStreamingToken+"','"+tokenStore._xCloudRegionHost+"');"); }
  if(tokenStore._web.uhs){ mainWindow.webContents.executeJavaScript("setxCloudMSALToken('"+tokenStore._msalToken+"');"); }

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

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36 Edg/103.0.1264.44';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

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

    // Lets set the consoleid of the console we want to connect to
    if(switches.autoconnect === true && switches.connectConsoleId != ''){
      mainWindow.webContents.executeJavaScript("setAutoconnect('"+switches.connectConsoleId+"');");
      // mainWindow.webContents.executeJavaScript("startStream('"+switches.connectConsoleId+"');");
      // .startStream('xhome', consoles[device].serverId)
    }
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

console.log('Bootstrapping Xbox-xCloud-Client using args:', process.argv)

// Read fullscreen switch
if(process.argv.includes('--fullscreen')){
  console.log('- Fullscreen switch acive')
  switches.fullscreen = true
}

// Read auto-connect switch
// if(process.argv.includes('--connect')){
  for(const arg in process.argv){
    if(process.argv[arg].includes('--connect')){
      // got value:
      console.log('- Connect switch active, value:', process.argv[arg].substring(10))
      switches.autoconnect = true
      switches.connectConsoleId = process.argv[arg].substring(10)
    }
  }
// }

// appMenu().renderMenu()
const menu = new appMenu()

// Create plugin instance and load plugins
const plugins = new Plugins(menu, tokenStore)
plugins.load('opentrack', OpentrackPlugin)
plugins.load('webui', WebuiPlugin)

// Render initial menu
menu.renderMenu()
