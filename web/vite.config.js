import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: './',  // Fix for Electron: don't use absolute paths
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pyodide/*',
          dest: 'pyodide'
        },
        {
          // GGL simulation engine, sourced from the `ggl` submodule
          // (web/ggl-engine). Served/built at /ggl/ so Pyodide can fetch the
          // package files at runtime exactly as before.
          src: 'ggl-engine/src/ggl/*',
          dest: 'ggl'
        },
        {
          // GG assembler, sourced from 'gg-asm' submodule (web/gg-asm)
          src: 'gg-asm/src/ggasm/*',
          dest: 'ggasm'
        }
      ]
    })
  ],
  optimizeDeps: {
    exclude: ['pyodide']
  },
  server: {
    port: 3000,
    open: false,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'dist/', '**/*.test.js']
    },
    reporter: process.env.CI ? 'verbose' : 'default'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate large UI library into its own chunk
          primevue: [
            'primevue/config',
            'primevue/button',
            'primevue/dialog',
            'primevue/message',
            'primevue/toast'
          ],
          // Separate Vue core into its own chunk
          'vue-vendor': ['vue'],
          // Group utility libraries together
          utils: ['@/utils/componentRegistry', '@/utils/constants']
        }
      }
    }
  }
})
