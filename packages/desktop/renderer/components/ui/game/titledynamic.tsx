import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Ipc from '../../../lib/ipc'
import Loader from '../loader'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'

interface GameTitleProps {
    titleId: string;
}

interface titleDataState {
    titleId?: string;
    catalogPending?: boolean;
    hasEntitlement?: boolean;
    catalogDetails?: {
        ProductTitle: string;
        Image_Tile: {
            URL: string;
        };
    };
}

function GameTitleDynamic({
    titleId,
}: GameTitleProps) {
    const titleData = useQuery<titleDataState>('titledynamic_titleId_'+titleId, () => Ipc.send('xCloud', 'getTitle', { titleId: titleId }), {
        staleTime: 300*1000,
        refetchInterval: (data) => data?.catalogPending ? 2000 : false,
    })
    const { t } = useTranslation()

    const title = titleData.data?.catalogDetails?.ProductTitle || titleId
    const catalogImage = titleData.data?.catalogDetails?.Image_Tile?.URL
    let image = '/images/logo.png'
    if(catalogImage){
        image = catalogImage.startsWith('//') ? 'https:'+catalogImage : catalogImage
    }

    return (
        <React.Fragment>
            <div className={ `component_gametitle${titleData.data?.hasEntitlement === false ? ' component_gametitle_unentitled' : ''}` }>
                <div className='component_gametitle_infopage'>
                    <Link href={ '/xcloud/info/'+titleId } title={t("page.xCloudLibrary.viewGamePageIcon")}><i className="fa-solid fa-info" /></Link>
                </div>

                { (titleData.isLoading !== true) ? <Link href={ titleData.data?.hasEntitlement !== true ? `/xcloud/info/${ titleId }` : `/stream/xcloud_${ titleId }` }>

                    <Image
                        src={ image }
                        alt={ title }
                        width='280' height='280' style={{
                            width: 140,
                            height: 140,
                            borderRadius: '4px',
                            objectFit: 'contain',
                        }} ></Image>

                    <div className='component_gametitle_title'><p>{ title }</p></div>
                </Link> : <Loader></Loader> }
            </div>
        </React.Fragment>
    )
}

export default GameTitleDynamic
