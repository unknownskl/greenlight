import React from 'react'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'

function SettingsDebug() {
    const [appDebug, setAppDebug] = React.useState([])

    React.useEffect(() => {
        if(appDebug.length === 0){
            Ipc.send('app', 'debug').then((debug) => {
                setAppDebug(debug)
            })
        }
    })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Settings: Debug</title>
            </Head>

            <SettingsSidebar>
                <div id="page_settings_debug_application">
                    {
                        appDebug.map((item) => {
                            return (
                                <Card key={ item.name }>
                                    <h1>{ item.name }</h1>
                                    <ul className="kv-list">
                                        { item.data.map((dataItem, dataIndex) => {
                                            return (
                                                <li key={ item.name+'_'+dataIndex }>
                                                    <label>{dataItem.name}{ dataItem.name.length > 0 ? ':' : '' }</label>

                                                    {dataItem.value}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </Card>
                            )
                        })
                    }
                </div>
            </SettingsSidebar>
      

        </React.Fragment>
    )
}

export default SettingsDebug
