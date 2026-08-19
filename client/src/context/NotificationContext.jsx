import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((type, message, title = null, duration = 3000) => {
    if (!message) return;

    // Prevent duplicate active notifications with the exact same type and message
    setNotifications((prev) => {
      const existing = prev.find((n) => n.message === message && n.type === type);
      if (existing) {
        // Reset timer on existing notification
        return prev.map((n) => (n.id === existing.id ? { ...n, createdAt: Date.now() } : n));
      }

      const id = Date.now().toString() + Math.random().toString().slice(2, 6);
      const newNotif = { id, type, message, title, duration, createdAt: Date.now() };
      return [...prev, newNotif];
    });
  }, []);

  // Universal notify helper functions (Memoized for stable reference across re-renders)
  const notify = useMemo(() => ({
    success: (msg, title = null, dur = 3000) => addNotification('success', msg, title, dur),
    error: (msg, title = null, dur = 3000) => addNotification('error', msg, title, dur),
    warning: (msg, title = null, dur = 3000) => addNotification('warning', msg, title, dur),
    info: (msg, title = null, dur = 3000) => addNotification('info', msg, title, dur),
    showNotification: (msg, type = 'info', title = null, dur = 3000) => addNotification(type, msg, title, dur),
    dismiss
  }), [addNotification, dismiss]);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      {/* Floating Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {notifications.map((n) => (
          <ToastItem key={n.id} notification={n} onDismiss={() => dismiss(n.id)} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

/**
 * ToastItem Component with Hover Pause/Resume Timer & Smooth Animations
 */
function ToastItem({ notification, onDismiss }) {
  const { type, message, title, duration = 3000 } = notification;
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());

  const startTimer = useCallback(() => {
    if (duration <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, remainingTimeRef.current);
  }, [duration, onDismiss]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearTimer();
  }, [startTimer, clearTimer]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    clearTimer();
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startTimer();
  };

  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
      badge: 'Success'
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-950',
      icon: <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
      badge: 'Error'
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-950',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
      badge: 'Warning'
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-950',
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
      badge: 'Info'
    }
  };

  const style = styles[type] || styles.info;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`p-4 rounded-2xl border shadow-xl flex items-start justify-between gap-3 pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 backdrop-blur-xs select-none ${style.bg} ${isHovered ? 'ring-2 ring-slate-400/20 scale-[1.02]' : ''
        }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {style.icon}
        <div className="text-xs leading-relaxed">
          {title ? (
            <div className="font-semibold text-sm text-slate-900 mb-0.5">{title}</div>
          ) : (
            <div className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-0.5">{style.badge}</div>
          )}
          <p className="font-medium text-slate-800">{message}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition flex-shrink-0 cursor-pointer"
        title="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
