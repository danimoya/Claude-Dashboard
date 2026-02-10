/**
 * Toast Notification Store (Zustand)
 * Manages toast notifications with auto-generated IDs and helper methods.
 */

import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, toast],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      id: generateId(),
      type: 'success',
      message,
      duration,
    });
  },

  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      id: generateId(),
      type: 'error',
      message,
      duration,
    });
  },

  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      id: generateId(),
      type: 'warning',
      message,
      duration,
    });
  },

  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      id: generateId(),
      type: 'info',
      message,
      duration,
    });
  },
};
