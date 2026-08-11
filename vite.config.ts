import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/v1': {
          target: environment.FOODMIND_BACKEND_ORIGIN || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: 'jsdom',
      exclude: ['e2e/**', 'e2e-real/**', 'node_modules/**', 'dist/**'],
      environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        // Route surfaces are exercised by component and Playwright scenario tests;
        // statement coverage is enforced on shared decision, HTTP, and mapping code.
        include: ['src/lib/**/*.{ts,tsx}'],
        exclude: ['src/lib/api/generated/**', 'src/main.tsx'],
        thresholds: {
          statements: 80,
          lines: 80,
          functions: 80,
          branches: 75,
        },
      },
    },
  }
})
