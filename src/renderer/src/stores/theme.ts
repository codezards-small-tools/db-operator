import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  applyTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    set({ theme })
    get().applyTheme()
  },
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    get().setTheme(next)
  },
  applyTheme: () => {
    document.documentElement.dataset.theme = get().theme
  }
}))

export function getMonacoTheme(): 'vs' | 'vs-dark' {
  return useThemeStore.getState().theme === 'dark' ? 'vs-dark' : 'vs'
}
