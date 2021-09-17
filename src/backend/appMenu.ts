import { app, ipcMain, Menu }  from 'electron'

export default class appMmenu {

    _isMac = (process.platform === 'darwin')

    _menuState:any = []
    _pluginMenu:any = {}
    _ipc:any

    constructor() {
        this.setMenuState()

        this._ipc = ipcMain
    }

    setMenuState() {
        const pluginMenu:any = this.renderPluginMenu()

        this._menuState = [
            // { role: 'appMenu' }
            ...(this._isMac ? [{
                label: app.name,
                submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
                ]
            }] : []),
            // { role: 'fileMenu' }
            {
                label: 'File',
                submenu: [
                    this._isMac ? { role: 'close' } : { role: 'quit' }
                ]
            },
            // { role: 'editMenu' }
            {
                label: 'Edit',
                submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                ...(this._isMac ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                    label: 'Speech',
                    submenu: [
                        { role: 'startSpeaking' },
                        { role: 'stopSpeaking' }
                    ]
                    }
                ] : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
                ]
            },
            // { role: 'viewMenu' }
            {
                label: 'View',
                submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                ...((process.env.ISDEV !== undefined) ? [{ role: 'toggleDevTools' }] : []),
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
                ]
            },

            // Plugin Menu's?
            pluginMenu,

            // { role: 'windowMenu' }
            {
                label: 'Window',
                submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(this._isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
                ]
            },
            {
                role: 'help',
                submenu: [
                {
                    label: 'Visit GitHub project',
                    click: async () => {
                        const { shell } = require('electron')
                        await shell.openExternal('https://github.com/unknownskl/xbox-xcloud-player')
                    }
                }
                ]
            }
        ]
    }

    renderMenu() {
        const menu = Menu.buildFromTemplate(this._menuState)
        Menu.setApplicationMenu(menu)
    }

    renderPluginMenu() {
        // console.log('plugin menus loaded:', Object.keys(this._pluginMenu).length, this._pluginMenu)

        if(Object.keys(this._pluginMenu).length === 0){
            return {
                label: 'Plugins',
                submenu: [
                    {
                        label: 'No plugins found',
                        enabled: false,
                    },
                ]
            }
        } else {
            const menu:any = {
                label: 'Plugins',
                submenu: []
            }

            for(const id in this._pluginMenu) {
                menu.submenu.push(this._pluginMenu[id])
            }
            
            return menu
        }
    }

    setMenu(id:string, menu:any) {
        this._pluginMenu[id] = menu

        this.setMenuState()
        this.renderMenu()
    }
}