import Application from '../application'

export default class xboxWorker {

    _application:Application
    
    _friends = {}
    _onlineFriends = {}

    constructor(application){
        this._application = application

        this._application._events.on('loaded', () => {
            // We can assume we are authenticted now
            // console.log('xboxWorker has been loaded!')
            // new Notification({ title: 'User logged in', body: 'Welcome back, '+userinfo.gamertag }).show()

            setInterval(() => {
                this.intervalFriends() 
            }, 30 * 1000) // Api is limited to 30 requests per 300 seconds. (300/30 = 10 sec)
            this.intervalFriends()
        })
    }

    intervalFriends(){
        // console.log('xbox worker loop run')

        this.updateFriends().then((friends:any) => {
            // Get all friends
            // console.log('xboxWorker - Updated friends successfully')

            // Send over online friends
            const onlineFriends = []
            for(const friend in friends){
                if(friends[friend].presenceState !== 'Offline'){
                    onlineFriends.push(friends[friend])
                }
            }

            this._onlineFriends = onlineFriends
        }).catch((error) => {
            console.log('xboxWorker - Error updating friends:', error)
        })

    }

    updateFriends(){
        return new Promise((resolve, reject) => {
            this._application._events._webApi.getProvider('people').getFriends().then((friends) => {
                for(const friend in friends.people){
                    this._friends[friends.people[friend].xuid] = friends.people[friend]
                }

                resolve(this._friends)
            }).catch((error) => {
                reject(error)
            })
        })
    }

}