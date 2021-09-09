export default function (details:any, callback:any):void {
    if (details.uploadData !== undefined && details.requestHeaders !== undefined && details.method === 'POST'){
      this.setMSALData(details.uploadData, details.requestHeaders)
      callback({cancel: true})
    } else {
      // details.requestHeaders['Origin'] = 'https://www.xbox.com'
      // callback({ requestHeaders: details.requestHeaders })
      callback({cancel: false})
    }
}
