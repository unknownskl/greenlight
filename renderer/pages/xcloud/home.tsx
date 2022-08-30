import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { ipcRenderer } from 'electron'

import Header from '../../components/header'
import Card from '../../components/ui/card'
import { useXcloud } from '../../context/userContext'
import Button from '../../components/ui/button';

function xCloudLibrary() {
  const { xcloudTitles, setXcloudTitles} = useXcloud()
  const [filter, setFilter] = React.useState({
    name: ''
  });

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
        return images[image].Uri
      }
    }
    console.log('no image ;(', images)
    return ''
  }

  function filterProducts(e){
    console.log('Search value:', e.target.value)

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
          <h1>Loading xCloud library</h1>
          <p>Please wait while we retrieve your xCloud library...</p>
        </Card> : <Card className='padbottom fullsize'>
          <input type='text' onChange={ filterProducts } placeholder="Search" className='card_input_text_transparent' />
        </Card> }

        {xcloudTitles.map((item, i) => {               
          // console.log(item)

          if(filter.name !== ''){
            if(! item.LocalizedProperties[0].ProductTitle.toLowerCase().includes(filter.name.toLowerCase())){
              return
            }
          }

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
          
      </div>
    </React.Fragment>
  );
};

export default xCloudLibrary;
