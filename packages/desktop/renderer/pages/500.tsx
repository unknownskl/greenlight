import React from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'

function Error500Page() {
    const { t } = useTranslation()

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t("page.page500.pageTitle")}</title>
            </Head>

            <p>{t("page.page500.message")}</p>
        </React.Fragment>
    )
}

export default Error500Page
