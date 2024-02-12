import axios from 'axios'
import electron from 'electron'
import { compare } from 'compare-versions'
import gh from 'github-url-to-object'
import pkg from '../../package.json'

// Base code below from https://github.com/ankurk91/electron-update-notifier. Credits to @ankurk91.

interface Options {
  repository?: string;
  token?: string;
  debug?: boolean;
  silent?: boolean;
  prereleases?: boolean;
}

interface GithubReleaseObject {
  tag_name: string;
  body: string;
  html_url: string;
}

export const defaultOptions: Options = {
    debug: false, // force run in development
    silent: true,
    prereleases: false,
}

export function setUpdateNotification(options: Options = defaultOptions, logger) {
    const withDefaults = Object.assign(defaultOptions, options)

    if (electron.app.isReady()) {
        checkForUpdates(withDefaults, logger)
    } else {
        electron.app.on('ready', () => {
            checkForUpdates(withDefaults, logger)
        })
    }
}

export async function checkForUpdates({repository, token, debug, silent, prereleases}: Options = defaultOptions, logger) {
    logger.log('updater', __filename+'[checkForUpdates()] Running updater...', electron.app.isPackaged, debug)
    if (!electron.app.isPackaged && !debug){
        logger.log('updater', __filename+'[checkForUpdates()] Not checking for updates because app is not packaged.')
        return
    }

    if (!repository) {
    // const pkg = require(path.join(electron.app.getAppPath(), 'package.json'))
        const ghObj = gh(pkg.repository)

        if (!ghObj) {
            throw new Error('Repository URL not found in package.json file.')
        }

        repository = ghObj.user + '/' + ghObj.repo
    }

    let latestRelease: null | GithubReleaseObject = null

    try {
        logger.log('updater', __filename+'[checkForUpdates()] Checking for updates on GitHub:', `https://api.github.com/repos/${repository}/releases`)
        const {data: releases} = await axios.get(`https://api.github.com/repos/${repository}/releases`,
            {
                headers: token ? {authorization: `token ${token}`} : {},
            },
        )

        for(const release in releases){
            if(releases[release].prerelease === prereleases){
                latestRelease = releases[release] as GithubReleaseObject
                break
            }
        }
    
    } catch (error) {
        console.error(error)
        logger.log('updater', __filename+'[checkForUpdates()] Error while checking for updates:', error)

        if (!silent) {
            showDialog('Unable to check for updates at this moment. Try again.', 'error')
        }
    }

    if (!latestRelease) return

    if (compare(latestRelease.tag_name, electron.app.getVersion(), '>')) {
        logger.log('updater', __filename+'[checkForUpdates()] New version found:', latestRelease.tag_name)
        showUpdateDialog(latestRelease)
    } else {
        logger.log('updater', __filename+'[checkForUpdates()] Application is newest version. Current version:', electron.app.getVersion(), 'Newest version:', latestRelease.tag_name )
        if (!silent) {
            showDialog(`You are already running the latest version. Current version: ${electron.app.getVersion()}. Newest version: ${latestRelease.tag_name}`)
        }
    }
}

export function showUpdateDialog(release: GithubReleaseObject) {
    electron.dialog.showMessageBox(
        {
            title: electron.app.getName(),
            type: 'info',
            message: 'New release available',
            detail: `Installed Version: ${electron.app.getVersion()}\nLatest Version: ${release.tag_name}\n\n${release.body}`.trim(),
            buttons: ['Download', 'Later'],
            defaultId: 0,
            cancelId: 1,
        },
    )
        .then(({response}) => {
            if (response === 0) {
                setImmediate(() => {
                    electron.shell.openExternal(release.html_url)
                })
            }
        })
        .catch((error) => {
            throw new Error(error)
        })
}

const showDialog = (detail: string, type: string = 'info') => {
    electron.dialog.showMessageBox(
        {
            title: electron.app.getName(),
            message: 'Update checker',
            buttons: ['Close'],
            defaultId: 0,
            cancelId: 0,
            type,
            detail,
        },
    )
}