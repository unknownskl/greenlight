import Application from "./application";

export default class StreamingView {

    _application:Application;

    constructor(application:Application){
        this._application = application

        console.log('StreamingView.js: Created view')

        // Displayy loading screen...
        const actionBar = (<HTMLInputElement>document.getElementById('loadingScreen'))
        actionBar.style.display = 'block'
    }

    load(){
        return new Promise((resolve, reject) => {
            console.log('StreamingView.js: Loaded view')
            resolve(true)
        })
    }

    unload(){
        return new Promise((resolve, reject) => {

            console.log('StreamingView.js: Unloaded view')
            resolve(true)

        })
        
        
    }
}