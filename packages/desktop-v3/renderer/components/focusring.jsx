import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInput } from '../contexts/InputContext'

export default function FocusRing() {
  const { focusedEl, inputMethod } = useInput()
  const [style, setStyle] = useState(null)

  useEffect(() => {
    if (!focusedEl || inputMethod === 'mouse') {
      setStyle(null)
      return
    }

    const update = () => {
      const r = focusedEl.getBoundingClientRect()
      if (r.width === 0) { setStyle(null); return }
      const br = window.getComputedStyle(focusedEl).borderRadius
      setStyle({
        top:    r.top    - 3,
        left:   r.left   - 3,
        width:  r.width  + 6,
        height: r.height + 6,
        borderRadius: br,
      })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [focusedEl, inputMethod])

  if (!style) return null

  return createPortal(
    <div
      className="focus-ring"
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 9999,
        ...style,
      }}
    />,
    document.body
  )
}
