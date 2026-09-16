import { defineConfig } from 'vite'
import path from 'node:path'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '#': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [tanstackStart(), viteReact()],
})

export default config
