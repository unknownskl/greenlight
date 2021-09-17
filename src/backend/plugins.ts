import appMenu from './appMenu'
import TokenStore from './TokenStore'

export default class Plugins {

    _plugins:any = {}
    _appMenu:appMenu
    _tokenStore:TokenStore

    constructor(menu:appMenu, tokenStore:TokenStore) {
        this._appMenu = menu
        this._tokenStore = tokenStore
    }

    load(id:string, pluginClass:any) {
        this._plugins[id] = new pluginClass(this._appMenu, this._tokenStore)
        console.log('plugins loaded:', this._plugins[id])
        this._plugins[id].load()

        this._appMenu.setMenu(id, this._plugins[id].getMenu())
    }

}