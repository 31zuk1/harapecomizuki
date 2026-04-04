import { defineConfig } from 'astro/config';

const site = process.env.SITE_BASE_URL || 'http://localhost:4321/';
const normalizedSite = site.endsWith('/') ? site : `${site}/`;
const pathname = new URL(normalizedSite).pathname.replace(/\/$/, '');

export default defineConfig({
  site: normalizedSite,
  base: pathname || '/'
});
