import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import FocusRing from '../components/focusring'

interface InputContextType {
  setInputMethod: (method: 'mouse' | 'keyboard' | 'gamepad') => void;
  inputMethod: 'mouse' | 'keyboard' | 'gamepad';
  focusedEl: Element | null;
  focusElement: (el: Element) => void;
  enableControls: (enable: boolean) => void;
}

const InputContext = createContext<InputContextType | undefined>(undefined);

export function InputProvider({ children }: { children: ReactNode }) {

  const [inputMethod, _setInputMethod] = useState<'mouse' | 'keyboard' | 'gamepad'>('mouse');
  const [focusedEl, _setFocusedEl] = useState<Element | null>(null)
  const [controlsEnabled, setEnableControls] = useState<boolean>(true)
  const focusRef = useRef<Element | null>(null);
  const lastClickedRef = useRef<Element | null>(null);
  // const selectOpenRef = useRef<Element | null>(null);

  function setInputMethod(method: 'mouse' | 'keyboard' | 'gamepad') {
    _setInputMethod(method)
    
    if(method === 'mouse') {
      focusRef.current = null;
    }
  }

  const focusEl = useCallback((el: Element) => {
    if (!el || el === focusRef.current) return

    _setFocusedEl(el)
    focusRef.current = el;

    (el as HTMLElement).focus({ preventScroll: true })
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [])

  const moveFocus = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    const cur = focusRef.current
    if(cur === null) {
      const f = getFocusables()[0];
      if(f){
        focusEl(f);
        return
      }
    } else {
      const target = findNearest(cur, dir)
      if (target) focusEl(target)
    }
  }, [focusRef.current])

  useEffect(() => {
    if(controlsEnabled === false) return;

    if(inputMethod === 'mouse') return;

    const interval = setInterval(() => {
      if(focusRef.current && focusRef.current.clientHeight === 0) {
        const focusNewElement = findNearest(focusRef.current, 'up')
        if(focusNewElement){
          focusEl(focusNewElement)
        }
        console.log('Focus interval: focused element is hidden, moving focus to nearest element', focusNewElement)
      }
    }, 160);
    return () => clearInterval(interval);
  }, [inputMethod, focusRef, focusEl, controlsEnabled])

  // Keyboard navigation
  useEffect(() => {
    if(controlsEnabled === false) return;

    const DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
    const onKey = (e: KeyboardEvent) => {
      setInputMethod('keyboard')

      switch(e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault(); moveFocus(DIR[e.key] as 'up' | 'down' | 'left' | 'right');
          break
        case 'Enter':
          if (focusedEl) {
            handleClick(e, focusedEl)
          }
          break
        case 'Escape':
          // selectOpenRef.current = null;
          break
        default:
            // e.preventDefault();
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moveFocus, setInputMethod, controlsEnabled])

  useEffect(() => {

    const handleMouseMove = () => setInputMethod('mouse');
    const handleKeyDown = () => setInputMethod('keyboard');

    document.addEventListener('mousedown', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
        document.removeEventListener('mousedown', handleMouseMove);
        document.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  const handleClick = useCallback((event: KeyboardEvent, target: Element) => {
    const allow_click = ['a', 'button']
    if(allow_click.includes(target.tagName.toLowerCase())) {
      event.preventDefault();

      // console.log('handleClick: Default target', target)

      if(target && (target as HTMLElement).click) {
        if(lastClickedRef.current === target) return

        lastClickedRef.current = target;
        setTimeout(() => {
          lastClickedRef.current = null;
        }, 500);
        (target as HTMLElement).click()
      }

    } else if(target.tagName.toLowerCase() === "summary") {
      (target as HTMLElement).click();


    // } else if(target.tagName.toLowerCase() === "select") {

    //   // @TODO: Handle select dropdowns when using keyboard navigation. This is tricky because we don't want to trigger the select's click event when pressing Enter to open the dropdown, but we do want to trigger it when clicking with the mouse.
    //   console.log('Opening select dropdown for', target);
    //   (target as HTMLSelectElement).showPicker();
    //   selectOpenRef.current = target;

    //   const onSelectClose = () => {
    //   console.log('Removing event listeners to detect select close', target)

    //     selectOpenRef.current = null;
    //     target.removeEventListener('change', onSelectClose);
    //     // target.removeEventListener('blur', onSelectClose);
    //   };
    //   console.log('Adding event listeners to detect select close', target)
    //   target.addEventListener('change', onSelectClose);
    //   // target.addEventListener('blur', onSelectClose);

    // } else if(target.tagName.toLowerCase() === "option") {

    //   console.log('Non-native click on option', target);
    //   selectOpenRef.current = null;
    //   (target as HTMLElement).parentElement?.blur();
      

    } else {
      event.preventDefault();
      // console.log('handleClick: Looking for clickable inside', target)

      const clickTarget = (target.querySelector('[data-clickable]') || target.firstChild) as HTMLElement
      if(clickTarget && clickTarget.click) {
        if(lastClickedRef.current === clickTarget) return

        setTimeout(() => {
          lastClickedRef.current = null;
        }, 500)

        lastClickedRef.current = clickTarget;
        // console.log('handleClick: Clicking on', clickTarget)
        clickTarget.click()
      }
      
    }
  }, [])

  const findNearest = (fromEl: Element, direction: 'up' | 'down' | 'left' | 'right') => {
    const all = getFocusables(fromEl)
    const fr = fromEl.getBoundingClientRect()
    const fc = centerOf(fr)

    let best = null
    let bestScore = Infinity
    for (const el of all) {
        if (el === fromEl) continue
        const r = el.getBoundingClientRect()
        const c = centerOf(r)
        const dx = c.x - fc.x
        const dy = c.y - fc.y

        // Must be in the intended direction (with a small tolerance based on element size)
        const inDir =
        direction === 'right' ? dx > fr.width  * 0.25 :
        direction === 'left'  ? dx < -fr.width * 0.25 :
        direction === 'down'  ? dy > fr.height * 0.25 :
                                dy < -fr.height * 0.25

        if (!inDir) continue

        const dist    = Math.sqrt(dx * dx + dy * dy)
        const perpDist = (direction === 'right' || direction === 'left') ? Math.abs(dy) : Math.abs(dx)
        const score   = dist + perpDist * 1.5   // penalise misalignment

        if (score < bestScore) { bestScore = score; best = el }
    }
    return best
  }

  function centerOf(rect:DOMRect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  function getFocusables(fromEl?: Element | null) {
    const group = fromEl?.closest('[data-inputgroup="true"]') ?? null;
    const root: Element | Document = group ?? document;
    return Array.from(root.querySelectorAll('[data-focusable]')).filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && !el.closest('[data-focusable-disabled]')
    })
  }

  return (
    <InputContext.Provider
      value={{
        inputMethod,
        setInputMethod,
        focusedEl,
        focusElement: focusEl,
        enableControls: setEnableControls
      }}
    >
        {children}
        <FocusRing />
    </InputContext.Provider>
  );
}

export function useInput() {
  const context = useContext(InputContext);
  if (context === undefined) {
    throw new Error('useInput must be used within an InputProvider');
  }
  return context;
}
