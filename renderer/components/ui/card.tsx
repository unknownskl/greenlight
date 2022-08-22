import React from 'react';
import Link from 'next/link';

interface ButtonProps {
//   label: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  children;
  onClick?: () => void;
}

function Card({
//   label,
  title,
  disabled,
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {

  className = className ? 'component_card '+className : 'component_card'

  return (
    <React.Fragment>
        <div className={ className }>
            { children }
        </div>
    </React.Fragment>
  );
};

export default Card;
