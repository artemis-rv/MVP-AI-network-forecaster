import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PersistStore {
  data: Record<string, any>;
  setValue: (key: string, value: any) => void;
  getValue: (key: string) => any;
  removeValue: (key: string) => void;
  clearAll: () => void;
}

export const usePersistStore = create<PersistStore>()(
  persist(
    (set, get) => ({
      data: {},
      
      setValue: (key, value) =>
        set((state) => ({ data: { ...state.data, [key]: value } })),
        
      getValue: (key) => get().data[key],
      
      removeValue: (key) => {
        set((state) => {
          const newData = { ...state.data };
          delete newData[key];
          return { data: newData };
        });
      },
      
      clearAll: () => set({ data: {} }),
    }),
    {
      name: 'nextrace-session-storage', // unique name
      storage: createJSONStorage(() => sessionStorage), // persists only for the session (clears when tab closes)
    }
  )
);
