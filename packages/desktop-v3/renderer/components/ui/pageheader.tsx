import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string
}

export default function PageHeader({
  title,
  subtitle
}: PageHeaderProps) {

  return (
    <React.Fragment>

        <div className="m-4 animate-fade-in-up">
          <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
          {subtitle && <p className="text-white/40 text-sm">{subtitle}</p>}
        </div>
      
    </React.Fragment>
  );
}