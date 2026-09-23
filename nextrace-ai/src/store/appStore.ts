import { create } from 'zustand';
import { notifications as mockNotifs } from '@/data/mockData';

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  severity: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface AppState {
  // Navigation
  activePage: string;
  setActivePage: (page: string) => void;

  // Notifications
  notifications: Notification[];
  markAllRead: () => void;
  unreadCount: number;

  // Toast
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Live demo ticker
  isLive: boolean;
  toggleLive: () => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // User menu
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;

  // Notification panel
  notifPanelOpen: boolean;
  setNotifPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'overview',
  setActivePage: (page) => set({ activePage: page }),

  notifications: mockNotifs,
  unreadCount: mockNotifs.filter((n) => !n.read).length,
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  isLive: true,
  toggleLive: () => set((state) => ({ isLive: !state.isLive })),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),

  userMenuOpen: false,
  setUserMenuOpen: (open) => set({ userMenuOpen: open }),

  notifPanelOpen: false,
  setNotifPanelOpen: (open) => set({ notifPanelOpen: open }),
}));
