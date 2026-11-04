import type xCloudPlayer from 'xbox-xcloud-player'

// xbox-xcloud-player 0.2.11 always tells the console the client is 1920x1080 and has no resolution setting.
// Apply this after bind(), before the message channel handshake. Without VideoPreference and userRequestedResolutionUpdate
// the console picks the resolution itself (a console set to 1440p or 4K streams at 1440p even when 1080p is announced).
export function configureStreamResolution(player: xCloudPlayer, height: number) {
    const width = height * 16 / 9

    const control = player.getChannelProcessor('control')
    const start = control.start.bind(control)
    control.start = () => {
        start()
        control.send(JSON.stringify({
            message: 'VideoPreference',
            type: 'VideoPreference',
            resolution: { width, height },
            dimensions: { width, height },
            maxFPS: 60,
        }))
        control.send(JSON.stringify({
            message: 'userRequestedResolutionUpdate',
            resolutionAlias: String(height),
        }))
    }

    const channel = player.getChannelProcessor('message')
    const generateMessage = channel.generateMessage.bind(channel)
    channel.generateMessage = (path: string, data: Record<string, unknown>) => generateMessage(path,
        path === '/streaming/characteristics/dimensionschanged' ? {
            ...data,
            horizontal: width,
            vertical: height,
            preferredWidth: width,
            preferredHeight: height,
            safeAreaRight: width,
            safeAreaBottom: height,
        } : data)
}
