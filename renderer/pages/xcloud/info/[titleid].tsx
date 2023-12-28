import React from 'react';
import Head from 'next/head';
import Ipc from '../../../lib/ipc'
import Link from 'next/link';
import Image from 'next/image';
import { Router, useRouter } from 'next/router'

import Card from '../../../components/ui/card'
import { useXcloud } from '../../../context/userContext'
import BreadcrumbBar from '../../../components/ui/breadcrumbbar';
import Button from '../../../components/ui/button';
import Loader from '../../../components/ui/loader';


function xCloudInfo() {
  const router = useRouter()

  const [productDetails, setProductDetails] = React.useState(undefined);
  const [productName, setProductName] = React.useState('...');

  const { xcloudTitles, setXcloudTitles} = useXcloud()
//   const [filter, setFilter] = React.useState({
//     name: ''
//   });

//   const resultsPerPage = 40

  React.useEffect(() => {
    if(productDetails === undefined){
        Ipc.send('store', 'getxCloudTitle', { titleId: router.query.titleid}).then((title) => {
            console.log(title)

            setProductDetails(title)
        })
    } else {
        setProductName(productDetails.catalogDetails.ProductTitle)
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
        <Link href={ "/xcloud/info/"+router.query.titleid }>{productName}</Link>
      </BreadcrumbBar>

      {(productDetails === undefined) ? <React.Fragment><Loader></Loader></React.Fragment> : <React.Fragment>
      <div id="page_info_background" style={{
          background: 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 25%, rgba(0,212,255,0) 100%), url(https:'+productDetails?.catalogDetails.Image_Hero.URL+')',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover'
        }}></div>
          
        <div id="page_info_titleid">
            <h1>{productName}</h1>
            <h2>by { productDetails.catalogDetails.PublisherName }</h2>

            <div id="page_info_titleid_sidebar">
              <Image src={ 'https:'+productDetails.catalogDetails.Image_Poster.URL } alt={productName} width={ 640/4 } height={ 960/4 } /><br />
              <br />

              <Link href={ "/stream/xcloud_"+router.query.titleid }>
                  <Button label={ 'Stream Game' } className='btn-primary'></Button>
              </Link>
            </div>

            <div id="page_info_titleid_content">
              <h3>Description</h3>

              <p>
                { productDetails.catalogDetails.ProductDescriptionShort }
              </p>

              <h3>Capabilities</h3>

              <div>
                {productDetails.catalogDetails.Attributes.map((item, i) => {
                  if(item.LocalizedName == '')
                    return;

                  return <span className='page_info_pill' id={ item.Name } key={item.Name }>{item.LocalizedName}</span>
                })}
              </div>
            </div>
        </div>
      </React.Fragment>}

    </React.Fragment>
  );
};

export default xCloudInfo;
