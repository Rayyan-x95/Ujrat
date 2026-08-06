import { useSyncExternalStore } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  description?: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string, description?: string) => void;
  dismissToast: (id: string) => void;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

const store: ToastStore = {
  get toasts() {
    return toasts;
  },
  addToast: (type, message, description) => {
    const id = crypto.randomUUID();
    const newToast: Toast = { id, type, message, ...(description !== undefined ? { description } : {}) };
    toasts = [...toasts, newToast];
    notify();
  },
  dismissToast: (id) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToastStore<T = ToastStore>(selector?: (state: ToastStore) => T): T {
  useSyncExternalStore(subscribe, () => toasts);
  return selector ? selector(store) : (store as unknown as T);
}

export default useToastStore;
