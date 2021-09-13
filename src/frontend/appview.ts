import Application from "./application";
// import https from 'https'
import apiClient from "./apiclient";

export default class AppView {

    _application:Application;
    _apiClient;

    constructor(application:Application){
        this._application = application

        console.log('AppView.js: Created view')

        const backgrounds = [
            'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_1.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_2.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_3.jpg\')',
            // 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_4.jpg\')',
        ]

        const appView = (<HTMLInputElement>document.getElementById('appView'))
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_1.jpg')"
        // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_2.jpg')"
        const randomSelect = backgrounds[Math.floor(Math.random()*backgrounds.length)];
        appView.style.backgroundImage = randomSelect
        

        // Fetch consoles...
        fetch('https://uks.gssv-play-prodxhome.xboxlive.com/v6/servers/home', {
            method: 'GET', // *GET, POST, PUT, DELETE, etc.
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            // credentials: 'same-origin', // include, *same-origin, omit
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
              // 'Content-Type': 'application/x-www-form-urlencoded',
            }
        }).then((response) => {
            if(response.status !== 200){
                console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
            } else {
                response.json().then((data) => {
                    console.log('consoles:', data)

                    this.showConsoles(data.results)

                }).catch((error) => {
                    console.log('ERROR json',  error)
                })
                // const responseData = JSON.parse(response.body);
            }
        }).catch((error) => {
            console.log('ERROR retrieve consoles',  error)
        });

        // this._apiClient = XboxApi({
        //     uhs: this._application._tokenStore._web.uhs,
        //     userToken: this._application._tokenStore._web.userToken
        // })

        this._apiClient = new apiClient(this._application._tokenStore._web.uhs, this._application._tokenStore._web.userToken)
        this._apiClient.getProfile().then((profile:any) => {
            console.log(profile)

            if(profile.profileUsers[0] !== undefined){

                const userProfileName = (<HTMLInputElement>document.getElementById('actionBarUserProfile'))
                const userProfileLogo = (<HTMLInputElement>document.getElementById('userProfileLogo'))
                const userProfileGamerscore = (<HTMLInputElement>document.getElementById('actionBarUserGamerscore'))
                

                const settings = profile.profileUsers[0].settings
                for(const setting in settings){
                    
                    switch(settings[setting].id){
                        case 'GameDisplayName':
                            // console.log('game name:', settings[setting].value)
                            userProfileName.innerText = settings[setting].value
                            break;
                        case 'GameDisplayPicRaw':
                            userProfileLogo.src = settings[setting].value
                            break;
                        case 'Gamerscore':
                            userProfileGamerscore.innerText = settings[setting].value
                            break;
                        case 'GamerTag':
                            console.log('game name:', settings[setting].value)
                            break;
                    }
                }

                // @TODO: Show user menu
            }
        }).catch((error) => {
            console.log('error:', error)
        })

        // Load friends
        this._apiClient = new apiClient(this._application._tokenStore._web.uhs, this._application._tokenStore._web.userToken)


