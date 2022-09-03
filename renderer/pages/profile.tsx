import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ipcRenderer } from 'electron'

import Header from '../components/header'
import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Loader from '../components/ui/loader'
import AchievementGameRow from '../components/achievement/gamerow'

import { useAchievements } from '../context/userContext'

function Profile() {
  const {achievements, setAchievements} = useAchievements()
  let loadingAchievements = []

  React.useEffect(() => {
    if(achievements.length <= 0){
      ipcRenderer.send('xboxweb', {
        type: 'get_recent_achievements'
      })
      loadingAchievements = []
    }

    ipcRenderer.on('xboxweb', (event, args) => {
      if(args.type === 'error'){
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type == 'get_recent_achievements') {
        console.log('Received achievements:', args)
        // @TODO: Continuation token
        loadingAchievements = [...loadingAchievements, ...args.data.titles]
        // console.log(loadingAchievements, [...loadingAchievements, ...args.data.titles])

        if(args.data.pagingInfo.continuationToken !== null){
          ipcRenderer.send('xboxweb', {
            type: 'get_recent_achievements',
            continuationToken: args.data.pagingInfo.continuationToken
          })
        } else {
          setAchievements(loadingAchievements)
        }

      } else {
        console.log('got unknown response:', args)
      }
    })

    return () => {
      ipcRenderer.removeAllListeners('xboxweb');
    };
  }, []);

  function sortAchievements(achievements){
    achievements.sort(function(a:any, b:any){
      // Turn your strings into dates, and then subtract them
      // to get a value that is either negative, positive, or zero.
      return new Date(b.lastUnlock) - new Date(a.lastUnlock);
    })

    return achievements
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - My Profile</title>
      </Head>

      <div style={{ paddingTop: '20px' }}>
        <Card className='padbottom'>
          <h1>Recent achievements</h1>

          <div>

            <div className='components_achievement_gamerow' style={{
              borderBottom: '1px solid #ffffff',
              marginBottom: 10
            }}>
              <div>
                Game
              </div>

              <div className='components_achievement_gamerow_right'>
                Achievements
              </div>
            </div>

            {sortAchievements(achievements).map((item, i) => {
              // console.log(item)
              return <AchievementGameRow achievement={ item }></AchievementGameRow>
            })}

            {achievements.length === 0 ? <Loader></Loader> : ''}
          </div>
        </Card>
      </div>

    </React.Fragment>
  );
};

export default Profile;
