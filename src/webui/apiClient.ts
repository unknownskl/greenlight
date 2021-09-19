export default class apiClient {

    getConsoles() {
        return new Promise((resolve, reject) => {
            this._get('/api/consoles').then((data:any) => {
                resolve(data.results)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    startStream(type:'xhome'|'xcloud', inputId:string) {
        return new Promise((resolve, reject) => {
            this._get('/api/'+type+'/play/'+inputId).then((data:any) => {
                resolve(data)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendSdp(offer:string) {
        const postData = {
            "messageType":"offer",
            "sdp": offer,
            "configuration":{
               "containerizeVideo":true,
               "requestedH264Profile":2,
               "chatConfiguration":{
                  "bytesPerSample":2,
                  "expectedClipDurationMs":100,
                  "format":{
                     "codec":"opus",
                     "container":"webm"
                  },
                  "numChannels":1,
                  "sampleFrequencyHz":24000
               },
               "audio":{
                  "minVersion":1,
                  "maxVersion":1
               },
               "chat":{
                  "minVersion":1,
                  "maxVersion":1
               },
               "control":{
                  "minVersion":1,
                  "maxVersion":1
               },
               "input":{
                  "minVersion":1,
                  "maxVersion":4
               },
               "message":{
                  "minVersion":1,
                  "maxVersion":1
               },
               "video":{
                  "minVersion":1,
                  "maxVersion":2
               }
            }
        }

        return new Promise((resolve, reject) => {
            this._post('/api/sdp', postData).then((data:any) => {
                resolve(data)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendIce(offer:string) {
        const postData = {
            
        }

        return new Promise((resolve, reject) => {
            this._post('/api/ice', postData).then((data:any) => {
                resolve(data)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    _get(path:string) {
        return new Promise((resolve, reject) => {
            fetch(path).then(response => response.json()).then((data) => {
                resolve(data)
            })
        })
    }

    _post(path:string, data:any) {
        return new Promise((resolve, reject) => {
            fetch(path, {
                method: 'POST',
                body: JSON.stringify(data)
            }).then(response => response.json()).then((data) => {
                resolve(data)
            })
        })
    }
}