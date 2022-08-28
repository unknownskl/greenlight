import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  label: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

function Button({
  label,
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
        <button className={className} title={title} onClick={onClick} disabled={disabled}>{label}</button>
    </React.Fragment>
  );
};

export default Button;
