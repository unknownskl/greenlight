import React from 'react';
import Link from 'next/link';
import Button from './button';

interface ViewportGridProps {
    drawPagination?:boolean
    maxHeight?:number
    children;
}

function ViewportGrid({
    drawPagination = false,
    maxHeight = -1,
    children,
    ...props
}: ViewportGridProps) {
    const randomId = Math.floor(Math.random()*1000)
    const [showItems, setShowItems] = React.useState(9999);
    const [page, setPage] = React.useState(0);
    // const [clientWidth, setClientWidth] = React.useState(0);
    // const [clientHeight, setClientHeight] = React.useState(0);

    React.useEffect(() => {
        // Mount
        let resizeLastUpdate = Date.now()

        const resizeEvent = () => {
            const now = Date.now()
            if(now-resizeLastUpdate > 250){
                const element = document.getElementById('component_viewportgrid_'+randomId)

                if(element === null || element.parentElement === null)
                    return;

                const parentHeight = element.parentElement.parentElement.offsetTop+element.parentElement.parentElement.clientHeight
                const parentWidth = element.parentElement.parentElement.offsetLeft+element.parentElement.parentElement.clientWidth
                let newElementHeight = (maxHeight < 0) ? (parentHeight-element.offsetTop) : maxHeight

                if(drawPagination === true){
                    newElementHeight = newElementHeight-32
                }

                element.style.height = newElementHeight+'px'
                // element.style.width = newElementHeight+'px'

                let itemsShown = calculateChildrenInViewportCouldFit(element)
                if (itemsShown < 6){
                    itemsShown = 6
                }

                resizeLastUpdate = Date.now()
                setShowItems(itemsShown)
            }
        }
        // window.addEventListener('resize', resizeEvent);
        resizeEvent()
        const resizeInterval = setInterval(() => {
            resizeEvent()
        }, 250)

        return () => {
            // Unmount
            // window.removeEventListener('resize', resizeEvent)
            clearInterval(resizeInterval)
        };
    })

    // function calculateChildrenInViewport(element:HTMLElement){

    //     let itemsInViewport = 0
    //     for(const child in Object.keys(element.childNodes)){
    //         const childNode = (element.childNodes[child] as HTMLElement)

    //         const childOffset = childNode.offsetTop+childNode.clientHeight
    //         console.log(childNode.offsetTop, childNode.clientHeight, element.clientHeight,element.offsetTop, childOffset-(element.clientHeight+element.offsetTop), childOffset-(element.clientHeight+element.offsetTop) < 0)
            
    //         // Loop over elements
    //         if(childOffset-(element.clientHeight+element.offsetTop) < 0){
    //             // Show element
    //             // console.log(childOffset-element.clientHeight)
    //             itemsInViewport++
    //         } else {
    //             // console.log(childOffset-element.clientHeight)
    //         }
    //     }

    //     return itemsInViewport
    // }

    function calculateChildrenInViewportCouldFit(element:HTMLElement){

        // Get First child
        if(element.childNodes[0] !== undefined){
            const childNode = (element.childNodes[0] as HTMLElement)
            const objHeight = (maxHeight < 0) ? childNode.clientHeight : maxHeight
            const objWidth = childNode.clientWidth

            const itemsPerRow = Math.floor(element.clientWidth / objWidth)
            const itemsPerColumn = Math.floor(element.clientHeight / objHeight)

            return itemsPerRow*itemsPerColumn
        } else {
            return 30
        }
    }

    function drawPageButtons(){
        const buttons = []
        const totalPages = Math.ceil(Object.keys(children).length/showItems)
      
        buttons.push((<Button onClick={ prevPage } disabled={page <= 0} className='btn-small' label="Previous page"></Button>))
        for(let i=1; i <= totalPages; i++){
          if(i == 1 || (i > (page-4) && i <= (page+5)) || i == totalPages){
            buttons.push((<Button key={i} label={i.toString()} className={ page == (i-1) ? 'btn-small btn-primary': 'btn-small' } onClick={ () => { gotoPage(i) }}></Button>))
          } else {
            if(i == (page-4) || i == (page+6)){
                buttons.push((<Button key={i} label='...' disabled={true} className={ 'btn-small btn-disabled' }></Button>))
            }
          }
        }
        buttons.push((<Button onClick={ nextPage } disabled={page >= totalPages-1} className='btn-small' label="Next page"></Button>))
    
        return buttons
    }

    function nextPage(){
        setPage(page+1)
        window.scrollTo({ top: 0 })
      }
    
      function prevPage(){
        setPage(page-1)
        window.scrollTo({ top: 0 })
      }
    
      function gotoPage(page){
        setPage(parseInt(page)-1)
        window.scrollTo({ top: 0 })
      }

    return (
        <React.Fragment>
            <div id={ 'component_viewportgrid_'+randomId } style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                justifyContent: 'space-around',
                marginTop: 25,
                // marginBottom: 25,
                overflow: 'hidden'
            }}>
                { React.Children.map(children, (child, index) => {
                    const offset = (page*showItems)
                    const limit = (page*showItems)+showItems

                    if(index < offset || index >= limit){
                        return 
                    }

                    return ( <div id={ "title_"+index } style={{
                        height: 155,
                        width: 145,
                        // padding: 5,
                        // justifyContent: 'center',
                        // verticalAlign: 'middle'
                    }}>{ React.cloneElement(child) }</div> )
                }) }
            </div>
            { drawPagination === true ? <div id="component_viewportgrid_pagination">
                { drawPageButtons() }
            </div> : '' }
        </React.Fragment>
    );
};

export default ViewportGrid;
