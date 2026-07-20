import { create } from 'zustand';

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

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, description) => {
    const id = crypto.randomUUID();
    const newToast: Toast = { id, type, message };
    if (description !== undefined) {
      newToast.description = description;
    }
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export default useToastStore;
