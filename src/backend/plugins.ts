import appMenu from './appMenu'

export default class Plugins {

    _plugins:any = {}
    _appMenu:appMenu

    constructor(menu:appMenu) {
        this._appMenu = menu
    }

    load(id:string, pluginClass:any) {
        this._plugins[id] = new pluginClass(this._appMenu)
        console.log('plugins loaded:', this._plugins[id])
        this._plugins[id].load()

        this._appMenu.setMenu(id, this._plugins[id].getMenu())
    }

}