        const intervalFriendsHandler = () => {
            this._apiClient.getFriends().then((profiles:any) => {
                // console.log('Loaded friends:', profiles.people)
                // console.log('User has '+profiles.people.length+' friends')

                const friendsList = (<HTMLInputElement>document.getElementById('friendsList'))
                let friendsHtml = '<ul class="people">'

                // Query for online peopple
                for(const person in profiles.people){
                    if(profiles.people[person].presenceState === 'Online'){
                        friendsHtml += '<li class="online">'
                        friendsHtml += '    <img class="userimage" src="'+profiles.people[person].displayPicRaw+'" />'
                        friendsHtml += '    <div class="userinfo">'
                        friendsHtml += '        <p>'+profiles.people[person].displayName+'</p>'

                        let isGame = false
                        const presenceDetails = profiles.people[person].presenceDetails
                        for(const detail in presenceDetails){
                            if(presenceDetails[detail].IsGame === true && presenceDetails[detail].IsPrimary === true)
                                isGame = true
                        }

                        if(profiles.people[person].presenceText !== '' && isGame === true)
                            friendsHtml += '        <p class="userstatus"><img src="assets/icons/gamepad.svg" width="15 height="15 /> '+profiles.people[person].presenceText+'</p>'

                        else if(profiles.people[person].presenceText !== '' && isGame === false)
                            friendsHtml += '        <p class="userstatus">'+profiles.people[person].presenceText+'</p>'
                        else
                            friendsHtml += '        <p class="userstatus">'+profiles.people[person].presenceState+'</p>'

                        friendsHtml += '    </div>'
                        friendsHtml += '</li>'
                    }
                }

                // // Query for offline people
                // for(const person in profiles.people){
                //     if(profiles.people[person].presenceState === 'Offline'){
                //         friendsHtml += '<li class="offline">'
                //         friendsHtml += '    <img class="userimage" src="'+profiles.people[person].displayPicRaw+'" />'
                //         friendsHtml += '    <div class="userinfo">'
                //         friendsHtml += '        <p>'+profiles.people[person].displayName+'</p>'

                //         if(profiles.people[person].presenceText === profiles.people[person].presenceState)
                //             friendsHtml += '        <p>'+profiles.people[person].presenceState+'</p>'
                //         else
                //             friendsHtml += '        <p class="userstatus">'+profiles.people[person].presenceState+' - '+profiles.people[person].presenceText+'</p>'

                //         friendsHtml += '    </div>'
                //         friendsHtml += '</li>'
                //     }
                // }
                friendsHtml += '</ul>'

                friendsList.innerHTML = friendsHtml

                document.querySelectorAll('img.userimage').forEach(function(img){
                    img = (<HTMLElement>img)
                    img.addEventListener('error', (event) => {
                        console.log('imgsrror:', event)
                    })
                    // img.onerror = function(){
                    //     this.style.display='none';
                    // };
                })

            }).catch((error) => {
                console.log('error:', error)
            })
        }
        setInterval(intervalFriendsHandler, 60000)
        intervalFriendsHandler()

        // Load user profile
        // this._apiClient.isAuthenticated().then(() => {
        //     console.log('User is authenticated.')
        
        //     this._apiClient.getProvider('profile').getUserProfile().then((result:any) => {
        //         console.log('resolve user profile:', result)
        
        //     }).catch(function(error:any){
        //         console.log('reject', error)
        //     })
        
        // }).catch(function(error:any){
        //     console.log('User is not authenticated. Run authentication flow first.', error)
        // })
          
    }

    showConsoles(consoles:any){
        const consolesList = (<HTMLInputElement>document.getElementById('consolesList'))

        let consolesHtml = '';

        for(const device in consoles) {
            let powerState = consoles[device].powerState

            if(powerState === 'On')
                powerState = 'Powered on'
            
            if(powerState === 'ConnectedStandby')
                powerState = 'Standby (Connected)'

            consolesHtml += '<div class="consoleItem">'
            consolesHtml += '   <h1>'+consoles[device].deviceName+'</h1>'
            consolesHtml += '   <img src="data:image/png;base64,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" width="50%" /><br />'
            consolesHtml += '   <h2>('+consoles[device].consoleType+': '+consoles[device].serverId+')</h2>'
            consolesHtml += '   <p>'+powerState+'</p>'

            consolesHtml += '   <button class="btn btn-primary" id="console_connect_'+device+'">Connect</p>'
            
            // consolesHtml += consoles[device].deviceName+' ('+consoles[device].consoleType+') - '+consoles[device].serverId+' isSameNetwork:'+!consoles[device].outOfHomeWarning+' <button>'+consoles[device].powerState+'</button> <button onclick="client.startSession(\'xhome\', \''+consoles[device].serverId+'\')">Start session</button>'
            consolesHtml += '</div>'
        }

        if(consoles.length === 0){
            consolesHtml += '<div class="consoleItem">'
            consolesHtml += '   <h1>No consoles found</h1>'
            consolesHtml += '   <img src="data:image/png;base64,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" width="50%" /><br />'
            consolesHtml += '   <p>We cound not find any of your consoles attached to your account.</p>'
            consolesHtml += '</div>'
        }

        consolesList.innerHTML = consolesHtml
        
        for(const device in consoles) {
            document.getElementById('console_connect_'+device).addEventListener('click', (e:Event) => {
                this._application.startStream('xhome', consoles[device].serverId)
            })
        }
    }

    load(){
        return new Promise((resolve, reject) => {
            console.log('AppView.js: Loaded view')

            resolve(true)
        })
    }

    unload(){
        return new Promise((resolve, reject) => {
            console.log('AppView.js: Unloaded view')
            resolve(true)
        })
    }
}