import https from 'https'
import { app, dialog, shell } from 'electron'

export default class Updater {
    check() {
        console.log('Updater.ts - Checking for updates...')

        const req = https.request({
            host: 'api.github.com',
            path: '/repos/unknownskl/xbox-xcloud-client/releases',
            method: 'GET',
            headers: {
                'User-Agent': 'unknownskl/xbox-xcloud-client_updateChecker'
            }
        }, (response) => {
            let body = ''

            response.on('data', (chunk) => {
                body += chunk
            });

            response.on('end', () => {
                if(response.statusCode === 200){
                    const data = JSON.parse(body)
                    console.log('Updater.ts - Got response. Current version:', app.getVersion())

                    let current:any = false
                    let onPrerelease = false

                    let newestPrerelease:any = false
                    let newestStable:any = false

                    for(const release in data){
                        console.log(data[release].name)
                        console.log(data[release].html_url)
                        console.log(data[release].tag_name)
                        console.log(data[release].prerelease)

                        if(newestPrerelease === false){
                            newestPrerelease = data[release]
                        }

                        if(newestStable === false && data[release].prerelease === false){
                            newestStable = data[release]
                        }

                        if(data[release].tag_name.slice(1) === app.getVersion()) {
                            current = data[release]
                            onPrerelease = data[release].prerelease
                        }
                    }

                    if(current !== false){
                        console.log('Updater.ts - We found our release. Lets compare:')
                        console.log('onPrerelease', onPrerelease)
                        console.log('newestPrerelease', newestPrerelease)
                        console.log('newestStable', newestStable)

                        let newestVersion:any = false

                        if(onPrerelease === false){
                            // We are on the pre-release channel
                            newestVersion = newestStable
                        } else {
                            // We are on the stable channel.
                            newestVersion = newestPrerelease
                        }

                        if(newestVersion.tag_name.slice(1) !== app.getVersion()){
                            setTimeout(() => {
                                console.log('Updater.ts - We got a version difference!')
                                const updateDialog = dialog.showMessageBox({
                                    message: newestVersion.tag_name,
                                    buttons: [
                                        'Update',
                                        'Close'
                                    ],
                                    defaultId: 0,
                                    cancelId: 1,
                                    title: 'New update available!',
                                    detail: newestVersion.body
                                })

                                updateDialog.then((response) => {
                                    // Promise { { response: 1, checkboxChecked: false } }
                                    console.log('Updater.ts - Got promise:', response)
                                    if(response.response == 0){
                                        shell.openExternal(newestVersion.html_url)
                                    }
                                }).catch((error) =>{
                                    console.log('Updater.ts - Update error:', error)
                                })
                            }, 2000)
                        } else {
                            console.log('Updater.ts - We got the latest version already.')
                        }
                    } else {
                        console.log('Updater.ts - Release not found on github:', app.getVersion(), 'Cannot continue the update check')
                    }

                } else {
                    console.log('Updater.ts - Got statuscode:', response.statusCode, body)
                }
            })
        })

        req.on('error', (error) => {
            console.log(error)
        });

        req.end()
    }
}