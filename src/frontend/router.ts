import { NodeEventEmitter } from "electron"

interface EventCallback {
    (data: string): void;
}

export default class Router {

    _views = [
        'auth',
        'app',
        'streaming'
    ]

    constructor(){
        // this.listenForTokens()

        for(const view in this._views){
            if(view === '0'){
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'block';
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
            } else {
                (<HTMLInputElement>document.getElementById(this._views[view]+'View')).style.display = 'none';
            }
        }

        return viewFound
    }

    

    // addEventListener(name: string, callback: EventCallback):void{
    //     if(name === 'onwebtoken'){
    //         this._eventOnWebToken.push(callback)
    //     } else if(name === 'onstreamingtoken'){
    //         this._eventOnStreamingToken.push(callback)
    //     }
    // }

    // emitEvent(name: string, data: any):void{
    //     if(name === 'onwebtoken'){
    //         for(const eventCallback in this._eventOnWebToken){
    //             this._eventOnWebToken[eventCallback](data)
    //         }
    //     } else if(name === 'onstreamingtoken'){
    //         for(const eventCallback in this._eventOnStreamingToken){
    //             this._eventOnStreamingToken[eventCallback](data)
    //         }
    //     }
    // }
}