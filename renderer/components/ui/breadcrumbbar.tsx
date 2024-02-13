import React from 'react'

interface BreadcrumbBarProps {
  children;
}

function BreadcrumbBar({
    children,
}: BreadcrumbBarProps) {

    return (
        <React.Fragment>
            <div className='component_breadcrumbbar'>
                { children }
            </div>
            <div className='component_breadcrumbbar_push'></div>
        </React.Fragment>
    )
}

export default BreadcrumbBar
