import React from 'react';
import Head from 'next/head';
import Ipc from '../../lib/ipc'
import Link from 'next/link';

import Card from '../../components/ui/card'
import { useXcloud } from '../../context/userContext'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid';
import GameTitle from '../../components/ui/game/title';
import BreadcrumbBar from '../../components/ui/breadcrumbbar';


function xCloudLibrary() {
  const { xcloudTitles, setXcloudTitles} = useXcloud()
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
  })

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - xCloud Library</title>
      </Head>

      <BreadcrumbBar>
        <Link href="/xcloud/home">xCloud</Link>
        <Link href="/xcloud/library">Library</Link>
      </BreadcrumbBar>

      {(xcloudTitles.length == 0) ? <Card className='padbottom fullsize'>

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
        </Card> : <React.Fragment><h2 className="title">Library</h2><ViewportGrid drawPagination={true}>{
        xcloudTitles.map((item, i) => {
          return (
            <GameTitle
              src={ 'https:'+item.catalogDetails.Image_Tile.URL }
              name={ item.catalogDetails.ProductTitle}
              titleId={ item.titleId }
              key={ item.titleId }
            ></GameTitle>
          )
        })
      }</ViewportGrid></React.Fragment> }

    </React.Fragment>
  );
};

export default xCloudLibrary;
