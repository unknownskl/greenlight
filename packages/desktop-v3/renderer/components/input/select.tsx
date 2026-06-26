import React from 'react';
import { useInput } from '../../contexts/InputContext';

interface SelectProps {
  name: string;
  options: string[] | { [key: string]: string | boolean };
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export default function Select({
  name,
  options,
  defaultValue,
  onChange
}: SelectProps) {
  const [selected, setSelected] = React.useState<string | null>(defaultValue ?? null);
  const popoverRef = React.useRef<HTMLUListElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const { focusElement } = useInput();

  function openPopover() {
    popoverRef.current?.showPopover();
    const selected = popoverRef.current?.getElementsByClassName('selected')
    const childs = (selected && selected.length > 0) ? selected : [popoverRef.current?.firstChild]

    if(childs[0]){
      focusElement(childs[0] as Element);
    }
  }

  function closePopover() {
    popoverRef.current?.hidePopover();
    focusElement(buttonRef.current as Element);
  }

  function handleSelect(option: string) {
    setSelected(option);
    closePopover();
    if (onChange) onChange(option);
  }

  React.useEffect(() => {
    setSelected(defaultValue ?? null);
  }, [defaultValue]);

  return (
    <React.Fragment>
      <button
        ref={buttonRef}
        className="btn w-auto"
        data-focusable
        style={{ anchorName: `--anchor-${name}` } as React.CSSProperties}
        onClick={openPopover}
      >
        {
          selected ? (Array.isArray(options) ? selected : options[selected]) : (Array.isArray(options) ? options[0] : options[Object.keys(options)[0]])
        }
      </button>

      <ul
        ref={popoverRef}
        className="dropdown dropdown-bottom dropdown-end menu w-52 rounded-box bg-base-100 shadow-sm"
        popover="auto"
        style={{ positionAnchor: `--anchor-${name}` } as React.CSSProperties}
      >
        {Array.isArray(options) ? options.map((option) => (
          <li key={option} data-focusable className={selected === option ? 'selected' : ''}>
            <a onClick={(e) => { e.preventDefault(); handleSelect(option); }}>{option}</a>
          </li>
        )) : Object.keys(options).map((key) => (
          <li key={key} data-focusable className={selected === key ? 'selected' : ''}>
            <a onClick={(e) => { e.preventDefault(); handleSelect(key); }}>{options[key]}</a>
          </li>
        ))}
      </ul>
    </React.Fragment>
  );
}