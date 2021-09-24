import Application from "./application"

export default class Plugins {

    _plugins:any = {}
    _application:Application

    constructor(application:Application) {
        this._application = application
    }

    load(id:string, pluginClass:any) {
        this._plugins[id] = new pluginClass(this._application)
        console.log('plugins loaded:', this._plugins[id])

        this._plugins[id].load()
    }

    onStreamStart() {
        for(const plugin in this._plugins){
            if(this._plugins[plugin].onStreamStart !== undefined){
                this._plugins[plugin].onStreamStart()
            }
        }
    }

}