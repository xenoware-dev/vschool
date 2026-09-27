import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './primitives';

// Stack of open layers so Escape only closes the top-most one.
const layerStack = [];

export const useLayer = (onClose) => {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    layerStack.push(id);
    const onKey = (e) => {
      if (e.key === 'Escape' && layerStack[layerStack.length - 1] === id) {
        e.stopPropagation();
        closeRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = layerStack.lastIndexOf(id);
      if (i !== -1) layerStack.splice(i, 1);
    };
  }, [id]);
};

export const Modal = ({ title, description, onClose, size, footer, children, headerExtra, className }) => {
  useLayer(onClose);
  const panelRef = useRef(null);

  useEffect(() => {
    const el = panelRef.current;
    if (el && !el.contains(document.activeElement)) {
      const first = el.querySelector('[autofocus], input:not([type=hidden]), select, textarea');
      (first || el).focus({ preventScroll: true });
    }
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={cx('modal', size && `modal-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        <div className="modal-header no-print">
          <div className="min-w-0">
            <h2 className="modal-title">{title}</h2>
            {description && <div className="modal-desc">{description}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerExtra}
            <button type="button" className="btn btn-ghost btn-icon btn-sm -mr-1.5 -mt-0.5" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {children}
        {footer && <div className="modal-footer no-print">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export const ModalBody = ({ children, className }) => <div className={cx('modal-body', className)}>{children}</div>;

export const Drawer = ({ onClose, header, footer, children, width }) => {
  useLayer(onClose);
  return createPortal(
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" style={width ? { width: `min(${width}px, 100vw)` } : undefined}>
        <div className="drawer-header">
          <div className="min-w-0 flex-1">{header}</div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm -mr-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </>,
    document.body
  );
};

/**
 * Dropdown menu. `items` is an array of
 *   { label, icon, onClick, danger, disabled } | 'separator' | { heading }
 */
export const Menu = ({ trigger, items, align = 'end', width = 200, block = false }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const estHeight = items.length * 32 + 12;
    const openUp = r.bottom + estHeight > window.innerHeight - 8 && r.top > estHeight;
    const style = { minWidth: width };
    if (openUp) style.bottom = window.innerHeight - r.top + 4;
    else style.top = r.bottom + 4;
    if (align === 'end') style.right = Math.max(8, window.innerWidth - r.right);
    else style.left = Math.max(8, r.left);
    setPos(style);
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={block ? 'flex w-full min-w-0' : 'inline-flex'}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </span>
      {open && pos &&
        createPortal(
          <div ref={menuRef} className="menu" style={pos} role="menu" onClick={(e) => e.stopPropagation()}>
            {items.filter(Boolean).map((item, i) => {
              if (item === 'separator') return <div key={i} className="menu-sep" />;
              if (item.heading) return <div key={i} className="menu-label">{item.heading}</div>;
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cx('menu-item', item.danger && 'is-danger', item.disabled && 'opacity-50 pointer-events-none')}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {Icon && <Icon size={15} />}
                  <span className="flex-1">{item.label}</span>
                  {item.hint && <span className="text-xs text-subtle">{item.hint}</span>}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};
