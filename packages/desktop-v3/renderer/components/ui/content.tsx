import React from 'react';

interface ContentProps {
  children: React.ReactNode;
  fullscreen?: boolean;
}

export default function Content({
  children,
  fullscreen = false
}: ContentProps) {

  return (
    <React.Fragment>

        <div className={fullscreen ? 'fullscreen' : 'mb-8 animate-fade-in-up p-4'}>
            {children}
        </div>
      
    </React.Fragment>
  );
}