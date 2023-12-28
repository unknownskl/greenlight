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

      {(productDetails === undefined) ? <React.Fragment>Loading...</React.Fragment> : <React.Fragment>
        <div className="product_page">
            <h1>{productName}</h1>
            <Image src={ 'https:'+productDetails?.catalogDetails.Image_Poster.URL } alt={productName} width={ 640/2 } height={ 960/2 } /><br />

            <Link href={ "/stream/xcloud_"+router.query.titleid }>
                <Button label={ 'Stream Game' }></Button>
            </Link>
        </div>
      </React.Fragment>}

    </React.Fragment>
  );
};

export default xCloudInfo;
