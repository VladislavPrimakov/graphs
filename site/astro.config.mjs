import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://vladislavprimakov.github.io',
  base: '/graphs',
  integrations: [tailwind()],
  vite: {
    build: {
      chunkSizeWarningLimit: 800,
    },
  },
});
