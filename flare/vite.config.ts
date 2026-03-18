import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Warm up frequently accessed modules
    warmup: {
      clientFiles: ['./src/routes/+layout.svelte', './src/routes/+page.svelte'],
    },
  },
  optimizeDeps: {
    // Pre-bundle lucide to avoid scanning 1000+ icons
    include: ['lucide-svelte'],
    // Force re-optimization on first run
    force: false,
  },
  ssr: {
    noExternal: ['lucide-svelte'],
  },
});
