import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
        sw: 'src/sw.ts',
      },
      output: {
        entryFileNames: (chunkInfo): string =>
          chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});