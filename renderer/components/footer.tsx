import React from 'react'

interface FooterProps {
  hidden?: boolean;
}

function Footer({
    hidden = true,
    
}: FooterProps) {
  
    return (
        <React.Fragment>
            <noscript>{ hidden }</noscript>
        </React.Fragment>
    )
}

export default Footer
