// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dashboard/', // This is good, matches your deployment path
  build: {
    outDir: 'dist' // This is also standard and correct
  }
})

//  base: '/dashboard/', 