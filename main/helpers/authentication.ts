import Store from 'electron-store'
import https from 'https'
import { app, session, BrowserWindow, ipcMain } from 'electron';
import { createWindow } from './index'
import Application from '../background'
import XalLibrary from '../../xal-node/src_ts/lib'
const xalAuthenticator = new XalLibrary.XalAuthenticator()

const isProd: boolean = process.env.NODE_ENV === 'production';
const store = new Store({ name: 'helper_authentication' })

export default class Authentication {
    _tokens = {
        web: {
            uhs: false,
            token: false,
            expires: false,
        },
        gamestreaming: {
            token: false,
            market: false,
            regions: [],
            settings: false,
            expires: false,
        },
        xcloud: {
            token: false,
            market: false,
            regions: [],
            host: false,
            settings: false,
            expires: false,
        },
        msal: {
            token: false,
            refresh_token: false,
            id_token: false,
            client_info: false,
            expires: false,
        }
    }

    _loggedIn = false
    _appLevel = 0 // 0 = not logged in, 1 = xhomestreamin, 2 = xcloud
    _authWindow:BrowserWindow

    _application:Application

    _sisu_local_code_verifier
    _sisu_session_id
    _sisu_device_token

    constructor(application){
        this._application = application

        ipcMain.on('auth', (event, arg) => {
            // console.log('got auth-tokens message', arg)
    
            if(arg.type === 'init'){
                const gamertag = store.get('user.gamertag')
                const gamerpic = store.get('user.gamerpic')
                const gamerscore = store.get('user.gamerscore')
    
                event.sender.send('auth', {
                    loggedIn: gamertag ? this._loggedIn : false,
    
                    signedIn: gamertag ? true : false,
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })
                
            } else if(arg.type === 'get_user'){
                const gamertag = store.get('user.gamertag')
                const gamerpic = store.get('user.gamerpic')
                const gamerscore = store.get('user.gamerscore')
    
                event.sender.send('auth', {
                    type: 'user',
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })

            } else if(arg.type === 'logout'){
                console.log('Application received logout call. Removing session and cached keys')
    
                session.defaultSession.clearStorageData().then(() => {
                    store.delete('user')
                    console.log('Restarting application...')
                    this._application.restart()
    
                }).catch((error) => {
                    console.log('Failed to remove local storage:', error)
                })

            } else if(arg.type === 'quit'){
                console.log('Application received quit call. Exiting application')
                this._application.quit()

            } else if(arg.type == 'login') {
                console.log('opening auth flow')
                // if(! this.checkAuthentication()){
                    this.startHooks()
                    this.startAuthflow()
                // }
            }
        });
    }

    startHooks() {
        // session.defaultSession.webRequest.onBeforeRedirect({
        //     urls: [
        //         'https://account.xbox.com/*'
        //     ]
        // }, this.interceptTokens.bind(this))
    
        // session.defaultSession.webRequest.onSendHeaders({
        //     urls: [
        //         'https://www.xbox.com/*',
        //         'https://account.xbox.com/*'
        //     ]
        // }, this.interceptTokens.bind(this))

        // session.defaultSession.webRequest.onSendHeaders({
        //     urls: [
        //         'ms-xal-public-beta-000000004c20a908://*',
        //     ]
        // }, this.interceptTokens.bind(this))

        session.defaultSession.webRequest.onBeforeRedirect({
            urls: [
                'https://login.live.com/oauth20_authorize.srf?*&route=R3_BAY&res=success'
            ]
        }, (details) => {
            console.log('XALAUTH:', details.redirectURL)

            const url = new URL(details.redirectURL)
            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')

            this._authWindow.close()

            xalAuthenticator.exchange_code_for_token(code, this._sisu_local_code_verifier).then((res5:any) => {
                console.log('Retrieved token:', res5)
          
                xalAuthenticator.do_sisu_authorization(this._sisu_session_id, res5.access_token, this._sisu_device_token.Token).then((res6:any) => {
                    console.log('res6:', res6)
            
                    xalAuthenticator.do_xsts_authorization(res6.DeviceToken, res6.TitleToken.Token, res6.UserToken.Token, "http://gssv.xboxlive.com/").then((res7:any) => {
                        console.log('res7 gssv:', res7.Token)

                        this.requestxCloudToken(res7.Token)
                        this.requestxHomeToken(res7.Token)
                        this.requestWebToken(res7.Token)

                        // this._tokens.gamestreaming.token = res7.Token
                        // this._tokens.xcloud.token = res7.Token
                        // this._tokens.web.token = res6.UserToken.Token
                        this._tokens.web.token = res6.UserToken.Token
            
                        xalAuthenticator.exchange_refresh_token_for_xcloud_transfer_token(res5.refresh_token).then((res8:any) => {
                            console.log('res8 xcloud:', res8)

                            this._tokens.msal.token = res8.lpt

                            // Auth done, lets cleanup and load the ui
                            xalAuthenticator.close()
                            this.setAppTokens(2)
                
                        }).catch((error8) => {
                            console.log('exchange_refresh_token_for_xcloud_transfer_token error:', error8)
                        })
            
                    }).catch((error7) => {
                        console.log('do_xsts_authorization error:', error7)
                    })

                }).catch((error6) => {
                  console.log('do_sisu_authorization error:', error6)
                })
          
              }).catch((error5) => {
                console.log('exchange_code_for_token error:', error5)
              })
        })
    
        // session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        //     details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36 Edg/103.0.1264.44';
        //         callback({ cancel: false, requestHeaders: details.requestHeaders });
        //     });
        
        //     session.defaultSession.webRequest.onBeforeSendHeaders({
        //     urls: [
        //         'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
        //     ]
        // }, this.interceptMsalToken.bind(this))
    }

