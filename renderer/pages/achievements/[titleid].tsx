import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import AchievementRow from '../../components/achievement/row'
import Loader from '../../components/ui/loader'

function AchievmentTitle() {
    // const router = useRouter()
    // const [achievements, setAchievements] = React.useState([])
    const achievements = []
    // let loadingAchievements = []

    React.useEffect(() => {

        // if(achievements.length === 0){
        //     // ipcRenderer.send('xboxweb', {
        //     //   type: 'get_recent_achievements_titleid',
        //     //   titleid: router.query.titleid,
        //     // })
        //     loadingAchievements = []
        // }

        // ipcRenderer.on('xboxweb', (event, args) => {
        //   if(args.type === 'error'){
        //     alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

        //   } else if(args.type == 'get_recent_achievements_titleid') {
        //     console.log('Received achievements:', args)

        //     loadingAchievements = [...loadingAchievements, ...args.data.achievements]

        //     if(args.data.pagingInfo.continuationToken !== null){
        //       ipcRenderer.send('xboxweb', {
        //         type: 'get_recent_achievements_titleid',
        //         titleid: router.query.titleid,
        //         continuationToken: args.data.pagingInfo.continuationToken,
        //       })
        //     } else {
        //       setAchievements(loadingAchievements)
        //     }

        //   } else {
        //     console.log('got unknown response:', args)
        //   }
        // })

        return () => {
            // ipcRenderer.removeAllListeners('xboxweb')
        }
    })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - View achievements</title>
            </Head>

            <div style={{ paddingTop: '20px' }}>
                <Card>
                    {achievements.map((item) => {
                        return <AchievementRow achievement={ item }></AchievementRow>
                    })}

                    {achievements.length === 0 ? <Loader></Loader> : ''}
                </Card>
            </div>
        </React.Fragment>
    )
}

export default AchievmentTitle
