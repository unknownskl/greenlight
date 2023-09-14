import React from 'react'
import Button from './button'
import xPlayer from 'xbox-xcloud-player'
import Loader from './loader'
import Card from './card'
import uPlot from 'uplot'
// import { ipcRenderer } from 'electron'
import Ipc from '../../lib/ipc'



interface StreamComponentProps {
  hidden?: boolean;
  onDisconnect?: () => void;
  onMenu?: (e) => void;
  xPlayer: xPlayer;
  sessionId: string;
}

function StreamComponent({
  hidden = true,
  onDisconnect,
  onMenu,
  xPlayer,
  sessionId,
  ...props
}: StreamComponentProps) {

  let lastMovement = 0
  let gamebarElement = document.getElementById('component_streamcomponent_gamebar')
  let debugElement = document.getElementById('component_streamcomponent_debug')
  let webRtcStatsInterval

  const [micStatus, setMicStatus] = React.useState(false);
  const [waitingSeconds, setWaitingSeconds] = React.useState(0);

  let jitterData = [new Float32Array([performance.now()]), new Float32Array([0.0])]
  let droppedData = [new Float32Array([performance.now()]), new Float32Array([0.0]), new Float32Array([0.0])]
  let framesDroppedBaseline = 0
  let packetsDroppedBaseline = 0
  let frameCountDomUpdate = 0


  function sliceData(data, start, end) {
    let d = [];

    for (let i = 0; i < data.length; i++)
      d.push(data[i].slice(start, end));

    return d;
  }

  React.useEffect(() => {

    Ipc.onAction('streaming', 'onQueue', (event, waitingTimes) => {
      console.log('Waiting times:', waitingTimes)
      drawWaitingTimes(waitingTimes.estimatedTotalWaitTimeInSeconds)
    })

    // ipcRenderer.on('xcloud', (event, args) => {
    //   console.log('GOT EVENT:', event, args)

    //   if(args.type === 'waitingtimes'){
    //     // Render countdown
    //     console.log('Seconds waiting time:', args.data.estimatedTotalWaitTimeInSeconds)
    //     // setWaitingTimes(args.data)
    //     drawWaitingTimes(args.data.estimatedTotalWaitTimeInSeconds)
    //   }
    // })

    let jitterUplot = new uPlot({
      id: "component_streamcomponent_debug_webrtc_jitter",
      class: "debug-chart",
      width: 600,
      height: 250,
      series: [
        {},
        {
          show: true,
          spanGaps: false,
          label: "Jitter",
          stroke: "red",
          width: 2,
          fill: "rgba(255, 0, 0, 0.3)",
        }
      ],
      axes: [
        {},
        {
          values: (u, vals, space) => vals.map(v => +v.toString() + " ms"),
        }
      ]
    }, jitterData, document.getElementById('component_streamcomponent_debug_webrtc_jitter'));
    
    let droppedUplot = new uPlot({
      id: "component_streamcomponent_debug_webrtc_dropped",
      class: "debug-chart",
      width: 600,
      height: 250,
      series: [
        {},
        {
          show: true,
          spanGaps: false,
          label: "Packets lost",
          stroke: "green",
          width: 2,
          fill: "rgba(0, 255, 0, 0.3)",
        },
        {
          show: true,
          spanGaps: false,
          label: "Frames dropped",
          stroke: "blue",
          width: 2,
          fill: "rgba(0, 0, 255, 0.3)",
        }
      ],
      axes: [
        {},
        {
          values: (u, vals, space) => vals.map(v => +v.toFixed(0) + " dropped"),
          grid: {show: false},
        },
        {
          grid: {show: false},
        },
      ]
    }, droppedData, document.getElementById('component_streamcomponent_debug_webrtc_dropped'));

    webRtcStatsInterval = setInterval(() => {
      xPlayer._webrtcClient.getStats().then((stats) => {
        let statsOutput = "";
    
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {

            if(jitterData[0].length > 1200){
              jitterData = sliceData(jitterData, jitterData[0].length-1200, jitterData[0].length)
            }
            if(droppedData[0].length > 1200){
              droppedData = sliceData(droppedData, droppedData[0].length-1200, droppedData[0].length)
            }

            jitterData[0] = new Float32Array([...Array.from(jitterData[0]), performance.now()])
            jitterData[1] = new Float32Array([...Array.from(jitterData[1]), report['jitter']])

            droppedData[0] = new Float32Array([...Array.from(droppedData[0]), performance.now()])
            droppedData[1] = new Float32Array([...Array.from(droppedData[1]), report['packetsLost']-packetsDroppedBaseline])
            droppedData[2] = new Float32Array([...Array.from(droppedData[2]), report['framesDropped']-framesDroppedBaseline])
            packetsDroppedBaseline = report['packetsLost']
            framesDroppedBaseline = report['framesDropped']

            jitterUplot.setData(jitterData)
            droppedUplot.setData(droppedData)

            if(frameCountDomUpdate >= 15){
              Object.keys(report).forEach((statName) => {
                statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
              });
              document.querySelector('div#component_streamcomponent_debug_text').innerHTML = statsOutput;
              frameCountDomUpdate = 0;
            } else {
              frameCountDomUpdate++;
            }
          }
        });
    
        // document.querySelector('div#component_streamcomponent_debug_text').innerHTML = statsOutput;
      });
    }, 33);

    // Gamebar menu mouse events
    const mouseEvent = (e) => {
      lastMovement = Date.now()
    }
    window.addEventListener('mousemove', mouseEvent)
    window.addEventListener('mousedown', mouseEvent)

    const mouseInterval = setInterval(() => {
      if(gamebarElement === null){
        gamebarElement = document.getElementById('component_streamcomponent_gamebar')
        return;
      }

      if((Date.now()-lastMovement) >= 2000){
        if(! gamebarElement.className.includes('hidden')){
          gamebarElement.className = 'hidden'
        }
      } else {
        if(gamebarElement.className.includes('hidden')){
          gamebarElement.className = ''
        }
      }
    }, 100)

    // Keyboard events
    const keyboardPressEvent = (e) => {
      switch(e.keyCode){
        case 126:
            toggleDebug()
            break;
      }
    }
    window.addEventListener('keypress', keyboardPressEvent)
  
    // cleanup this component
    return () => {
      window.removeEventListener('mousemove', mouseEvent)
      window.removeEventListener('mousedown', mouseEvent)
      window.removeEventListener('keypress', keyboardPressEvent)
      clearInterval(mouseInterval)

      // ipcRenderer.removeAllListeners('xcloud');

      if(webRtcStatsInterval){ clearInterval(webRtcStatsInterval) }
      (document.getElementById('component_streamcomponent_debug_webrtc_jitter') !== null) ? document.getElementById('component_streamcomponent_debug_webrtc_jitter').innerHTML = '' : false;
      (document.getElementById('component_streamcomponent_debug_webrtc_dropped') !== null) ? document.getElementById('component_streamcomponent_debug_webrtc_dropped').innerHTML = '' : false;
    };
  }, []);

  function toggleMic(){
    if(xPlayer.getChannelProcessor('chat').isPaused === true){
      xPlayer.getChannelProcessor('chat').startMic()
      setMicStatus(true)
    } else {
      xPlayer.getChannelProcessor('chat').stopMic()
      setMicStatus(false)
    }
  }

  function streamDisconnect(){
    document.getElementById('streamComponentHolder').innerHTML = '';
    onDisconnect()
    // (Router as any).back()
    // window.history.back()
    window.history.back()
    xPlayer.reset()
  }

  function toggleDebug(){
    if(debugElement === null){
      debugElement = document.getElementById('component_streamcomponent_debug')
    }

    if(debugElement.className.includes('hidden')){
      debugElement.className = ''
    } else {
      debugElement.className = 'hidden'
    }
  }

  function drawWaitingTimes(seconds){
    if(seconds !== false){
      setWaitingSeconds(seconds)
      const html = '<div>Estimated waiting time in queue: <span id="component_streamcomponent_waitingtimes_seconds">'+seconds+'</span> seconds</div>'

      
      document.getElementById('component_streamcomponent_waitingtimes').innerHTML = html

      const secondsInterval = setInterval(() => {
        seconds--;
        setWaitingSeconds(seconds)
        
        if(document.getElementById('component_streamcomponent_waitingtimes') !== null){
          document.getElementById('component_streamcomponent_waitingtimes_seconds').innerText = seconds
        } else {
          clearInterval(secondsInterval)
        }

        if(seconds === 0){
          clearInterval(secondsInterval)
        }
      }, 1000)
    }
  }

  return (
    <React.Fragment>
      <div>
        <div id="streamComponentHolder">
        </div>

        <div id="component_streamcomponent_loader">
          <Card className='padbottom'>
            <h1>Loading...</h1>

            <Loader></Loader>

            <p>We are getting your stream ready...</p>
            <p id="component_streamcomponent_connectionstatus"></p>

            <p id="component_streamcomponent_waitingtimes"></p>
          </Card>
        </div>

        <div id="component_streamcomponent_gamebar">
          <div id="component_streamcomponent_gamebar_menu">
          <div style={{
              width: '25%'
            }}>
              <Button label={<span><i className="fa-solid fa-xmark"></i> Disconnect</span>} className='btn-cancel' onClick={ () => { streamDisconnect() } }></Button>
            </div>

            <div style={{
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <Button label={ <span><i className="fa-brands fa-xbox"></i> Menu</span> } onClick={ (e) => { e.target.blur(); onMenu(e) }}></Button> &nbsp;
              <Button label={ (micStatus === false) ? <span><i className="fa-solid fa-microphone-slash"></i> Muted</span> : <span><i className="fa-solid fa-microphone"></i> Active</span> } className={ (micStatus === false) ? 'btn-cancel' : 'btn-primary' } onClick={ (e) => { e.target.blur(); toggleMic() }}></Button>
            </div>

            <div style={{
              marginRight: 20,
              width: '25%',
              textAlign: 'right'
            }}>
              <Button label={ <i className="fa-solid fa-bug"></i> } onClick={ (e) => { e.target.blur(); toggleDebug() } }></Button>
            </div>
          </div>
        </div>

        <div id="component_streamcomponent_debug" className='hidden'>
          <p>Debug:</p>

          <div id="component_streamcomponent_debug_webrtc_jitter"></div>
          <div id="component_streamcomponent_debug_webrtc_dropped"></div>

          <div id="component_streamcomponent_debug_text"></div>

          {/* <Button label="Disconnect" onClick={ () => { streamDisconnect() } }></Button> */}
        </div>
      </div>
    </React.Fragment>
  );
};

export default StreamComponent;
