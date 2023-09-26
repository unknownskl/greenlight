import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface GameTitleProps {
    name: string
    src: string
    titleId: string
    // children;
}

function GameTitle({
    name,
    src,
    titleId,
    // children,
    ...props
}: GameTitleProps) {
    // const [clientHeight, setClientHeight] = React.useState(0);

    React.useEffect(() => {
        // Mount

        return () => {
            // Unmount
        };
    })

    return (
        <React.Fragment>
            <Link href={ `/stream/xcloud_${ titleId }` } className='component_gametitle'>
              <Image src={ src } alt={ name } width='280' height='280' style={{
                width: 140,
                height: 140,
                borderRadius: '4px',
              }} ></Image>

              <div className='component_gametitle_title'><p>{ name }</p></div>
            </Link>
        </React.Fragment>
    );
};

export default GameTitle;
