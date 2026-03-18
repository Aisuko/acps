<script lang="ts">
  import { theme } from '$lib/stores/theme';
  import { Moon, Sun } from 'lucide-svelte';

  function toggleTheme() {
    theme.toggle();
  }
</script>

<button
  onclick={toggleTheme}
  class="p-2.5 rounded-xl hover:bg-white/80 dark:hover:bg-gray-800 transition-all duration-300 group"
  aria-label="Toggle theme"
>
  <Sun
    class="w-5 h-5 hidden dark:block text-amber-400 group-hover:rotate-180 transition-transform duration-500"
  />
  <Moon
    class="w-5 h-5 block dark:hidden text-indigo-600 group-hover:-rotate-12 transition-transform duration-300"
  />
</button>
