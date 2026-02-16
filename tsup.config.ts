import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    email: 'email/src/index.ts',
    docs: 'docs/src/index.ts',
    seo: 'seo/src/index.ts',
    'newsletter-ai': 'newsletter-ai/src/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@mklyml/core', '@mklyml/kits', 'zod'],
});
