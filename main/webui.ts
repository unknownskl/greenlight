import Application from './application'
import express from 'express'
import expressWS from 'express-ws'
import expressProxy from 'express-http-proxy'
import path from 'path'
import Ipc from './ipc'

export default class WebUI {
    _application:Application
    _express:express
    _ws:expressWS
    _ipc:Ipc

    constructor(application:Application){
        this._application = application
        this._application.log('webui', 'Loaded WebUI Plugin')
    }

    startServer(port:number = 3000){
        this._application.log('webui', 'Starting webserver...')
        this._express = express()
        this._ws = expressWS(this._express);
        this._ipc = new Ipc(this._application)
        this._ipc.startUp()

        this._application._events.on('start', () => {
            this._ipc.onUserLoaded()
        })

        // this._express.get('/', (req, res) => {
        //     // res.send('Hello World!')
        //     res.sendFile(path.join(__dirname, "../app/", "home.html"));
        // })

        this._express.ws('/ipc', (ws, req) => {

            // Websocket ipc hack
            for(const channel in this._ipc._channels){
                this._ipc._channels[channel].send = (channel, args) => {
                    console.log('HOOKED IPC:', channel, args)
                    ws.send(JSON.stringify({
                        channel: channel,
                        id: args.id,
                        action: args.action,
                        data: args.data,
                    }))
                }
            }

            ws.on('message', (msg) => {
                const ipcData = JSON.parse(msg)
                this._application.log('webui:websocket', 'Received event:', ipcData)

                this._application._webUI._ipc._channels[ipcData.channel].onEvent(ipcData.channel, undefined, {
                    action: ipcData.action,
                    id: ipcData.id || 0,
                    data: ipcData.data
                })

                // ws.send(msg);
            });
        });


        // this._express.use(express.static(path.join(__dirname, "../app/")))

        // this._express.get('*', (req, res) => {
        //     // res.send('Hello World!')
        //     res.sendFile(path.join(__dirname, "../app/", "home.html"));
        // })

        const expressPort = process.argv[2] || 3000;
        this._express.use(expressProxy('localhost', { port: 8888}));

        this._express.listen(port, () => {
            this._application.log('webui', 'Webserver running on port:', port)
            console.log(`Webserver started on port: ${port}`)
        })
    }
}