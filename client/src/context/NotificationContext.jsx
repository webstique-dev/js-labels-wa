import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((type, message, title = null, duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    const newNotif = { id, type, message, title, duration };

    setNotifications((prev) => [...prev, newNotif]);

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  const notify = {
    success: (msg, title, dur) => addNotification('success', msg, title, dur),
    error: (msg, title, dur) => addNotification('error', msg, title, dur),
    warning: (msg, title, dur) => addNotification('warning', msg, title, dur),
    info: (msg, title, dur) => addNotification('info', msg, title, dur),
    dismiss
  };

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      {/* Toast Notification Container */}
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

function ToastItem({ notification, onDismiss }) {
  const { type, message, title } = notification;

  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
    }
  };

  const style = styles[type] || styles.info;

  return (
    <div className={`p-4 rounded-xl border shadow-lg flex items-start justify-between gap-3 pointer-events-auto transition-all transform animate-slide-down ${style.bg}`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {style.icon}
        <div className="text-xs font-semibold leading-relaxed">
          {title && <div className="font-extrabold text-sm mb-0.5">{title}</div>}
          <p>{message}</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
