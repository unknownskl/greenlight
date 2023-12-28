import React from 'react';
import ViewportGrid from '../ui/viewportgrid';
import GameTitle from '../ui/game/title';
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
                    // console.log(item.catalogDetails)
                    return (
                        <GameTitle
                        src={ 'https:'+item.catalogDetails.Image_Tile.URL }
                        name={ item.catalogDetails.ProductTitle}
                        titleId={ item.titleId }
                        key={ item.titleId }
                        ></GameTitle>
                    )
                })
            }
            </ViewportGrid>
        </div>
    </React.Fragment>
  );
};

export default TitleRow;
