import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

import ConsoleArt, { ConsolePower, getConsoleKind } from './consoleart'

export interface ConsoleItem {
  id: string;
  name: string;
  consoleType?: string;
  powerState?: string;
  remoteManagementEnabled?: boolean;
  consoleStreamingEnabled?: boolean;
}

interface ConsoleTileProps {
  item: ConsoleItem;
  remotePort: number;
  isDefault?: boolean;
}

function getPower(powerState?: string): ConsolePower {
    if(powerState === 'On'){
        return 'on'
    }

    if(powerState === 'ConnectedStandby'){
        return 'standby'
    }

    return 'off'
}

// 'XboxSeriesX' -> 'Xbox Series X'
function formatConsoleType(consoleType?: string): string {
    return (consoleType || '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

function ConsoleTile({
    item,
    remotePort,
    isDefault = false,
}: ConsoleTileProps) {
    const { t } = useTranslation()

    const power = getPower(item.powerState)
    const canStream = item.remoteManagementEnabled === true && item.consoleStreamingEnabled === true

    const statusText = power === 'on' ? t('page.myConsoles.poweredOn') :
        power === 'standby' ? t('page.myConsoles.standby') :
            (item.powerState === 'Off' || !item.powerState) ? t('page.myConsoles.poweredOff') : item.powerState

    const typeText = formatConsoleType(item.consoleType)

    const content = (
        <React.Fragment>
            <div className="console-tile-art">
                <ConsoleArt kind={ getConsoleKind(item.consoleType) } power={ power } />
            </div>

            <div className="console-tile-info">
                <div className="console-tile-name">{ item.name }</div>

                <div className="console-tile-meta">
                    <span className={ `console-status console-status-${power}` }>
                        <span className="console-status-dot"></span>{ statusText }
                    </span>
                    { typeText !== '' ? <span className="console-type">{ typeText }</span> : '' }
                </div>

                { remotePort !== 9002 ? <div className="console-chips">
                    <span className="console-chip"><i className="fa-solid fa-globe"></i> {t('page.myConsoles.remotePort')} { remotePort }</span>
                </div> : '' }
            </div>

            { canStream ? (
                <div className="console-tile-play">
                    <i className={ power === 'on' ? 'fa-solid fa-play' : 'fa-solid fa-power-off' }></i>
                    <span>{ power === 'on' ? t('page.myConsoles.startStreamBtn') : t('page.myConsoles.wakeAndPlay') }</span>
                </div>
            ) : (
                <div className="console-tile-warnings">
                    { !item.remoteManagementEnabled ? <p><i className="fa-solid fa-triangle-exclamation"></i> {t('page.myConsoles.managementWarning')}</p> : '' }
                    { !item.consoleStreamingEnabled ? <p><i className="fa-solid fa-triangle-exclamation"></i> {t('page.myConsoles.streamingWarning')}</p> : '' }
                </div>
            ) }
        </React.Fragment>
    )

    if(canStream === false){
        return <div className={ `console-tile console-tile-${power} is-disabled` }>{ content }</div>
    }

    return (
        <Link href={ `stream/${item.id}` } className={ `console-tile console-tile-${power}` } title={ item.name } data-gp-default={ isDefault ? '' : undefined }>
            { content }
        </Link>
    )
}

export default ConsoleTile
