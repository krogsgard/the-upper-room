// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://krogsgard.github.io',
  base: '/the-upper-room',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
  output: 'static',
  vite: {
    build: {
      rollupOptions: {
        external: ['/the-upper-room/pagefind/pagefind-ui.js'],
      },
    },
  },
});
