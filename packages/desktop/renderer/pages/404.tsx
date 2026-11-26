import React from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'

function Error404Page() {
    const { t } = useTranslation()

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t("page.page404.pageTitle")}</title>
            </Head>

            <p>{t("page.page404.message")}</p>
        </React.Fragment>
    )
}

export default Error404Page
