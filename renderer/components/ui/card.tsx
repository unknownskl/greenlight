import React from 'react'

interface ButtonProps {
  className?: string;
  children;
}

function Card({
    className,
    children,
}: ButtonProps) {

    className = className ? 'component_card '+className : 'component_card'

    return (
        <React.Fragment>
            <div className={ className }>
                { children }
            </div>
        </React.Fragment>
    )
}

export default Card
