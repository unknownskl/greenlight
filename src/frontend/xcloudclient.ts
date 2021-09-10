// interface EmptyArray {
// }

export default class xCloudClient {

    _host:string
    _token:string

    constructor(host:string, token: string){
        this._host = host
        this._token = token
    }

    get(url: string) {
        return new Promise((resolve, reject) => {
            fetch(url, {
                method: 'GET', // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Authorization': 'Bearer '+this._token,
                    'Accept-Language': 'en-US',
                }
            }).then((response) => {
                if(response.status !== 200){
                    console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
                } else {
                    response.json().then((data) => {
                        resolve(data)
                    }).catch((error) => {
                        reject(error)
                    })
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    getTitles() {
        return this.get('https://' + this._host + '/v1/titles')
    }
}