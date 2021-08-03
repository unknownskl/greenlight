import OpenTrackServer from './opentrackserver'
// import GameinputServer from './gameinputserver'

import Application from '../frontend/application';

export default class AppMenu {
    _openTrackServer:OpenTrackServer
    // _gameinputServer:GameinputServer

    isMac():boolean {
        return process.platform === 'darwin'
    }

    structure():any {
        return [
            ...(this.isMac ? [{
                label: 'Xbox-xHomeStreaming',
                submenu: [
                  { role: 'about' },
                  { type: 'separator' },
                  { role: 'services' },
                  { type: 'separator' },
                  { role: 'hide' },
                  { role: 'hideothers' },
                  { role: 'unhide' },
                  { type: 'separator' },
                  { role: 'quit' }
                ]
              }] : []),

            {
                label: 'Features',
                submenu: [
                    {
                        label: 'Enable OpenTrack',
                        type: 'checkbox',
                        checked: false,
                        click: (event:any) => {
                            if(this._openTrackServer === undefined){
                                this._openTrackServer = new OpenTrackServer()
                            }

                            if(event.checked === true){
                                // Enable OpenTrack
                                this._openTrackServer.start()

                            } else if(event.checked === false){
                                // Disable OpenTrack
                                this._openTrackServer.close()
                            }
                        }
                    },
                    // {
                    //     label: 'Enable Gameinput server',
                    //     type: 'checkbox',
                    //     checked: false,
                    //     click: (event:any) => {
                    //         if(this._gameinputServer === undefined){
                    //             this._gameinputServer = new GameinputServer()
                    //         }

                    //         if(event.checked === true){
                    //             // Enable OpenTrack
                    //             this._gameinputServer.start()

                    //         } else if(event.checked === false){
                    //             // Disable OpenTrack
                    //             this._gameinputServer.close()
                    //         }
                    //     }
                    // }
                ]
            }
        ]
    }
}