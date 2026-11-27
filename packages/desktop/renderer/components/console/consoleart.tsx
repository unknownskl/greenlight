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

// The Xbox "sphere" logo, centered on (x, y)
function XboxLogo({ x, y, r, color, glow }: { x: number; y: number; r: number; color: string; glow?: string }) {
    return (
        <g transform={`translate(${x} ${y}) scale(${r})`}>
            { glow ? <circle r="1.9" fill={glow} opacity="0.35" /> : null }
            <circle r="0.92" fill="none" stroke={color} strokeWidth="0.16" />
            <path d="M -0.55 -0.55 Q 0 -0.05 0.55 0.55 M 0.55 -0.55 Q 0 -0.05 -0.55 0.55" fill="none" stroke={color} strokeWidth="0.26" strokeLinecap="round" />
        </g>
    )
}

// The Xbox wireless controller (94 x 64 units), as in the product photos
function Controller({ white, uid }: { white: boolean; uid: string }) {
    const body = white ? `url(#${uid}-pad-white)` : `url(#${uid}-pad-black)`
    const stick = white ? '#2a2d33' : '#0a0b0d'
    const ring = white ? '#9aa0aa' : '#3b3f47'
    const logo = white ? '#6b717b' : '#d7dbe2'

    return (
        <g>
            <ellipse cx="47" cy="61" rx="38" ry="3.4" fill="#000000" opacity="0.4" />
            <path d="M 18 8 C 28 2, 38 4, 47 5 C 56 4, 66 2, 76 8 C 86 16, 94 40, 90 54 C 87 63, 76 64, 71 56 C 67 49, 63 44, 55 44 L 39 44 C 31 44, 27 49, 23 56 C 18 64, 7 63, 4 54 C 0 40, 8 16, 18 8 Z"
                fill={body} stroke={white ? '#c3c8d0' : '#050506'} strokeWidth="0.8" />
            {/* Bumpers */}
            <path d="M 14 10 C 20 5, 28 3, 33 4" fill="none" stroke={white ? '#d9dde3' : '#2c2f36'} strokeWidth="2" strokeLinecap="round" />
            <path d="M 80 10 C 74 5, 66 3, 61 4" fill="none" stroke={white ? '#d9dde3' : '#2c2f36'} strokeWidth="2" strokeLinecap="round" />

            {/* Left stick */}
            <circle cx="22" cy="23" r="9" fill={white ? '#aeb4bd' : '#17181c'} />
            <circle cx="22" cy="23" r="6.4" fill={stick} stroke={ring} strokeWidth="0.8" />
            <circle cx="22" cy="23" r="3.2" fill="none" stroke={ring} strokeWidth="0.6" opacity="0.7" />

            {/* D-pad */}
            <circle cx="35" cy="38" r="7.2" fill={white ? '#aeb4bd' : '#17181c'} />
            <path d="M 33.3 32.4 H 36.7 V 36.3 H 40.6 V 39.7 H 36.7 V 43.6 H 33.3 V 39.7 H 29.4 V 36.3 H 33.3 Z" fill={stick} stroke={ring} strokeWidth="0.5" />

            {/* Face buttons */}
            <circle cx="70" cy="21" r="9.6" fill={white ? '#aeb4bd' : '#17181c'} />
            <g fontFamily="Arial, sans-serif" fontWeight="700" fontSize="4.4" textAnchor="middle" fill="#0b0c0e">
                <circle cx="70" cy="14.8" r="3.5" fill="#f4c20d" /><text x="70" y="16.4">Y</text>
                <circle cx="63.8" cy="21" r="3.5" fill="#2f7ed8" /><text x="63.8" y="22.6">X</text>
                <circle cx="76.2" cy="21" r="3.5" fill="#d9322e" /><text x="76.2" y="22.6">B</text>
                <circle cx="70" cy="27.2" r="3.5" fill="#3fae2a" /><text x="70" y="28.8">A</text>
            </g>

            {/* Right stick */}
            <circle cx="60" cy="38" r="8.6" fill={white ? '#aeb4bd' : '#17181c'} />
            <circle cx="60" cy="38" r="6.2" fill={stick} stroke={ring} strokeWidth="0.8" />
            <circle cx="60" cy="38" r="3" fill="none" stroke={ring} strokeWidth="0.6" opacity="0.7" />

            {/* Logo and small buttons */}
            <XboxLogo x={47} y={14} r={3.8} color={logo} />
            <circle cx="40" cy="24" r="1.7" fill={ring} />
            <circle cx="54" cy="24" r="1.7" fill={ring} />
            <rect x="44.6" y="28" width="4.8" height="2.6" rx="1.3" fill={ring} />
        </g>
    )
}

/**
 * Drawn Xbox console, modelled on the product photos: the black Series X tower with its side slot and logo,
 * the white Series S with the big round speaker grille, and a flat box for the Xbox One family,
 * each with its controller. A glow behind the console shows the power state.
 */
