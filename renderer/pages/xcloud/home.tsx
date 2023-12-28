import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { ipcRenderer } from 'electron'
import Ipc from '../../lib/ipc'

import Header from '../../components/header'
import Card from '../../components/ui/card'
import { useXcloud } from '../../context/userContext'
import Button from '../../components/ui/button'
import Loader from '../../components/ui/loader'
import Image from 'next/image';
import ViewportGrid from '../../components/ui/viewportgrid';
import GameTitle from '../../components/ui/game/title';

function xCloudLibrary() {
  const { xcloudTitles, setXcloudTitles} = useXcloud()
  const [xcloudRecentTitles, setXcloudRecentTitles] = React.useState([])
  const [filter, setFilter] = React.useState({
    name: ''
  });
  const [page, setPage] = React.useState(0);

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

    // const ipcListener = Ipc.onAction('store', 'updatePage', (event, action, args) => {
    //   console.log('Received IPC Event from backend:', event, action, args)
    // })

    // return () => {
    //   Ipc.removeListener('store', ipcListener)
    // };
  })

  function getBoxArt(images){
    for(const image in images){
      if(images[image].ImagePurpose == 'BoxArt'){
        return 'https:' + images[image].Uri
      }
    }
    console.log('no image ;(', images)
    return ''
  }

  function filterProducts(e){
    // console.log('Search value:', e.target.value)

    setPage(0)
    setFilter({
      name: e.target.value
    })

    // ipcRenderer.send('xcloud', {
    //   type: 'filter_titles',
    //   options: {
    //     name: e.target.value
    //   }
    // })
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
    const totalPages = Math.ceil(filterTitles(xcloudTitles, filter).length/resultsPerPage)
  
    buttons.push((<Button onClick={ prevPage } disabled={page <= 0} className='btn-small' label="Previous page"></Button>))
    for(let i=1; i <= totalPages; i++){
      buttons.push((<Button key={i} label={i.toString()} className={ page == (i-1) ? 'btn-small btn-primary': 'btn-small' } onClick={ () => { gotoPage(i) }}></Button>))
    }
    buttons.push((<Button onClick={ nextPage } disabled={page >= totalPages-1} className='btn-small' label="Next page"></Button>))

    return buttons
  }

  function filterTitles(titles, filter){

    let returnTitles = []
    let filterActive = false

    for(const title in titles){
      if(filter.name !== ''){
        filterActive = true
        if(titles[title].catalogDetails.ProductTitle.toLowerCase().includes(filter.name.toLowerCase())){
          returnTitles.push(titles[title])
        }
      }
    }

    if(filterActive === false){
      returnTitles = titles
    }

    // console.log('returnTitles', returnTitles)
    return returnTitles
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - xCloud Library</title>
      </Head>

      {(xcloudTitles.length == 0) ? '' : <React.Fragment>
      {/* <React.Fragment> */}
        <h2 className="title">Recent games</h2><ViewportGrid maxHeight={ 140 }>{
          (xcloudRecentTitles.length == 0) ? (<p>Loading...</p>) :
          xcloudRecentTitles.map((item, i) => {
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
      </React.Fragment>
      }

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
      }</ViewportGrid></React.Fragment> }

      {/* <div style={{ 
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        paddingTop: '20px',
        gap: 'auto'
      }}>

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
        </Card> : <Card className='padbottom fullsize'>
          <input type='text' onChange={ filterProducts } placeholder="Search xCloud title" className='card_input_text_transparent' />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 10
          }}>
            { drawPageButtons() }
          </div>
        </Card> }

        {filterTitles(xcloudTitles, filter).slice(page*resultsPerPage, ((page*resultsPerPage)+resultsPerPage)).map((item, i) => {
          console.log(item.catalogDetails)
          return (
            <Link href={ `/stream/xcloud_${item.titleId}` } key={ page+'_'+i}>
              <Image src={ `https:${item.catalogDetails.Image_Tile.URL}` } alt={ item.catalogDetails.ProductTitle } loading="lazy" width='144' height='144' style={{
                marginBottom: 10,
              }} ></Image>

              {/* <p style={{ height: '40px' }}>{item.catalogDetails.ProductTitle}</p> */}
            {/* </Link>
          )
        })}

        {(filterTitles(xcloudTitles, filter).length == 0 && xcloudTitles.length > 0) ? <Card className='padbottom fullsize'>
          <h1>No results</h1>
          <p>There are no xCloud titles matching your search query.</p>
        </Card> : ''}

        {(xcloudTitles.length == 0) ? '' : <Card className='padbottom fullsize'>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            { drawPageButtons() }
          </div>
        </Card> }
          
      </div> */}
    </React.Fragment>
  );
};

export default xCloudLibrary;
