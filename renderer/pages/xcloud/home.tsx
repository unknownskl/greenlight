import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Ipc from '../../lib/ipc'

import Card from '../../components/ui/card'
import { useXcloud } from '../../context/userContext'
import Button from '../../components/ui/button'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid';
import GameTitle from '../../components/ui/game/title';
import BreadcrumbBar from '../../components/ui/breadcrumbbar';
import TitleRow from '../../components/xcloud/titleRow';

function xCloudHome() {
  const { xcloudTitles, setXcloudTitles} = useXcloud()
  const [xcloudRecentTitles, setXcloudRecentTitles] = React.useState([])
  const [xCloudNewTitles, setXcloudNewTitles] = React.useState([])
  const [xCloudNewTitlesLoaded, setXcloudNewTitlesLoaded] = React.useState(false)

  React.useEffect(() => {
    if(xcloudTitles.length == 0){
      Ipc.send('xCloud', 'getTitles').then((titles) => {
        setXcloudTitles(titles)
      })
    }

    // console.log(xcloudTitles.length, xcloudRecentTitles.length)
    if(xcloudTitles.length > 0 && xcloudRecentTitles.length === 0){
      Ipc.send('xCloud', 'getRecentTitles').then((recentTitles) => {
        setXcloudRecentTitles(recentTitles)
      })
    }

    if(xcloudTitles.length > 0 && xCloudNewTitlesLoaded === false){
      Ipc.send('xCloud', 'getNewTitles').then((newTitles) => {
        setXcloudNewTitlesLoaded(true)
        setXcloudNewTitles(newTitles)
      }).catch((err) => {
        console.log('Error loading titles:', err)
        setXcloudNewTitlesLoaded(true)
      })
    }
  })

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - xCloud Library</title>
      </Head>

      <BreadcrumbBar>
        <Link href="/xcloud/home">xCloud</Link>
        {/* <Link href="/xcloud/library">Library</Link> */}
      </BreadcrumbBar>

      <TitleRow titles={ xcloudRecentTitles }>Recent Games</TitleRow>

        <TitleRow titles={ xCloudNewTitles }>
          Recently added &nbsp;
          <Link href="/xcloud/library"><Button label="View Library" className='btn-small'></Button></Link>
        </TitleRow>
        
        {/* } */}

    </React.Fragment>
  );
};

export default xCloudHome;
