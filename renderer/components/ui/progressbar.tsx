import React from 'react'

interface ButtonProps {
  value?: number;
  children;
}

function ProgressBar({
    value,
    children,
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