function ConsoleArt({
    kind,
    power,
}: ConsoleArtProps) {
    const uid = React.useId().replace(/:/g, '')
    const glowColor = power === 'on' ? '#37e237' : power === 'standby' ? '#f5a524' : '#555a60'
    const glowOpacity = power === 'on' ? 0.85 : power === 'standby' ? 0.5 : 0
    const ledOpacity = power === 'off' ? 0.35 : 1

    return (
        <svg className={`console-art console-art-${kind} power-${power}`} viewBox="0 0 200 200" role="img" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={glowColor} stopOpacity={glowOpacity} />
                    <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${uid}-black`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#101215" />
                    <stop offset="55%" stopColor="#1d2025" />
                    <stop offset="100%" stopColor="#0a0b0d" />
                </linearGradient>
                <linearGradient id={`${uid}-white`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e4e7ec" />
                    <stop offset="50%" stopColor="#f7f8fa" />
                    <stop offset="100%" stopColor="#d3d7de" />
                </linearGradient>
                <linearGradient id={`${uid}-pad-black`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2b2e35" />
                    <stop offset="100%" stopColor="#0c0d10" />
                </linearGradient>
                <linearGradient id={`${uid}-pad-white`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbfbfc" />
                    <stop offset="100%" stopColor="#cfd3da" />
                </linearGradient>
                <pattern id={`${uid}-dots`} width="3.4" height="3.4" patternUnits="userSpaceOnUse">
                    <circle cx="1.7" cy="1.7" r="0.85" fill="#34383f" />
                </pattern>
            </defs>

            { kind === 'seriesx' ? (
                <g>
                    <ellipse cx="78" cy="96" rx="78" ry="92" fill={`url(#${uid}-glow)`} opacity="0.55" />
                    <ellipse cx="78" cy="182" rx="62" ry="6" fill="#000000" opacity="0.5" />
                    {/* Tower */}
                    <rect x="36" y="10" width="84" height="168" rx="2.5" fill={`url(#${uid}-black)`} />
                    <rect x="36" y="10" width="84" height="168" rx="2.5" fill="none" stroke="#2b2f36" strokeWidth="0.8" />
                    <line x1="37" y1="11" x2="119" y2="11" stroke={glowColor} strokeOpacity={power === 'off' ? 0.12 : 0.7} strokeWidth="1.4" />
                    {/* Power button / logo, small ring and the vertical slot on the left side */}
                    <XboxLogo x={46} y={22} r={4.6} color="#e9edf3" glow={power === 'off' ? undefined : glowColor} />
                    <circle cx="44" cy="94" r="1.9" fill="none" stroke="#3a3e46" strokeWidth="0.9" />
                    <rect x="42.2" y="103" width="2.6" height="68" rx="1.3" fill="#030304" />
                    {/* Controller in front of the tower */}
                    <g transform="translate(66 124)"><Controller white={false} uid={uid} /></g>
                </g>
            ) : kind === 'seriess' ? (
                <g>
                    <ellipse cx="78" cy="96" rx="80" ry="92" fill={`url(#${uid}-glow)`} opacity="0.5" />
                    <ellipse cx="78" cy="182" rx="62" ry="6" fill="#000000" opacity="0.5" />
                    {/* White body */}
                    <rect x="30" y="10" width="94" height="168" rx="2.5" fill={`url(#${uid}-white)`} />
                    {/* Round speaker grille */}
                    <circle cx="77" cy="64" r="43" fill="#0b0c0e" />
                    <circle cx="77" cy="64" r="43" fill={`url(#${uid}-dots)`} />
                    <circle cx="77" cy="64" r="43" fill="none" stroke="#1b1d22" strokeWidth="1.2" />
                    <circle cx="77" cy="64" r="2.4" fill={glowColor} opacity={power === 'off' ? 0.0 : 0.9} />
                    <text x="35" y="170" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="700" fill="#b9bec7" letterSpacing="1" transform="rotate(-90 35 170)">XBOX</text>
                    {/* Controller in front of the console */}
                    <g transform="translate(66 124)"><Controller white={true} uid={uid} /></g>
                </g>
            ) : (
                <g>
                    <ellipse cx="90" cy="112" rx="92" ry="46" fill={`url(#${uid}-glow)`} opacity="0.5" />
                    <ellipse cx="86" cy="160" rx="82" ry="6" fill="#000000" opacity="0.5" />
                    {/* Flat console */}
                    <rect x="12" y="84" width="150" height="54" rx="4" fill={`url(#${uid}-black)`} />
                    <path d="M 12 92 L 12 88 Q 12 84 16 84 L 158 84 Q 162 84 162 88 L 162 92 Z" fill="#2f333a" opacity="0.9" />
                    <rect x="12" y="84" width="150" height="54" rx="4" fill="none" stroke="#2b2f36" strokeWidth="0.8" />
                    <rect x="22" y="118" width="88" height="3" rx="1.5" fill="#000000" opacity="0.7" />
                    <circle cx="28" cy="104" r="1.6" fill="#050506" />
                    <XboxLogo x={140} y={108} r={7} color="#e9edf3" glow={power === 'off' ? undefined : glowColor} />
                    {/* Controller in front */}
                    <g transform="translate(70 130) scale(0.78)"><Controller white={false} uid={uid} /></g>
                </g>
            ) }
        </svg>
    )
}

export default ConsoleArt
