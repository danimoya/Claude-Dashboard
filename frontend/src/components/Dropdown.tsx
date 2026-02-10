/**
 * Dropdown Menu Component
 * Floating menu with keyboard navigation.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export default function Dropdown({ trigger, items, align = 'left' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setFocusIdx(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const enabledItems = items.filter((i) => !i.disabled);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIdx((prev) => (prev + 1) % enabledItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIdx((prev) => (prev - 1 + enabledItems.length) % enabledItems.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < enabledItems.length) {
          enabledItems[focusIdx].onClick();
          close();
        }
        break;
    }
  };

  return (
    <div ref={ref} className="relative inline-block" onKeyDown={handleKeyDown}>
      <div onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        {trigger}
      </div>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={clsx(
            'absolute z-50 mt-1 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg animate-in fade-in-0 zoom-in-95',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) => {
            const enabledIdx = enabledItems.indexOf(item);
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  close();
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  item.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : item.danger
                      ? 'text-destructive hover:bg-destructive/10'
                      : 'text-popover-foreground hover:bg-accent',
                  enabledIdx === focusIdx && 'bg-accent'
                )}
              >
                {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
