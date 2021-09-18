import Application from "./frontend/application"
import xCloudClient from "./frontend/xcloudclient"

export default class xCloudWeb {

    _test = 'test'

    _xCloudClient:xCloudClient

    constructor() {
        console.log('xCloud Web UI constructor called')

        fetch('/api/consoles').then(response => response.json()).then((data) => {
            const consoleListElement = document.getElementById('xHomeConsoleList')
            consoleListElement.innerHTML = ''

            for(const console in data.results){
                consoleListElement.innerHTML += ''+JSON.stringify(data.results[console])+' <br />'
            }
        })
    }
}

new xCloudWeb()