import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, CircleAlert, Info, X, TriangleAlert } from 'lucide-react';
import { Modal, ModalBody } from './overlays';

/* ─── Toasts ──────────────────────────────────────────────────────────── */
const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: { icon: CircleCheck, color: 'var(--success)' },
  error: { icon: CircleAlert, color: 'var(--danger)' },
  info: { icon: Info, color: 'var(--primary)' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    ({ title, description, tone = 'success', duration = 4000 }) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, title, description, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="toast-viewport" aria-live="polite">
          {toasts.map((t) => {
            const meta = TOAST_ICONS[t.tone] || TOAST_ICONS.info;
            const Icon = meta.icon;
            return (
              <div key={t.id} className="toast" role="status">
                <Icon size={18} style={{ color: meta.color, flexShrink: 0, marginTop: 1 }} />
                <div className="flex-1 min-w-0">
                  <div className="toast-title">{t.title}</div>
                  {t.description && <div className="toast-desc">{t.description}</div>}
                </div>
                <button type="button" className="btn btn-ghost btn-icon btn-sm -my-1" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

/* ─── Confirm dialog ──────────────────────────────────────────────────── */
const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setState({ ...opts, resolve });
      }),
    []
  );

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          size="sm"
          title={
            <span className="flex items-center gap-2">
              {state.tone === 'danger' && <TriangleAlert size={17} style={{ color: 'var(--danger)' }} />}
              {state.title}
            </span>
          }
          onClose={() => close(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                className={`btn ${state.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {state.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          {state.description && (
            <ModalBody>
              <p className="text-sm text-fg-2 leading-relaxed">{state.description}</p>
            </ModalBody>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};
