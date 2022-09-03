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
  const [page, setPage] = React.useState(0);
  let loadingAchievements = []
  const resultsPerPage = 10

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
        loadingAchievements = [...loadingAchievements, ...args.data.titles]

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

  function filterAchievements(achievements){

    // Sort
    achievements.sort(function(a:any, b:any){
      return (new Date(b.lastUnlock) as any) - (new Date(a.lastUnlock) as any)
    })

    return achievements
  }

  function nextPage(){
    setPage(page+1)
    window.scrollTo({ top: 0 })
  }

  function prevPage(){
    setPage(page-1)
    window.scrollTo({ top: 0 })
  }

  function gotoPage(page){
    setPage(parseInt(page)-1)
    window.scrollTo({ top: 0 })
  }

  function drawPageButtons(){
    const buttons = []
    const totalPages = Math.ceil(filterAchievements(achievements).length/resultsPerPage)
  
    buttons.push((<Button onClick={ prevPage } disabled={page <= 0} label="Previous page"></Button>))
    for(let i=1; i <= totalPages; i++){
      buttons.push((<Button key={i} label={i.toString()} className={ page == (i-1) ? 'btn-primary': '' } onClick={ () => { gotoPage(i) }}></Button>))
    }
    buttons.push((<Button onClick={ nextPage } disabled={page >= totalPages-1} label="Next page"></Button>))

    return buttons
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

            {filterAchievements(achievements).slice(page*resultsPerPage, ((page*resultsPerPage)+resultsPerPage)).map((item, i) => {
              // console.log(item)
              return <AchievementGameRow achievement={ item }></AchievementGameRow>
            })}

            {achievements.length === 0 ? <Loader></Loader> : ''}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: 10
            }}>
              { drawPageButtons() }
            </div>
          </div>
        </Card>
      </div>

    </React.Fragment>
  );
};

export default Profile;
