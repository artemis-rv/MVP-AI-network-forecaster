import { create } from 'zustand';
import { apiService } from '@/services/api';
import type { Alert, AlertStats, AlertStatus, AlertSeverity } from '@/types/alert';

interface AlertFilters {
  severity: AlertSeverity | '';
  status: AlertStatus | '';
  category: string;
  search: string;
}

interface AlertStore {
  alerts: Alert[];
  totalAlerts: number;
  selectedAlertId: string | null;
  stats: AlertStats | null;
  loading: boolean;
  error: string | null;
  filters: AlertFilters;

  // Actions
  fetchAlerts: () => Promise<void>;
  fetchStats: () => Promise<void>;
  
  setFilter: (key: keyof AlertFilters, value: string) => void;
  resetFilters: () => void;
  selectAlert: (id: string | null) => void;

  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  updateAlert: (id: string, updates: { status?: AlertStatus; assigned_to?: string | null }) => Promise<void>;
}

const defaultFilters: AlertFilters = {
  severity: '',
  status: '',
  category: '',
  search: '',
};

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  totalAlerts: 0,
  selectedAlertId: null,
  stats: null,
  loading: false,
  error: null,
  filters: { ...defaultFilters },

  fetchAlerts: async () => {
    const { filters } = get();
    set({ loading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (filters.severity) params.severity = filters.severity;
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;

      const { alerts, total } = await apiService.getAlerts(params);
      set({ alerts, totalAlerts: total, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await apiService.getAlertStats();
      set({ stats });
    } catch (err: any) {
      console.error('Failed to fetch alert stats', err);
    }
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    get().fetchAlerts();
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters } });
    get().fetchAlerts();
  },

  selectAlert: (id) => set({ selectedAlertId: id }),

  acknowledgeAlert: async (id) => {
    try {
      const updated = await apiService.acknowledgeAlert(id);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
      get().fetchStats();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resolveAlert: async (id) => {
    try {
      const updated = await apiService.resolveAlert(id);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
      get().fetchStats();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateAlert: async (id, updates) => {
    try {
      const updated = await apiService.updateAlert(id, updates);
      set((state) => ({
        alerts: state.alerts.map((a) => (a.id === id ? updated : a)),
      }));
      get().fetchStats();
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));
