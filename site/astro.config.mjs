import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://vladislavprimakov.github.io',
  base: '/graphs',
  integrations: [tailwind(), react()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1500,
    },
  },
});
