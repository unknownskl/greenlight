import React from 'react'
import Link from 'next/link'

interface BreadcrumbBarProps {
  children;
  onClick?: () => void;
}

function BreadcrumbBar({
    children,
    onClick,
    ...props
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
