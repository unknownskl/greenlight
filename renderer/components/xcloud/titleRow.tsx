import React from 'react'
import ViewportGrid from '../ui/viewportgrid'
import GameTitleDynamic from '../ui/game/titledynamic'
import Loader from '../ui/loader'

interface Props {
  children;
  titles;
}

function TitleRow({
    children,
    titles,
}: Props) {

    return (
        <React.Fragment>
            <div>
                <h2 className="title">{ children }</h2>
            
                <ViewportGrid maxHeight={ 140 }>{
                    (titles.length === 0) ? (<Loader></Loader>) :
                        titles.map((item) => {
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
    )
}

export default TitleRow
