import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('light');

  return {
    subscribe,
    init: () => {
      if (browser) {
        const saved = localStorage.getItem('theme') as Theme | null;
        const theme = saved || 'light';
        set(theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    toggle: () => {
      if (browser) {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';

        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        localStorage.setItem('theme', newTheme);
        set(newTheme);
      }
    },
  };
}

export const theme = createThemeStore();
