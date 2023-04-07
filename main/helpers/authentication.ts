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
    _isAuthenticating = false
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

                // Check loading?
                if(this._isAuthenticating === true){
                    event.sender.send('app_loading', {})
                }
    
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
        session.defaultSession.webRequest.onBeforeRedirect({
            urls: [
                'https://login.live.com/oauth20_authorize.srf?*&res=success',
                'https://login.live.com/oauth20_authorize.srf?*&res=cancel',
                'https://login.live.com/ppsecure/post.srf?*&route=R3_BL2'
            ]
        }, (details) => {
            // console.log('XALAUTH:', details.redirectURL)

            const url = new URL(details.redirectURL)
            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')
            // console.log('XALAUTH2:', code, state)

            if(code === null){
                const error = url.searchParams.get('error')
                if(error === 'access_denied'){
                    this._authWindow.close()
                    return
                }
            }
            
            this._isAuthenticating = true
            this._authWindow.close()

            xalAuthenticator.exchange_code_for_token(code, this._sisu_local_code_verifier).then((res5:any) => {
                // console.log('Retrieved token:', res5)
          
                xalAuthenticator.do_sisu_authorization(this._sisu_session_id, res5.access_token, this._sisu_device_token.Token).then((res6:any) => {
                    // console.log('res6:', res6)
            
                    xalAuthenticator.do_xsts_authorization(res6.DeviceToken, res6.TitleToken.Token, res6.UserToken.Token, "http://gssv.xboxlive.com/").then((res7:any) => {
                        // console.log('res7 gssv:', res7.Token)

                        this.requestxHomeToken(res7.Token)
            
                        xalAuthenticator.exchange_refresh_token_for_xcloud_transfer_token(res5.refresh_token).then((res8:any) => {
                            // console.log('res8 xcloud:', res8)

                            this._tokens.msal.token = res8.lpt

                            // Auth done, lets cleanup and load the ui
                            xalAuthenticator.close()

                            this.requestxCloudToken(res7.Token).then((result) => {
                                // Supports xCloud
                                this.setAppTokens(2)
                            }).catch((error) => {
                                // Supports xHome only
                                this.setAppTokens(1)
                            })
                
                        }).catch((error8) => {
                            console.log('exchange_refresh_token_for_xcloud_transfer_token error:', error8)
                        })
            
                    }).catch((error7) => {
                        console.log('do_xsts_authorization error:', error7)
                    })

                    
                    xalAuthenticator.do_xsts_authorization(res6.DeviceToken, res6.TitleToken.Token, res6.UserToken.Token, "http://xboxlive.com").then((res_web:any) => {
                        // console.log('res_web web:', res_web)
                        this._tokens.web.uhs = res_web.DisplayClaims.xui[0].uhs
                        this._tokens.web.token = res_web.Token
                        this._tokens.web.expires = res_web.expires
                    })

                }).catch((error6) => {
                  console.log('do_sisu_authorization error:', error6)
                })
          
              }).catch((error5) => {
                console.log('exchange_code_for_token error:', error5)
              })
        })
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
    }

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
                // this._tokens.web.token = response.gsToken

                this._tokens.gamestreaming.token = response.gsToken
                this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
                this._tokens.gamestreaming.market = response.market
                this._tokens.gamestreaming.regions = response.offeringSettings.regions
                this._tokens.gamestreaming.settings = response.offeringSettings.clientCloudSettings

                console.log('- Retrieved xHome streaming tokens')

                resolve(response)
            }).catch((error) => {
                console.log('xcloud (xhome) request error:', error)
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
                console.log('xcloud (xCloud) request error:', error)
                reject(error)
            })
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
        this.waitTillReady(level)
    }

    waitTillReady(level) {
        console.log('Run waitTillReady()...', this._tokens)
        if(level == 1) {
            // Check web token only
            if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false){
                this._loggedIn = true
                this._appLevel = level
                this._application._events.emit('start', this._tokens)
            } else {
                setTimeout(() => {
                    this.waitTillReady(level)
                }, 100)
            }
        } else {
            // Check all tokens
            if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false && this._tokens.xcloud.token !== false && this._tokens.msal.token !== false){
                this._loggedIn = true
                this._appLevel = level
                this._application._events.emit('start', this._tokens)
            } else {
                setTimeout(() => {
                    this.waitTillReady(level)
                }, 100)
            }
        }
        
    }
}