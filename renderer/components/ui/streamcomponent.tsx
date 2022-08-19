import React from 'react';

interface StreamComponentProps {
  // videoid: string;
}

function StreamComponent({
  // videoid,
  ...props
}: StreamComponentProps) {

  return (
    <React.Fragment>
      <div id="streamComponent">
      </div>
    </React.Fragment>
  );
};

export default StreamComponent;
