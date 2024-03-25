import React from 'react'

interface ButtonProps {
  className?: string;
  hidden?: boolean
  children;
}

function Card({
    className,
    hidden = false,
    children,
}: ButtonProps) {

    className = className ? 'component_card '+className : 'component_card'

    return (
        <React.Fragment>
            { hidden === true ? '' : <div className={ className }>
                { children }
            </div> }
        </React.Fragment>
    )
}

export default Card
