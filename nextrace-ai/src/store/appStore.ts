import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { notifications as mockNotifs } from '@/data/mockData';
import type { Alert } from '@/types/alert';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Admin' | 'SOC Analyst';
  status: 'Active' | 'Disabled';
  lastActive: string;
}

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr-1',
    name: 'Alice Administrator',
    email: 'admin@nextrace.ai',
    password: 'admin123',
    role: 'Admin',
    status: 'Active',
    lastActive: 'Just now',
  },
  {
    id: 'usr-2',
    name: 'Bob Analyst',
    email: 'analyst@nextrace.ai',
    password: 'soc123',
    role: 'SOC Analyst',
    status: 'Active',
    lastActive: '5 mins ago',
  },
  {
    id: 'usr-3',
    name: 'Charlie Security',
    email: 'charlie@nextrace.ai',
    password: 'soc123',
    role: 'SOC Analyst',
    status: 'Active',
    lastActive: '32 mins ago',
  },
  {
    id: 'usr-4',
    name: 'Diana Forensic',
    email: 'diana@nextrace.ai',
    password: 'soc123',
    role: 'SOC Analyst',
    status: 'Active',
    lastActive: '3 hours ago',
  },
  {
    id: 'usr-5',
    name: 'Evan Inactive',
    email: 'evan@nextrace.ai',
    password: 'soc123',
    role: 'SOC Analyst',
    status: 'Disabled',
    lastActive: '4 days ago',
  },
];

