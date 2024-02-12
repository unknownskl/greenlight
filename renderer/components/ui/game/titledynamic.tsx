import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Ipc from '../../../lib/ipc'
import Loader from '../loader'
import { useQuery } from 'react-query'

interface GameTitleProps {
    titleId: string;
    // children;
}

interface titleDataState {
    titleId?: string;
    catalogDetails?: {
        ProductTitle: string;
        Image_Tile: {
            URL: string;
        };
    };
}

function GameTitleDynamic({
    titleId,
    ...props
}: GameTitleProps) {
    const titleData = useQuery('titledynamic_titleId_'+titleId, () => Ipc.send('xCloud', 'getTitle', { titleId: titleId }), { staleTime: 300*1000 })

    // // const [clientHeight, setClientHeight] = React.useState(0);
    // const [titleData, setTitleData] = React.useState<titleDataState>({})


    // React.useEffect(() => {
    //     if(titleData !== undefined && titleData.titleId === undefined){
    //         Ipc.send('xCloud', 'getTitle', { titleId: titleId }).then((title) => {
    //             setTitleData(title)
    //         })
    //     }

    //     return () => {
    //         // Unmount
    //     };
    // })

    // console.log(titleData)

    return (
        <React.Fragment>
            <div className='component_gametitle'>
                <div className='component_gametitle_infopage'>
                    <Link href={ '/xcloud/info/'+titleId } title='View game page'><i className="fa-solid fa-info" /></Link>
                </div>

                { (titleData.isFetched === true && titleData.data.titleId !== undefined) ? <Link href={ `/stream/xcloud_${ titleId }` }>

                    <Image 
                        src={ 'https:'+titleData.data.catalogDetails.Image_Tile.URL }
                        alt={ titleData.data.catalogDetails.ProductTitle }
                        width='280' height='280' style={{
                            width: 140,
                            height: 140,
                            borderRadius: '4px',
                        }} ></Image>

                    <div className='component_gametitle_title'><p>{ titleData.data.catalogDetails.ProductTitle }</p></div>
                </Link> : <Loader></Loader> }
            </div>
        </React.Fragment>
    )
}

export default GameTitleDynamic
