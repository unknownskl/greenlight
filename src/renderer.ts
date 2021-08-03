/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './assets/css/app.css';

import App from './frontend/application'
const Application = new App()

module.exports = {
    overwriteGamepadState: function (state:any):boolean {
      // console.log('Set state:', state);

      if(Application._StreamingView !== undefined && Application._StreamingView._streamClient !== undefined && Application._StreamingView._streamClient._webrtcClient !== undefined){
        const newState = {
            RightThumbXAxis: state.RightThumbXAxis || 0,
            RightThumbYAxis: state.RightThumbYAxis || 0,
        }

        Application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').overwriteGamepadState(0, newState)

        return true
      } else {
          return false
      }
      
    //   client.getChannelProcessor('input').pressButton(0, { Nexus: 1 })
    }
};