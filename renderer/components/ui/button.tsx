import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  label: string | any;
  icon?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  onClick?: (e) => void;
}

function Button({
  label,
  icon,
  title,
  disabled,
  className,
  onClick,
  ...props
}: ButtonProps) {
  
  if(label === undefined)
    label = 'Button'

  className = className ? 'btn '+className : 'btn'

  return (
    <React.Fragment>
        <button className={className} title={title} onClick={onClick} disabled={disabled} style={(icon) ? {
          backgroundImage: `url(${icon})`,
          backgroundRepeat: 'no-repeat, no-repeat',
          backgroundPosition: 'left 10px bottom  50%',
          backgroundSize: 18,
          paddingLeft: 35,
          // height: 41,
        }:{}}>{label}</button>
    </React.Fragment>
  );
};

export default Button;
