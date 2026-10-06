import { type ReactNode, useEffect, useRef, useState } from 'react';

/** 16x16 title-bar icon: two overlapping playing cards. */
export function SolitaireIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1.5" y="1.5" width="8" height="11" fill="#0000a8" stroke="#000" />
      <rect x="6.5" y="3.5" width="8" height="11" fill="#fff" stroke="#000" />
      <path d="M10.5 6 L12.5 9 L10.5 12 L8.5 9 Z" fill="#f00" />
    </svg>
  );
}

interface TitleBarProps {
  title: string;
  active?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  maximized?: boolean;
  icon?: boolean;
}

export function TitleBar({ title, active = true, onMinimize, onMaximize, onClose, maximized, icon }: TitleBarProps) {
  return (
    <div className={`title-bar${active ? '' : ' inactive'}`}>
      {icon && <SolitaireIcon />}
      <span className="title-text">{title}</span>
      <div className="title-buttons">
        {onMinimize && <button className="title-button minimize" aria-label="Minimize" onClick={onMinimize} />}
        {onMaximize && (
          <button
            className={`title-button ${maximized ? 'restore' : 'maximize'}`}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={onMaximize}
          />
        )}
        {onClose && <button className="title-button close" aria-label="Close" onClick={onClose} />}
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string; // "&Deal" marks D as the access key
  shortcut?: string;
  help?: string;
  disabled?: boolean;
  checked?: boolean;
  onSelect?: () => void;
}

export type MenuEntry = MenuItem | 'separator';

export interface Menu {
  label: string;
  items: MenuEntry[];
}

/** Renders "&Deal" as Deal with an underlined D. */
export function AccessKey({ label }: { label: string }) {
  const i = label.indexOf('&');
  if (i < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, i)}
      <u>{label[i + 1]}</u>
      {label.slice(i + 2)}
    </>
  );
}

interface MenuBarProps {
  menus: Menu[];
  onHelpText: (text: string) => void;
}

export function MenuBar({ menus, onHelpText }: MenuBarProps) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open === null) onHelpText('');
  }, [open, onHelpText]);

  return (
    <div className="menu-bar" ref={ref}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="menu">
          <button
            className={`menu-title${open === i ? ' open' : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && setOpen(i)}
          >
            <AccessKey label={menu.label} />
          </button>
          {open === i && (
            <div className="menu-dropdown" role="menu">
              {menu.items.map((item, j) =>
                item === 'separator' ? (
                  <div key={j} className="menu-separator" />
                ) : (
                  <button
                    key={j}
                    role="menuitem"
                    className="menu-item"
                    disabled={item.disabled}
                    onPointerEnter={() => onHelpText(item.help ?? '')}
                    onClick={() => {
                      setOpen(null);
                      item.onSelect?.();
                    }}
                  >
                    <span className="menu-check">{item.checked ? '✓' : ''}</span>
                    <span className="menu-label">
                      <AccessKey label={item.label} />
                    </span>
                    <span className="menu-shortcut">{item.shortcut}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}

/** A modal Win95 dialog box, centred over the game window. */
export function Dialog({ title, children, onClose, className = '' }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <div className={`window dialog ${className}`} role="dialog" aria-label={title}>
        <TitleBar title={title} onClose={onClose} />
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
