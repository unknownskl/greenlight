import React from 'react'
import Head from 'next/head'
import Ipc from '../../../lib/ipc'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import BreadcrumbBar from '../../../components/ui/breadcrumbbar'
import Button from '../../../components/ui/button'
import Loader from '../../../components/ui/loader'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'



function xCloudInfo() {
    const router = useRouter()
    const productDetails = useQuery('xcloudinfo_titleId_'+router.query.titleid, () => Ipc.send('xCloud', 'getTitle', { titleId: router.query.titleid}), { staleTime: 10*1000 })
    const [productName, setProductName] = React.useState('...')
    const { t } = useTranslation()
    const hasEntitlement = productDetails.data?.hasEntitlement !== false

    if(productDetails.isFetched === true && productName === '...')
        setProductName(productDetails.data.catalogDetails.ProductTitle)

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.titleInfo.pageTitle')} { router.query.titleid }</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.titleInfo.breadcrumb1')}</Link>
                <Link href="/xcloud/library">{t('page.titleInfo.breadcrumb2')}</Link>
                <Link href={ '/xcloud/info/'+router.query.titleid }>{productName}</Link>
            </BreadcrumbBar>

            {(productDetails.isFetched !== true) ? <React.Fragment><Loader></Loader></React.Fragment> : <React.Fragment>
                <div id="page_info_background" style={{
                    background: 'linear-gradient(0deg, rgba(26,27,30,0.7) 0%, rgba(26,27,30,0.7) 90%, rgba(26,27,30,0.7) 100%), url(https:'+ productDetails.data.catalogDetails.Image_Hero?.URL +')',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                }}></div>

                <div id="page_info_titleid">

                    <div id="page_info_hero">
                        <h1>{productName}</h1>
                        <h2>{t('page.titleInfo.by')} { productDetails.data.catalogDetails.PublisherName }</h2>
                    </div>

                    <div id="page_info_titleid_sidebar">
                        <Image src={ 'https:'+productDetails.data.catalogDetails.Image_Poster?.URL } alt={productName} width={ 640/4 } height={ 960/4 } /><br />
                        <br />

                        {hasEntitlement ? <Link href={ '/stream/xcloud_'+router.query.titleid }>
                            <Button label={ t('page.titleInfo.startStreamBtn') } className='btn-primary'></Button>
                        </Link> : <Button label={ t('page.titleInfo.purchaseRequiredBtn') } className='btn-primary' disabled={true}></Button>}
                    </div>

                    <div id="page_info_titleid_content">
                        <h3>{t('page.titleInfo.descriptionTitle')}</h3>

                        <p>
                            { productDetails.data.catalogDetails.ProductDescriptionShort }
                        </p>

                        <h3>{t('page.titleInfo.capabilitiesTitle')}</h3>

                        <div>
                            {productDetails.data.catalogDetails.Attributes.map((item) => {
                                if(item.LocalizedName === '')
                                    return

                                return <span className='page_info_pill' id={ item.Name } key={item.Name }>{item.LocalizedName}</span>
                            })}
                        </div>
                    </div>
                </div>
            </React.Fragment>}

        </React.Fragment>
    )
}

export default xCloudInfo
