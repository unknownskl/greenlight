import Application from "./frontend/application"
import xCloudClient from "./frontend/xcloudclient"

export class xCloudWeb {

    _test = 'test'

    _xCloudClient:xCloudClient

    constructor() {
        console.log('xCloud Web UI constructor called')

        this._xCloudClient = new xCloudClient({ _tokenStore: undefined } as Application, 'host', 'token', 'home')

        return this
    }
}