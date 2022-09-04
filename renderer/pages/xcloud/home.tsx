import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { ipcRenderer } from 'electron'

import Header from '../../components/header'
import Card from '../../components/ui/card'
import { useXcloud } from '../../context/userContext'
import Button from '../../components/ui/button'
import Loader from '../../components/ui/loader'

function xCloudLibrary() {
  const { xcloudTitles, setXcloudTitles} = useXcloud()
  const [filter, setFilter] = React.useState({
    name: ''
  });
  const [page, setPage] = React.useState(0);

  const resultsPerPage = 40

  React.useEffect(() => {
    if(xcloudTitles.length == 0){
      ipcRenderer.send('xcloud', {
        type: 'get_titles'
      })
    }

    ipcRenderer.on('xcloud', (event, args) => {
      if(args.type === 'error'){
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type === 'get_titles'){
        // console.log('xCloud titles response:', args)
        setXcloudTitles(args.data)
      }
    })

    return () => {
      ipcRenderer.removeAllListeners('stream');
    };
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
    console.log('Search value:', e.target.value)

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
  
    buttons.push((<Button onClick={ prevPage } disabled={page <= 0} label="Previous page"></Button>))
    for(let i=1; i <= totalPages; i++){
      buttons.push((<Button key={i} label={i.toString()} className={ page == (i-1) ? 'btn-primary': '' } onClick={ () => { gotoPage(i) }}></Button>))
    }
    buttons.push((<Button onClick={ nextPage } disabled={page >= totalPages-1} label="Next page"></Button>))

    return buttons
  }

  function filterTitles(titles, filter){

    let returnTitles = []
    let filterActive = false

    for(const title in titles){
      if(filter.name !== ''){
        filterActive = true
        if(titles[title].LocalizedProperties[0].ProductTitle.toLowerCase().includes(filter.name.toLowerCase())){
          returnTitles.push(titles[title])
        }
      }
    }

    if(filterActive === false){
      returnTitles = titles
    }

    return returnTitles
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - xCloud Library</title>
      </Head>

      <div style={{ 
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
          return (
            <Card className='padbottom fixedsize' key={i}>
              <p style={{ height: '40px' }}>{item.LocalizedProperties[0].ProductTitle}</p>

              <img src={ getBoxArt(item.LocalizedProperties[0].Images) } loading='lazy' style={{
                width: 150,
                height: 150,
                marginBottom: 10,
              }} />

              <Link href={ `/stream/xcloud_${item.xcloudInfo.titleId}` }>
                <Button label="Start stream" className='btn-primary' />
              </Link>
            </Card>
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
          
      </div>
    </React.Fragment>
  );
};

export default xCloudLibrary;