    checkAuthentication() {
        if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false){
            return true
        } else {
            return false
        }
    }

    async startAuthflow() {

        xalAuthenticator.get_device_token().then((device_token:any) => {
            console.log(device_token)
          
            xalAuthenticator.do_sisu_authentication(device_token.Token).then((sisu_response:any) => {
                console.log('Sisu auth response:', sisu_response)

                this._sisu_local_code_verifier = sisu_response.local_code_verifier
                this._sisu_session_id = sisu_response.sisu_session_id
                this._sisu_device_token = device_token

                const authWindow = createWindow('auth', {
                    width: 500,
                    height: 600,
                    title: 'Authentication'
                });
                
                authWindow.loadURL(sisu_response.msal_response.MsaOauthRedirect);
                this._authWindow = authWindow


            }).catch((error4) => {
                console.log('do_sisu_authentication error:', error4)
            })
            
        }).catch((error1) => {
            console.log('get_device_token error:', error1)
        })

        // const authWindow = createWindow('auth', {
        //     width: 500,
        //     height: 600,
        //     title: 'Authentication'
        // });
        
        // await authWindow.loadURL('https://account.xbox.com/account/signin?returnUrl=https%3A%2F%2Fwww.xbox.com%2Fplay');
        // this._authWindow = authWindow

        // return authWindow
    }

    // interceptTokens(details:any):void {
    //     if(details.url === 'https://www.xbox.com/?lc=1033'){
    //         // We want to logout. Lets clear the storage and relaunch the app.
    //         session.defaultSession.clearStorageData()

    //         app.relaunch()
    //         app.exit()

    //     } else if(details.url.includes('/xbox/accountsignin?returnUrl=')){
    //         // We are already logged in..  Lets get the token..

    //         let cookieFound = false
    //         let authToken
    //         let streamingToken

    //         if(details.requestHeaders !== undefined || details.responseHeaders !== undefined){

    //             let cookies;
    //             if(details.requestHeaders !== undefined){
    //                 cookies = details.requestHeaders.Cookie.split('; ')
    //             } else if(details.responseHeaders !== undefined){
    //                 cookies = details.responseHeaders['Set-Cookie']
    //             }

    //             for(const cookie in cookies){
    //                 // console.log(cookies[cookie])
    //                 if(cookies[cookie].includes('XBXXtkhttp://gssv.xboxlive.com/')){
    //                     const rawCookie = cookies[cookie]

    //                     const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
    //                     const jsonToken = JSON.parse(rawCookieContents)

    //                     streamingToken = jsonToken
    //                     cookieFound = true;
    //                 } else if(cookies[cookie].includes('XBXXtkhttp://xboxlive.com')){
    //                     const rawCookie = cookies[cookie]

    //                     const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
    //                     const jsonToken = JSON.parse(rawCookieContents)

    //                     authToken = jsonToken
    //                 }
    //             }

    //         } else {
    //             throw new Error('Uh oh.. We could not get your token :/')
    //         }

    //         if(cookieFound === true){
    //             this._tokens.web.uhs = authToken.UserClaims.uhs
    //             this._tokens.web.token = authToken.Token
    //             this._tokens.web.expires = authToken.expires

    //             this.requestStreamingToken(streamingToken)
    //             this.requestxCloudToken(streamingToken).then((value)  => {
    //                 // do nothing and lets wait for the msal token
                    
    //             }).catch((error) => {
    //                 //  Failed to retrieve xcloud Token. Lets close the login window.
    //                 try {
    //                     this._authWindow.close()
    //                 } catch(error){
    //                     console.log('Failed to close parent window in cookieIntercept', details.webContentsId)
    //                     console.log(error)
    //                 }

    //                 this.setAppTokens(1)
    //             })
    //         }
    //     }
    // }

    // interceptMsalToken(details:any, callback:any):void {
    //     if (details.uploadData !== undefined && details.requestHeaders !== undefined && details.method === 'POST'){
    //         // this.setMSALData(details.uploadData, details.requestHeaders)
    //         // console.log('- MSAL DATA:', details.uploadData, details.requestHeaders)

    //         this.requestMsalToken(details.uploadData, details.requestHeaders)

    //         try {
    //             this._authWindow.close()
    //         } catch(error){
    //             console.log('Failed to close parent window in requestIntercept', details.webContentsId)
    //             console.log(error)
    //         }
        
    //         callback({cancel: true})
    //     } else {
    //         callback({cancel: false})
    //     }
    // }

    // requestMsalToken(body, headers){
    //     // Get MSAL Token
    //     const data = body[0].bytes
    
    //     const options = {
    //         hostname: 'login.microsoftonline.com',
    //         method: 'POST',
    //         path: '/consumers/oauth2/v2.0/token',
    //     }

    //     const reqHeaders = {
    //         'Origin': 'https://www.xbox.com',
    //         ...headers,
    //     }

    //     this.request(options, data, reqHeaders).then((response:any) => {
    //         this._tokens.msal.token = response.access_token
    //         this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
    //         this._tokens.msal.refresh_token = response.refresh_token
    //         this._tokens.msal.id_token = response.id_token
    //         this._tokens.msal.client_info = response.client_info

    //         console.log('- Retrieved MSAL tokens, refreshing token...')

    //         const data = {
    //             client_id: '1f907974-e22b-4810-a9de-d9647380c97e',
    //             scope: 'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN openid profile offline_access',
    //             grant_type: 'refresh_token',
    //             refresh_token: response.refresh_token
    //         }
    //         const dataEncoded = new URLSearchParams(Object.entries(data)).toString();

    //         this.request({
    //             hostname: 'login.microsoftonline.com',
    //             method: 'POST',
    //             path: '/consumers/oauth2/v2.0/token',
    //         }, dataEncoded, {
    //             'Origin': 'https://www.xbox.com',
    //             'Content-Type': 'application/x-www-form-urlencoded',
    //             // 'Content-Length': ''
    //         }).then((response:any) => {
    //             this._tokens.msal.refresh_token = response.refresh_token
    //             this._tokens.msal.token = response.access_token
    //             this._tokens.msal.id_token = response.id_token

    //             console.log('- Retrieved refreshed token')

    //             this.setAppTokens(2)
    //         }).catch((error) => {
    //             console.log('ERROR refreshing MSAL token:', error)
    //         })
    //     }).catch((error) => {
    //         console.log('ERROR retrieving MSAL token:', error)
    //     })
    // }

    // requestStreamingToken(streamingToken){
    //     // Get xHomeStreaming Token
    //     const data = JSON.stringify({
    //         "token": streamingToken.Token,
    //         "offeringId": "xhome"
    //     })
    
    //     const options = {
    //         hostname: 'xhome.gssv-play-prod.xboxlive.com',
    //         method: 'POST',
    //         path: '/v2/login/user',
    //     }

    //     this.request(options, data).then((response:any) => {
    //         this._tokens.gamestreaming.token = response.gsToken
    //         this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
    //         this._tokens.gamestreaming.market = response.market
    //         this._tokens.gamestreaming.regions = response.offeringSettings.regions
    //         this._tokens.gamestreaming.settings = response.offeringSettings.clientCloudSettings

    //         console.log('- Retrieved xHome streaming token:', this._tokens.gamestreaming.token)
    //     }).catch((error) => {

    //     })
    // }

    requestxHomeToken(streamingToken){
        return new Promise((resolve, reject) => {
            console.log('- Requesting xHome streaming tokens')

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": streamingToken,
                "offeringId": "xhome"
            })
        
            const options = {
                hostname: 'xhome.gssv-play-prod.xboxlive.com',
                method: 'POST',
                path: '/v2/login/user',
            }

            this.request(options, data).then((response:any) => {
                this._tokens.web.token = response.gsToken

                this._tokens.gamestreaming.token = response.gsToken
                this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
                this._tokens.gamestreaming.market = response.market
                this._tokens.gamestreaming.regions = response.offeringSettings.regions
                this._tokens.gamestreaming.settings = response.offeringSettings.clientCloudSettings

                console.log('- Retrieved xHome streaming tokens')

                resolve(response)
            }).catch((error) => {
                console.log('xcloud request error:', error)
                reject(error)
            })
        })
    }

    requestxCloudToken(streamingToken){
        return new Promise((resolve, reject) => {
            console.log('- Requesting xCloud streaming tokens')

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": streamingToken,
                "offeringId": "xgpuweb"
            })
        
            const options = {
                hostname: 'xgpuweb.gssv-play-prod.xboxlive.com',
                method: 'POST',
                path: '/v2/login/user',
            }

            this.request(options, data).then((response:any) => {
                this._tokens.xcloud.token = response.gsToken
                this._tokens.xcloud.expires = (Date.now()+response.durationInSeconds)
                this._tokens.xcloud.market = response.market
                this._tokens.xcloud.regions = response.offeringSettings.regions
                this._tokens.xcloud.settings = response.offeringSettings.clientCloudSettings

                for(const region in this._tokens.xcloud.regions){
                    if(this._tokens.xcloud.regions[region].isDefault){
                        this._tokens.xcloud.host = this._tokens.xcloud.regions[region].baseUri.substr(8)
                    }
                }

                console.log('- Retrieved xCloud streaming tokens')

                resolve(response)
            }).catch((error) => {
                console.log('xcloud request error:', error)
                reject(error)
            })
        })
    }

    requestWebToken(streamingToken){
        return new Promise((resolve, reject) => {
            console.log('- Requesting web tokens')

            // Get xHomeStreaming Token
            const data = {
                client_id: '1f907974-e22b-4810-a9de-d9647380c97e',
                scope: 'xboxlive.signin openid profile offline_access',
                grant_type: 'refresh_token',
                refresh_token: streamingToken
            }
            const dataEncoded = new URLSearchParams(Object.entries(data)).toString();

            this.request({
                hostname: 'login.microsoftonline.com',
                method: 'POST',
                path: '/consumers/oauth2/v2.0/token',
            }, dataEncoded, {
                'Origin': 'https://www.xbox.com',
                'Content-Type': 'application/x-www-form-urlencoded',
                // 'Content-Length': ''
            }).then((response:any) => {
                // this._tokens.web.refresh_token = response.refresh_token
                // this._tokens.msal.token = response.access_token
                // this._tokens.msal.id_token = response.id_token

                console.log('- Retrieved refreshed web token', response)

            }).catch((error) => {
                console.log('ERROR refreshing MSAL token:', error)
            })
        
            // const options = {
            //     hostname: 'login.live.com',
            //     method: 'POST',
            //     path: 'oauth20_authorize.srf',
            // }

            // this.request(options, data).then((response:any) => {
            //     this._tokens.xcloud.token = response.gsToken
            //     this._tokens.xcloud.expires = (Date.now()+response.durationInSeconds)
            //     this._tokens.xcloud.market = response.market
            //     this._tokens.xcloud.regions = response.offeringSettings.regions
            //     this._tokens.xcloud.settings = response.offeringSettings.clientCloudSettings

            //     for(const region in this._tokens.xcloud.regions){
            //         if(this._tokens.xcloud.regions[region].isDefault){
            //             this._tokens.xcloud.host = this._tokens.xcloud.regions[region].baseUri.substr(8)
            //         }
            //     }

            //     console.log('- Retrieved xCloud streaming tokens')

            //     resolve(response)
            // }).catch((error) => {
            //     console.log('xcloud request error:', error)
            //     reject(error)
            // })
        })
    }

    request(options, data, headers = {}) {

        return new Promise((resolve, reject) => {
            const reqOptions = {
                hostname: '',
                port: 443,
                path: '',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'x-gssv-client': 'XboxComBrowser',
                    ...headers,
                },
                ...options
            }
            const req = https.request(reqOptions, (res) => {
                let responseData = ''
                
                res.on('data', (data) => {
                    responseData += data
                })
        
                res.on('close', () => {
                    if(res.statusCode == 200){
                        const response = JSON.parse(responseData.toString())
        
                        resolve(response)
                    } else {
                        console.log('- Request error ['+res.statusCode+']', responseData.toString())
                        reject({
                            status: res.statusCode,
                            body: responseData.toString()
                        })
                    }
                })
            })
            
            req.on('error', (error) => {
                // console.log('- Error while retrieving from url:', this.url)
                // console.log('  Error:', error)
                reject({
                    error: error
                })
            })

            req.write(data)
            req.end()
        })
    }

    isAuthenticated() {
        return this._loggedIn
    }

    setAppTokens(level) {
        this._loggedIn = true
        this._appLevel = level

        this.waitTillReady(level)
    }

    waitTillReady(level) {
        console.log('Run waitTillReady()...', this._tokens)
        if(level == 1) {
            // Check web token only
            if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false){
                this._application._events.emit('start', this._tokens)
            } else {
                setTimeout(() => {
                    this.waitTillReady(level)
                }, 100)
            }
        } else {
            // Check all tokens
            if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false && this._tokens.xcloud.token !== false && this._tokens.msal.token !== false){
                this._application._events.emit('start', this._tokens)
            } else {
                setTimeout(() => {
                    this.waitTillReady(level)
                }, 100)
            }
        }
        
    }
}