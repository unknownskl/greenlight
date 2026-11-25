import React from 'react'
import { XBOX_BUTTONS, XboxButton } from '../../lib/gamepadMapping'

interface ControllerViewProps {
    gamepadIndex: number;
    mapping: Record<XboxButton, number>;
    highlight?: string;
}

const STICK_TRAVEL = 10
const DEADZONE = 0.1

// Live controller visualisation. Polls the Gamepad API every animation frame and
// updates the SVG directly (no React re-render per frame).
function ControllerView({ gamepadIndex, mapping, highlight }: ControllerViewProps) {
    const svgRef = React.useRef<SVGSVGElement>(null)
    const rawRef = React.useRef<HTMLSpanElement>(null)
    const mappingRef = React.useRef(mapping)
    mappingRef.current = mapping

    React.useEffect(() => {
        let frame: number

        const update = () => {
            const svg = svgRef.current
            const pad = navigator.getGamepads()[gamepadIndex]

            if (svg) {
                const map = mappingRef.current
                for (const btn of XBOX_BUTTONS) {
                    const el = svg.querySelector(`[data-btn="${btn}"]`)
                    const state = pad?.buttons[map[btn]]
                    const value = state ? state.value : 0
                    el?.classList.toggle('active', !!state && (state.pressed || value > 0.5))

                    if (btn === 'LeftTrigger' || btn === 'RightTrigger') {
                        const fill = svg.querySelector(`[data-fill="${btn}"]`) as SVGRectElement | null
                        if (fill) fill.setAttribute('height', String(24 * value))
                    }
                }

                const moveStick = (name: string, x = 0, y = 0) => {
                    const cap = svg.querySelector(`[data-stick="${name}"]`)
                    const dx = Math.abs(x) > DEADZONE ? x : 0
                    const dy = Math.abs(y) > DEADZONE ? y : 0
                    cap?.setAttribute('transform', `translate(${dx * STICK_TRAVEL} ${dy * STICK_TRAVEL})`)
                }
                moveStick('Left', pad?.axes[0], pad?.axes[1])
                moveStick('Right', pad?.axes[2], pad?.axes[3])
            }

            if (rawRef.current) {
                const pressed = []
                pad?.buttons.forEach((b, i) => {
                    if (b.pressed) pressed.push(i)
                })
                rawRef.current.textContent = pressed.length > 0 ? pressed.join(', ') : '-'
            }

            frame = requestAnimationFrame(update)
        }

        frame = requestAnimationFrame(update)
        return () => cancelAnimationFrame(frame)
    }, [gamepadIndex])

    const cls = (btn: string) => 'cv-btn' + (highlight === btn ? ' highlight' : '')

    return (
        <div className="component_controllerview">
            <svg ref={svgRef} viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
                {/* Triggers */}
                <g data-btn="LeftTrigger" className={cls('LeftTrigger')}>
                    <rect x="95" y="2" width="50" height="24" rx="8" className="cv-outline" />
                    <rect data-fill="LeftTrigger" x="95" y="2" width="50" height="0" rx="8" className="cv-fill" />
                    <text x="120" y="18">LT</text>
                </g>
                <g data-btn="RightTrigger" className={cls('RightTrigger')}>
                    <rect x="255" y="2" width="50" height="24" rx="8" className="cv-outline" />
                    <rect data-fill="RightTrigger" x="255" y="2" width="50" height="0" rx="8" className="cv-fill" />
                    <text x="280" y="18">RT</text>
                </g>

                {/* Bumpers */}
                <g data-btn="LeftShoulder" className={cls('LeftShoulder')}>
                    <rect x="75" y="32" width="90" height="14" rx="7" />
                    <text x="120" y="43">LB</text>
                </g>
                <g data-btn="RightShoulder" className={cls('RightShoulder')}>
                    <rect x="235" y="32" width="90" height="14" rx="7" />
                    <text x="280" y="43">RB</text>
                </g>

                {/* Body */}
                <path className="cv-body" d="M 110 50 C 60 50 40 80 30 130 C 15 200 20 245 55 250 C 85 254 100 215 130 190 L 270 190 C 300 215 315 254 345 250 C 380 245 385 200 370 130 C 360 80 340 50 290 50 Z" />

                {/* Nexus / View / Menu */}
                <g data-btn="Nexus" className={cls('Nexus')}>
                    <circle cx="200" cy="72" r="13" />
                    <text x="200" y="76">X</text>
                </g>
                <g data-btn="View" className={cls('View')}>
                    <circle cx="172" cy="108" r="8" />
                </g>
                <g data-btn="Menu" className={cls('Menu')}>
                    <circle cx="228" cy="108" r="8" />
                </g>

                {/* Left stick */}
                <circle cx="120" cy="105" r="26" className="cv-well" />
                <g data-btn="LeftThumb" className={cls('LeftThumb')}>
                    <circle data-stick="Left" cx="120" cy="105" r="17" />
                </g>

                {/* Right stick */}
                <circle cx="248" cy="160" r="26" className="cv-well" />
                <g data-btn="RightThumb" className={cls('RightThumb')}>
                    <circle data-stick="Right" cx="248" cy="160" r="17" />
                </g>

                {/* D-pad */}
                <g data-btn="DPadUp" className={cls('DPadUp')}><rect x="144" y="132" width="16" height="18" rx="3" /></g>
                <g data-btn="DPadDown" className={cls('DPadDown')}><rect x="144" y="166" width="16" height="18" rx="3" /></g>
                <g data-btn="DPadLeft" className={cls('DPadLeft')}><rect x="126" y="150" width="18" height="16" rx="3" /></g>
                <g data-btn="DPadRight" className={cls('DPadRight')}><rect x="160" y="150" width="18" height="16" rx="3" /></g>

                {/* Face buttons */}
                <g data-btn="Y" className={cls('Y') + ' cv-y'}><circle cx="285" cy="80" r="12" /><text x="285" y="84">Y</text></g>
                <g data-btn="X" className={cls('X') + ' cv-x'}><circle cx="260" cy="105" r="12" /><text x="260" y="109">X</text></g>
                <g data-btn="B" className={cls('B') + ' cv-b'}><circle cx="310" cy="105" r="12" /><text x="310" y="109">B</text></g>
                <g data-btn="A" className={cls('A') + ' cv-a'}><circle cx="285" cy="130" r="12" /><text x="285" y="134">A</text></g>
            </svg>
            <small className="component_controllerview_raw">Raw: <span ref={rawRef}>-</span></small>
        </div>
    )
}

export default ControllerView
