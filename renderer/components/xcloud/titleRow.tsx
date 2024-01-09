import React from 'react';
import ViewportGrid from '../ui/viewportgrid';
import GameTitle from '../ui/game/title';
import GameTitleDynamic from '../ui/game/titledynamic';
import Loader from '../ui/loader';

interface Props {
  children;
  titles;
  onClick?: () => void;
}

function TitleRow({
  children,
  titles,
  onClick,
  ...props
}: Props) {

  return (
    <React.Fragment>
        <div>
            <h2 className="title">{ children }</h2>
            
            <ViewportGrid maxHeight={ 140 }>{
                (titles.length == 0) ? (<p><Loader></Loader></p>) :
                  titles.map((item, i) => {
                    return (
                        <GameTitleDynamic
                        titleId={ item }
                        key = { item }
                        ></GameTitleDynamic>
                    )
                })
            }
            </ViewportGrid>
        </div>
    </React.Fragment>
  );
};

export default TitleRow;