export interface AppNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  severity: string;
  alertId?: string;
  status?: string;
  sourceIp?: string;
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

  // Auth & User Accounts
  userRole: 'soc' | 'admin' | null;
  setUserRole: (role: 'soc' | 'admin' | null) => void;
  currentUser: UserAccount | null;
  users: UserAccount[];
  loginWithCredentials: (email: string, password: string) => { success: boolean; error?: string; user?: UserAccount };
  loginAsDemo: (role: 'soc' | 'admin') => void;
  logout: () => void;
  addUser: (userData: { name: string; email: string; password?: string; role: 'Admin' | 'SOC Analyst'; status: 'Active' | 'Disabled' }) => void;
  updateUser: (id: string, updates: Partial<UserAccount>) => void;
  toggleUserStatus: (id: string) => void;
  deleteUser: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  markAllRead: () => void;
  markNotificationAsRead: (id: string) => void;
  syncNotificationsFromAlerts: (alerts: Alert[]) => void;
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

  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // User menu
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;

  // Notification panel
  notifPanelOpen: boolean;
  setNotifPanelOpen: (open: boolean) => void;

  // Theme
  isDark: boolean;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activePage: 'overview',
      setActivePage: (page) => set({ activePage: page }),

      userRole: null,
      currentUser: null,
      users: DEFAULT_USERS,

      setUserRole: (role) => {
        if (!role) {
          set({ userRole: null, currentUser: null });
        } else {
          // If setting role directly, find corresponding default user
          const matchedUser = get().users.find(
            (u) => (role === 'admin' ? u.role === 'Admin' : u.role === 'SOC Analyst') && u.status === 'Active'
          ) || get().users[0];
          set({ userRole: role, currentUser: matchedUser });
        }
      },

      loginWithCredentials: (email: string, password: string) => {
        const cleanEmail = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email.toLowerCase() === cleanEmail);

        if (!user) {
          return { success: false, error: 'User not found. Check your email address or use demo credentials.' };
        }

        if (user.password && user.password !== password) {
          return { success: false, error: 'Invalid password. Please check your credentials.' };
        }

        if (user.status === 'Disabled') {
          return { success: false, error: 'This user account is currently disabled. Please contact a system administrator.' };
        }

        const nowStr = 'Just now';
        const updatedUsers = get().users.map((u) =>
          u.id === user.id ? { ...u, lastActive: nowStr } : u
        );

        const role: 'admin' | 'soc' = user.role === 'Admin' ? 'admin' : 'soc';

        set({
          userRole: role,
          currentUser: { ...user, lastActive: nowStr },
          users: updatedUsers,
          activePage: role === 'admin' ? 'overview' : 'dashboard',
        });

        return { success: true, user };
      },

      loginAsDemo: (role: 'soc' | 'admin') => {
        const targetRole = role === 'admin' ? 'Admin' : 'SOC Analyst';
        const user = get().users.find((u) => u.role === targetRole && u.status === 'Active') || get().users[0];

        const nowStr = 'Just now';
        const updatedUsers = get().users.map((u) =>
          u.id === user.id ? { ...u, lastActive: nowStr } : u
        );

        set({
          userRole: role,
          currentUser: { ...user, lastActive: nowStr },
          users: updatedUsers,
          activePage: role === 'admin' ? 'overview' : 'dashboard',
        });
      },

      logout: () => {
        set({ userRole: null, currentUser: null, userMenuOpen: false });
      },

      addUser: (userData) => {
        const newUser: UserAccount = {
          id: `usr-${Date.now()}`,
          name: userData.name,
          email: userData.email,
          password: userData.password || 'nextrace123',
          role: userData.role,
          status: userData.status,
          lastActive: 'Never',
        };
        set((state) => ({ users: [newUser, ...state.users] }));
      },

      updateUser: (id, updates) => {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
          currentUser: state.currentUser?.id === id ? { ...state.currentUser, ...updates } : state.currentUser,
        }));
      },

      toggleUserStatus: (id) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, status: u.status === 'Active' ? 'Disabled' : 'Active' } : u
          ),
        }));
      },

      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
      },

      notifications: mockNotifs.map((n) => ({ ...n, alertId: undefined })),
      unreadCount: mockNotifs.filter((n) => !n.read).length,
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      markNotificationAsRead: (id: string) =>
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        }),
      syncNotificationsFromAlerts: (alerts: Alert[]) => {
        if (!alerts || alerts.length === 0) return;
        const currentReadSet = new Set(
          get().notifications.filter((n) => n.read).map((n) => n.id)
        );

        const alertNotifications: AppNotification[] = alerts.map((a) => {
          const notifId = `alert-${a.id}`;
          const isResolved = a.status === 'RESOLVED';
          const isAck = a.status === 'ACKNOWLEDGED';
          const isRead = isResolved || isAck || currentReadSet.has(notifId);

          let timeStr = 'Just now';
          if (a.created_at || a.first_seen) {
            try {
              const dateVal = new Date(a.created_at || a.first_seen).getTime();
              if (!isNaN(dateVal)) {
                const diffMs = Date.now() - dateVal;
                const diffMin = Math.floor(diffMs / 60000);
                if (diffMin < 1) timeStr = 'Just now';
                else if (diffMin < 60) timeStr = `${diffMin}m ago`;
                else {
                  const diffHr = Math.floor(diffMin / 60);
                  if (diffHr < 24) timeStr = `${diffHr}h ago`;
                  else timeStr = `${Math.floor(diffHr / 24)}d ago`;
                }
              }
            } catch {
              timeStr = 'Recent';
            }
          }

          return {
            id: notifId,
            alertId: a.id,
            title: a.title,
            desc: a.source_ip ? `${a.source_ip} · ${a.description}` : a.description,
            time: timeStr,
            read: isRead,
            severity: a.severity.toLowerCase(),
            status: a.status,
            sourceIp: a.source_ip,
          };
        });

        // Also keep any non-alert notifications from before
        const nonAlertNotifs = get().notifications.filter(
          (n) => !n.alertId && !n.id.startsWith('alert-')
        );
        const combined = [...alertNotifications, ...nonAlertNotifs];
        const unreadCount = combined.filter((n) => !n.read).length;

        set({
          notifications: combined,
          unreadCount,
        });
      },

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

      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      isDark: false,
      toggleTheme: () => {
        const next = !get().isDark;
        set({ isDark: next });
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      },
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        userRole: state.userRole,
        currentUser: state.currentUser,
        users: state.users,
        activePage: state.activePage,
        sidebarCollapsed: state.sidebarCollapsed,
        isDark: state.isDark,
      }),
    }
  )
);
