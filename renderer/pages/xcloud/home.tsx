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
  const [filter, setFilter] = React.useState({
    name: ''
  });

  const resultsPerPage = 40

  React.useEffect(() => {
    if(xcloudTitles.length == 0){
      Ipc.send('store', 'getxCloudTitles').then((titles) => {
        setXcloudTitles(titles)
      })
    }

    // console.log(xcloudTitles.length, xcloudRecentTitles.length)
    if(xcloudTitles.length > 0 && xcloudRecentTitles.length === 0){
      Ipc.send('store', 'getRecentTitles').then((recentTitles) => {
        const returnTitles = []

        for(const recentTitle in recentTitles.results){
          // Match titles..
          for(const title in xcloudTitles){
            if(xcloudTitles[title].titleId === recentTitles.results[recentTitle].titleId){
              returnTitles.push(xcloudTitles[title])
            }
          }
        }
        
        setXcloudRecentTitles(returnTitles)
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

      {/* {(xcloudTitles.length == 0) ? <Card className='padbottom fullsize'>

          <div style={{
            display: 'flex'
          }}>
            <div style={{
              paddingRight: 20
            }}>
              <Loader></Loader>
            </div>
            <div>
              <h1>Loading xCloud library</h1>
              <p>Please wait while we retrieve your xCloud library...</p>
            </div>
          </div>
        </Card> :  */}
        
        {/* <React.Fragment>
          <h2 className="title">Library &nbsp;
            <Link href="/xcloud/library"><Button label="View Library" className='btn-small'></Button></Link>
          </h2>
          <ViewportGrid maxHeight={ 140 }>{
            xcloudTitles.map((item, i) => {
              // console.log(item.catalogDetails)
              return (
                <GameTitle
                  src={ 'https:'+item.catalogDetails.Image_Tile.URL }
                  name={ item.catalogDetails.ProductTitle}
                  titleId={ item.titleId }
                  key={ item.titleId }
                ></GameTitle>
              )
            })
          }</ViewportGrid>
        </React.Fragment> */}

        <TitleRow titles={ xcloudTitles }>
          Library &nbsp;
          <Link href="/xcloud/library"><Button label="View Library" className='btn-small'></Button></Link>
        </TitleRow>
        
        {/* } */}

    </React.Fragment>
  );
};

export default xCloudHome;
