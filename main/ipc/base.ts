import Application from '../application'

interface EventArgs {
    action: string;
    id: number;
    data: any;
    error?: any;
}

export default class IpcBase {
    _application:Application

    constructor(application:Application){
        this._application = application
    }

    onEvent(channel, event, args:EventArgs){
        this._application.log('Ipc:Recv', 'Received event: ['+channel+']', args)
        if(typeof this[args.action] === 'function') {
            const response = (Object.keys(args.data).length > 0) ? this[args.action](args.data) : this[args.action]()
            response.then((result) => {
                this.send(channel, {
                    action: args.action,
                    id: args.id,
                    data: result,
                })
            }).catch((error) => {
                console.log('ERROR: IPC communication error from backend:', error)
                this.send(channel, {
                    action: args.action,
                    id: args.id,
                    data: {},
                    error: error,
                })
            })

        } else {
            this._application.log('Ipc', 'ERROR: Action was not found:', args.action, 'on channel', channel)
            this.send(channel, {
                action: args.action,
                id: args.id,
                data: {},
                error: 'IPC action failure. Action was not found: '+channel+':'+args.action,
            })
        }
    }

    send(channel, args:EventArgs){
        this._application.log('Ipc:Send', 'Sending event: ['+channel+']', args)
        this._application._mainWindow.webContents.send(channel, {
            action: args.action,
            id: args.id,
            data: args.data,
            error: args.error,
        })
    }
}