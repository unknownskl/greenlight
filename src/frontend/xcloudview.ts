import Application from "./application";
// import https from 'https'
import apiClient from "./apiclient";

export default class xCloudView {

    _application:Application;
    // _apiClient;

    constructor(application:Application){
        this._application = application

        console.log('xCloudView.js: Created view')

        const backgrounds = [
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_1.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_2.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_3.jpg\')',
            'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_4.jpg\')',
        ]

        const appView = (<HTMLInputElement>document.getElementById('xCloudView'))
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_1.jpg')"
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_2.jpg')"
        const randomSelect = backgrounds[Math.floor(Math.random()*backgrounds.length)];
        appView.style.backgroundImage = randomSelect
        

        // Bind test button
        const startxCloudTestStream = (<HTMLInputElement>document.getElementById('startxCloudTestStream'))
        startxCloudTestStream.onclick = (event: any) => {
            console.log('Starting xcloud stream...')
            this._application.startStream('xcloud', 'DESTINY2')

            
        }
        const startxCloudTestStream2 = (<HTMLInputElement>document.getElementById('startxCloudTestStream2'))
        startxCloudTestStream2.onclick = (event: any) => {
            console.log('Starting xcloud stream...')
            this._application.startStream('xcloud', 'NEWSUPERLUCKYSTALE')
        }
          
    }

    load(){
        return new Promise((resolve, reject) => {
            console.log('xCloudView.js: Loaded view')
            resolve(true)
        })
    }

    unload(){
        return new Promise((resolve, reject) => {
            console.log('xCloudView.js: Unloaded view')
            resolve(true)
        })
    }
}