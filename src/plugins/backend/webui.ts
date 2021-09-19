import appMenu from '../../backend/appMenu'
import express from 'express'
import http from 'http'
import xCloudClient from '../../frontend/xcloudclient'
import TokenStore from '../../backend/TokenStore';
import Application from '../../frontend/application';
import fs from 'fs'

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const WEBUI_PRELOAD_WEBPACK_ENTRY: string;
declare const WEBUI_WEBPACK_ENTRY: string;

// interface OpentrackPosition {
//     [key: string]: number;
// }

export class WebuiPluginBackend {

    _isRunning = false
    _menu:appMenu
    _tokenStore:TokenStore

    _server:any
    _serverStatus = {
        port: -1
    }

    _syncInterval:any
    _xCloudClient:any

    constructor(menu:appMenu, tokenStore:TokenStore = undefined) {
        this._menu = menu
        this._tokenStore = tokenStore
    }

    load() {
        // this._menu._ipc.on('opentrack-sync', (event:any, variables:any) => {
        //     // console.log('IPCMain received:', variables)

        //     // Backend is always in the lead of settings.
        //     event.reply('opentrack-sync', {
        //         isRunning: this._isRunning,
        //         position: this._position
        //     })
        // })

        // this._menu._ipc.on('opentrack-position', (event:any, variables:any) => {
        //     event.reply('opentrack-position', {
        //         position: this._position
        //     })
        // })
    }

    start() {
        this._isRunning = true

        this.startServer()
        this._menu.setMenu('webui', this.getMenu())
    }

    stop() {
        this._isRunning = false

        this.stopServer()
        this._menu.setMenu('webui', this.getMenu())
    }

    _resolvePath(window:string, file:string) {
        let path = ''
        if(window === 'main_window'){
            path = MAIN_WINDOW_WEBPACK_ENTRY
        } else if(window === 'webui'){
            path = WEBUI_WEBPACK_ENTRY
        }

        let htmlFile:Buffer = Buffer.from(path)
        if(path.slice(0, 4) == 'file'){
            console.log('load file:', path.slice(7).replace('index.html', file))
            htmlFile = fs.readFileSync(path.slice(7).replace('index.html', file))
        } else {
            // We assume that we have an http url (from webpack)
            htmlFile = fs.readFileSync('.webpack/renderer/'+window+'/'+file)
        }

        return htmlFile
    }

