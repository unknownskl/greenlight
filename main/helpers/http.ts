import https from 'https'
import Application from '../application'

export default class Http {

    _application:Application

    constructor(application:Application) {
        this._application = application
    }

    get(host:string, url: string, method = 'GET') {
        return new Promise((resolve, reject) => {
            let responseData = ''

            const req = https.request({
                host: host,
                path: url,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
            }, (response:any) => {
                response.on('data', (data:any) => {
                    responseData += data
                });

                response.on('end', (data:any) => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('HTTP', 'get('+url+', '+method+') resolve:', response.statusCode)
                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                        }

                        if(response.statusCode === 204){
                            // We have to retry..
                            setTimeout(() => {
                                this.get(url, method).then((result) => {
                                    resolve(result)

                                }).catch((error) => {
                                    reject(error)
                                })
                            }, 750)
                        } else {
                          resolve(returnData)
                        }
                    } else {
                        this._application.log('HTTP', 'get('+url+') reject:', response.statusCode)
                        reject({
                            url: url,
                            status: response.statusCode,
                            body: responseData,
                        })
                    }
                });
            })

            req.on('error', (error) => {
                reject(error)
            });
            req.end();
        })
    }

    post(host: string, url: string, postData = {}, headers = {}) {
        return new Promise((resolve, reject) => {
            let responseData = ''
            const mergedHeaders = Object.assign({}, {
                'Content-Type': 'application/json',
            }, headers)

            const req = https.request({
                host: host,
                path: url,
                method: 'POST',
                headers: mergedHeaders,
            }, (response:any) => {

                response.on('data', (data:any) => {
                    responseData += data
                });

                response.on('end', (data:any) => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('HTTP', 'post('+url+') resolve:', response.statusCode, responseData)

                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                        }
                        
                        resolve(returnData)
                    } else {
                        this._application.log('HTTP', 'post('+url+') reject:', response.statusCode)
                        reject({
                            url: url,
                            status: response.statusCode,
                            body: responseData,
                        })
                    }
                });
            })

            req.on('error', (error) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end();
        })
    }

}