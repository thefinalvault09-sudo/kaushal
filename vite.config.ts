import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Capacitor Android build serves assets from the WebView's local origin
// (root-relative, not a GitHub Pages subpath), so it needs its own base path
// and output dir — set BUILD_TARGET=capacitor (see package.json's
// build:capacitor script) to produce that variant into dist-capacitor/.
const isCapacitor = process.env.BUILD_TARGET === 'capacitor'

// https://vite.dev/config/
export default defineConfig({
  // Web build is served from https://ravdipeda-crypto.github.io/hi/ (a repo
  // subpath), so asset URLs must be rooted at /hi/ rather than /.
  base: isCapacitor ? '/' : '/hi/',
  plugins: [react()],
  build: {
    outDir: isCapacitor ? 'dist-capacitor' : 'dist',
  },
})
