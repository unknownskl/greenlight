import React from 'react';

interface ContentProps {
  children: React.ReactNode;
}

export default function Content({
  children
}: ContentProps) {

  return (
    <React.Fragment>

        <div className="mb-8 animate-fade-in-up p-1">
            {children}
        </div>
      
    </React.Fragment>
  );
}