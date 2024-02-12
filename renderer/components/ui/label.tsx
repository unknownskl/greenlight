import React from 'react'

interface LabelProps {
  className?: string;
  children;
}

function Label({
    className,
    children,
    ...props
}: LabelProps) {

    className = className ? 'component_label '+className : 'component_label'


    return (
        <React.Fragment>
            <span className={className}>
                { children }
            </span>
        </React.Fragment>
    )
}

export default Label
