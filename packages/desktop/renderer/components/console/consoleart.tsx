import React from 'react'

export type ConsolePower = 'on' | 'standby' | 'off'
export type ConsoleKind = 'seriesx' | 'seriess' | 'one'

export function getConsoleKind(consoleType?: string): ConsoleKind {
    const type = (consoleType || '').toLowerCase()

    if(type.includes('seriess')){
        return 'seriess'
    }

    if(type.includes('seriesx') || type.includes('scarlett')){
        return 'seriesx'
    }

    return 'one'
}

interface ConsoleArtProps {
  kind: ConsoleKind;
  power: ConsolePower;
}

/**
 * Drawn Xbox console: a black tower for the Series X, a white one with a round vent for the Series S
 * and a flat box for the Xbox One family. The glow shows the power state.
 */
function ConsoleArt({
    kind,
    power,
}: ConsoleArtProps) {
    const uid = React.useId().replace(/:/g, '')
    const glowColor = power === 'on' ? '#37e237' : power === 'standby' ? '#f5a524' : '#555a60'
    const glowOpacity = power === 'on' ? 0.9 : power === 'standby' ? 0.5 : 0

    return (
        <svg className={`console-art console-art-${kind} power-${power}`} viewBox="0 0 200 220" role="img" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={glowColor} stopOpacity={glowOpacity} />
                    <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-black`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#14161a" />
                    <stop offset="45%" stopColor="#23262c" />
                    <stop offset="100%" stopColor="#0b0c0e" />
                </linearGradient>
                <linearGradient id={`${uid}-white`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#c9ced6" />
                    <stop offset="40%" stopColor="#f6f7f9" />
                    <stop offset="100%" stopColor="#b9bec7" />
                </linearGradient>
                <linearGradient id={`${uid}-slab`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a2d33" />
                    <stop offset="100%" stopColor="#0d0e10" />
                </linearGradient>
                <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
                </linearGradient>
            </defs>

            { kind === 'seriesx' ? (
                <g>
                    <ellipse cx="100" cy="206" rx="52" ry="7" fill="#000000" opacity="0.45" />
                    <ellipse cx="100" cy="26" rx="62" ry="22" fill={`url(#${uid}-glow)`} />
                    <rect x="62" y="22" width="76" height="182" rx="7" fill={`url(#${uid}-black)`} />
                    <rect x="62" y="22" width="76" height="10" rx="5" fill="#34383f" />
                    <g stroke={glowColor} strokeOpacity={power === 'off' ? 0.18 : 0.75} strokeWidth="1.2">
                        <line x1="74" y1="27" x2="126" y2="27" />
                    </g>
                    <rect x="62" y="22" width="76" height="182" rx="7" fill={`url(#${uid}-shade)`} />
                    <rect x="68" y="150" width="46" height="3" rx="1.5" fill="#000000" opacity="0.55" />
                    <circle cx="124" cy="54" r="5" fill="#101114" stroke="#3a3e46" strokeWidth="1.5" />
                    <circle cx="124" cy="54" r="2.2" fill={glowColor} opacity={power === 'off' ? 0.25 : 1} />
                </g>
            ) : kind === 'seriess' ? (
                <g>
                    <ellipse cx="100" cy="206" rx="52" ry="7" fill="#000000" opacity="0.45" />
                    <ellipse cx="108" cy="42" rx="52" ry="16" fill={`url(#${uid}-glow)`} opacity="0.7" />
                    <rect x="52" y="30" width="96" height="174" rx="9" fill={`url(#${uid}-white)`} />
                    <circle cx="100" cy="56" r="25" fill="#101114" />
                    <circle cx="100" cy="56" r="19" fill="none" stroke="#2c3037" strokeWidth="2" />
                    <circle cx="100" cy="56" r="12" fill="none" stroke="#2c3037" strokeWidth="2" />
                    <circle cx="100" cy="56" r="5" fill={glowColor} opacity={power === 'off' ? 0.25 : 0.95} />
                    <rect x="52" y="30" width="96" height="174" rx="9" fill={`url(#${uid}-shade)`} opacity="0.5" />
                    <rect x="64" y="176" width="40" height="3" rx="1.5" fill="#8a8f98" opacity="0.7" />
                </g>
            ) : (
                <g>
                    <ellipse cx="100" cy="162" rx="84" ry="8" fill="#000000" opacity="0.45" />
                    <ellipse cx="100" cy="96" rx="82" ry="30" fill={`url(#${uid}-glow)`} opacity="0.6" />
                    <rect x="22" y="82" width="156" height="72" rx="8" fill={`url(#${uid}-slab)`} />
                    <rect x="22" y="82" width="156" height="9" rx="4.5" fill="#3a3e46" opacity="0.9" />
                    <rect x="38" y="118" width="86" height="3" rx="1.5" fill="#000000" opacity="0.7" />
                    <circle cx="150" cy="112" r="9" fill="#101114" stroke="#3a3e46" strokeWidth="1.5" />
                    <circle cx="150" cy="112" r="3" fill={glowColor} opacity={power === 'off' ? 0.25 : 1} />
                    <rect x="22" y="82" width="156" height="72" rx="8" fill={`url(#${uid}-shade)`} />
                </g>
            ) }
        </svg>
    )
}

export default ConsoleArt
