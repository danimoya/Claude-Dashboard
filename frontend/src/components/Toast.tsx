/**
 * Toast Notification Components
 * ToastProvider renders a fixed container at bottom-right with auto-dismissing toasts.
 */

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../stores/toastStore';

const DEFAULT_DURATION = 4000;

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const borderColorMap = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
} as const;

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
} as const;

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = iconMap[toast.type];
  const duration = toast.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    const dismissTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration);

    return () => {
      clearTimeout(dismissTimer);
    };
  }, [duration]);

  useEffect(() => {
    if (!isExiting) return;

    const removeTimer = setTimeout(() => {
      onRemove(toast.id);
    }, 200);

    return () => {
      clearTimeout(removeTimer);
    };
  }, [isExiting, onRemove, toast.id]);

  const handleClose = () => {
    setIsExiting(true);
  };

  return (
    <div
      className={clsx(
        'flex items-start gap-3 rounded-lg border border-border border-l-4 bg-card p-4 shadow-lg',
        'min-w-[300px] max-w-[420px]',
        borderColorMap[toast.type],
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      )}
      role="alert"
    >
      <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', iconColorMap[toast.type])} />
      <p className="flex-1 text-sm text-card-foreground">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-card-foreground"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
