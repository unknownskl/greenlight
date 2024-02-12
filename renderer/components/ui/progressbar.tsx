import React from 'react'
import Link from 'next/link'

interface ButtonProps {
//   label: string;
  value?: number;
  children;
  onClick?: () => void;
}

function ProgressBar({
    value,
    children,
    onClick,
    ...props
}: ButtonProps) {

    return (
        <React.Fragment>
            <div className='component_progressbar'>
                <div className='component_progressbar_filler' style={{ width: value }}>
                    { children }
                </div>
            </div>
        </React.Fragment>
    )
}

export default ProgressBar
