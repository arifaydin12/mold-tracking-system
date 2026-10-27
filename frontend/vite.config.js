import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// `vite build --mode demo` (npm run build:demo) produces the static GitHub Pages demo:
// relative asset paths, hash routing and an in-browser mock backend instead of the real API.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, here, '')
    const demo = mode === 'demo' || env.VITE_DEMO === 'true' || process.env.VITE_DEMO === 'true'

    return {
        base: demo ? './' : '/',
        plugins: [react()],
        define: {
            'import.meta.env.VITE_DEMO': JSON.stringify(String(demo)),
        },
        build: demo
            ? {
                  // GitHub Pages serves the repository's /docs folder
                  outDir: path.resolve(here, '../docs'),
                  emptyOutDir: true,
                  chunkSizeWarningLimit: 800,
              }
            : { outDir: 'dist', chunkSizeWarningLimit: 800 },
        server: {
            port: 3000,
            fs: { allow: ['..'] }, // the demo imports database/seed-data.json from the repository root
            proxy: {
                '/api': env.VITE_PROXY_TARGET || 'http://localhost:5000',
            },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.js'],
            css: false,
        },
    }
})
