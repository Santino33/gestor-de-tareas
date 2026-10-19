import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
