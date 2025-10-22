import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './drawer.css';

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

const focusableSelectors =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
          (element) => !element.hasAttribute('disabled')
        )
      : [];
    const firstFocusable = focusable[0] ?? panel;
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const panelElement = panelRef.current;
        if (!panelElement) {
          return;
        }
        const focusableElements = Array.from(
          panelElement.querySelectorAll<HTMLElement>(focusableSelectors)
        ).filter((element) => !element.hasAttribute('disabled'));

        if (focusableElements.length === 0) {
          event.preventDefault();
          panelElement.focus();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (active === first || !panelElement.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="drawer__container" role="presentation">
      <button
        type="button"
        className="drawer__backdrop"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="drawer__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body
  );
}