    startServer(port = 8080) {
        console.log('Starting WebUI Webserver...')

        // this._server = express()
        const requestListener = (req:any, res:any) => {
            console.log(req.method, req.url)

            if(req.url == '/'){
                res.writeHead(200);
                const htmlFile = this._resolvePath('webui', 'index.html')
                res.end(htmlFile)

            } else if(req.url == '/webui/index.js'){
                res.writeHead(200, { 'Content-Type': 'text/javascript' })
                const htmlFile = this._resolvePath('webui', 'index.js')
                res.end(htmlFile)

            } else if(req.url == '/dist/opusWorker.min.js'){
                res.writeHead(200, { 'Content-Type': 'text/javascript' })
                const htmlFile = this._resolvePath('main_window', 'dist/opusWorker.min.js')
                res.end(htmlFile)

            } else if(req.url == '/opus/libopus-decoder.min.js'){
                res.writeHead(200, { 'Content-Type': 'text/javascript' })
                const htmlFile = this._resolvePath('main_window', 'opus/libopus-decoder.min.js')
                res.end(htmlFile)

            } else if(req.url == '/opus/oggOpusDecoder.js'){
                res.writeHead(200, { 'Content-Type': 'text/javascript' })
                const htmlFile = this._resolvePath('main_window', 'opus/oggOpusDecoder.js')
                res.end(htmlFile)

            } else if(req.url == '/opus/libopus-decoder.wasm.min.wasm'){
                res.writeHead(200, { 'Content-Type': 'application/wasm' })
                const htmlFile = this._resolvePath('main_window', 'opus/libopus-decoder.wasm.min.wasm')
                res.end(htmlFile)
                
            } else if(req.url == '/api/consoles'){
                this._xCloudClient = new xCloudClient({ _tokenStore: this._tokenStore } as Application, 'uks.gssv-play-prodxhome.xboxlive.com', this._tokenStore._streamingToken, 'home')
                
                this._xCloudClient.getConsoles().then((consoles:any) => {
                    console.log('consoles', consoles)
                    
                    res.writeHead(200);
                    res.end(JSON.stringify(consoles))
    
                }).catch((error:any) => {
                    console.log('consoles error', error)

                    res.writeHead(error.status);
                    res.end('API returned http status: ' + error.status)
                })

            } else if(req.url.includes('/api/xcloud/play/')) {
                const title = req.url.slice(17)
                this._xCloudClient = new xCloudClient({ _tokenStore: this._tokenStore } as Application, this._tokenStore._xCloudRegionHost, this._tokenStore._xCloudStreamingToken, 'cloud')

                this._xCloudClient.startSession(title).then((config:any) => {
                    res.writeHead(200);
                    res.end(JSON.stringify(config));

                }).catch((error:any) => {
                    res.writeHead(500);
                    res.end('Error in starting stream: '+error);
                })

            } else if(req.url.includes('/api/xhome/play/')) {
                const consoleId = req.url.slice(16)
                this._xCloudClient = new xCloudClient({ _tokenStore: this._tokenStore } as Application, 'uks.gssv-play-prodxhome.xboxlive.com', this._tokenStore._streamingToken, 'home')
                
                this._xCloudClient.startSession(consoleId).then((config:any) => {
                    res.writeHead(200);
                    res.end(JSON.stringify(config));

                }).catch((error:any) => {
                    res.writeHead(500);
                    res.end('Error in starting stream: '+error);
                })

            } else if(req.url.includes('/api/sdp')) {

                if(req.method == 'POST'){
                    let body = '';
                    req.on('data', (chunk:any) => {
                        body += chunk.toString(); // convert Buffer to string
                    });
                    req.on('end', () => {
                        const incomingData = JSON.parse(body)
                        this._xCloudClient.sendSdp(incomingData.sdp).then((config:any) => {
                            console.log(config)
                            res.writeHead(200);
                            res.end(JSON.stringify(config));
    
                        }).catch((error:any) => {
                            res.writeHead(500);
                            res.end('Error in sending SDP data: '+error);
                        })
                    }); 
                } else {
                    res.writeHead(500);
                    res.end('Only POST is supported');
                }

            } else if(req.url.includes('/api/ice')) {

                if(req.method == 'POST'){
                    let body = '';
                    req.on('data', (chunk:any) => {
                        body += chunk.toString(); // convert Buffer to string
                    });
                    req.on('end', () => {
                        const incomingData = JSON.parse(body)
                        this._xCloudClient.sendIce(incomingData).then((config:any) => {
                            console.log(config)
                            res.writeHead(200);
                            res.end(JSON.stringify(config));
    
                        }).catch((error:any) => {
                            res.writeHead(500);
                            res.end('Error in sending ICE data: '+error);
                        })
                    }); 
                } else {
                    res.writeHead(500);
                    res.end('Only POST is supported');
                }
            } else {
                res.writeHead(404);
                res.end('Not found: '+req.url);
            }
        }

        this._server = http.createServer(requestListener);
        this._server.listen(8080);
        // this._server.get('/', (req:any, res:any) => {
        //     console.log('GET /')
        //     res.send('Hello World!')
        // })

        // this._server.get('/api/consoles', (req:any, res:any) => {
        //     console.log('GET /api/consoles')

        //     this._xCloudClient.getConsoles().then((consoles:any) => {
        //         console.log('consoles', consoles)
        //         res.send(consoles)

        //     }).catch((error:any) => {
        //         console.log('consoles error', error)
        //         res.send(error)
        //     })
            
        // })

        // this._serverStatus.port = port
        // this._server.listen(port, () => {
        //     console.log(`WebUI listening at http://localhost:${port}`)
        // })
    }

    stopServer() {
        console.log('Stopping WebUI Webserver...')
        clearInterval(this._syncInterval)
        this._serverStatus.port = -1

        // this._server.stop()
        this._xCloudClient = undefined

        this._server.close()
        console.log('WebUI Webserver stopped.')
    }

    getMenu() {
        return {
            label: 'WebUI',
            submenu: [
                {
                    label: (this._isRunning === true) ? 'Stop Webserver' : 'Start Webserver',
                    click: async () => {
                        if(this._isRunning === false){
                            this.start()
                        } else {
                            this.stop()
                        }
                    }
                },
                {
                    label: this.getStatusLabel(),
                    enabled: false,
                },
                { type: 'separator' },
                ...this.getPositionsMenu(),
            ]
        }
    }

    getPositionsMenu():any {
        const menu:Array<any> = [
            {
                label: 'Open electron build',
                enabled: this._isRunning,
                click: async () => {
                    const { shell } = require('electron')
                    await shell.openExternal(MAIN_WINDOW_WEBPACK_ENTRY)
                }
            },
            {
                label: 'Open WebUI Stream',
                enabled: this._isRunning,
                click: async () => {
                    const { shell } = require('electron')
                    await shell.openExternal(MAIN_WINDOW_WEBPACK_ENTRY+'/../stream_ui/')
                }
            },
            {
                label: 'Open WebUI in browser',
                enabled: this._isRunning,
                click: async () => {
                    const { shell } = require('electron')
                    await shell.openExternal('http://localhost:'+this._serverStatus.port)
                }
            }
        ]

        return menu
    }

    getStatusLabel(){
        if(this._isRunning === true){
            return 'Status: Running on port '+this._serverStatus.port
        } else {
            return 'Status: Not running'
        }
    }
}