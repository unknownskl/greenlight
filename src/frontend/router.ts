import { NodeEventEmitter } from "electron"

interface EventCallback {
    (data: string): void;
}

export default class Router {

    _views = [
        'splash',
        'auth',
        'app',
        'streaming'
    ]

    _currentView = 'splash'

    _eventOnViewShow: EventCallback[] = []

    constructor(){
        // this.listenForTokens()

        for(const view in this._views){
            if(view === '0'){
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'block';
                this.emitEvent('onviewshow', {
                    view: this._views[view],
                    previousView: this._currentView
                })
                this._currentView = this._views[view]
            } else {
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'none';
            }
        }

    }

    setView(name: string): boolean {
        let viewFound = false
        for(const view in this._views){
            if(this._views[view] === name){
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'block';
                viewFound = true

                this.emitEvent('onviewshow', {
                    view: this._views[view],
                    previousView: this._currentView
                })
                this._currentView = this._views[view]
            } else {
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'none';
            }
        }

        return viewFound
    }

    

    addEventListener(name: string, callback: EventCallback):void{
        if(name === 'onviewshow'){
            this._eventOnViewShow.push(callback)
        }
    }

    emitEvent(name: string, data: any):void{
        if(name === 'onviewshow'){
            for(const eventCallback in this._eventOnViewShow){
                this._eventOnViewShow[eventCallback](data)
            }
        }
    }
}