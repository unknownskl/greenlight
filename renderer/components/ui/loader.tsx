import React from 'react'

interface LoaderProps {
  // className?: string;
  // children;
}

function Loader({
    // className,
    // children,
    ...props
}: LoaderProps) {

    // className = className ? 'component_loader '+className : 'component_loader'


    return (
        <React.Fragment>
            <div className="lds-ring"><div></div><div></div><div></div><div></div></div><br />
        </React.Fragment>
    )
}

export default Loader
