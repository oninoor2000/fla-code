import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
      '#': `${import.meta.dirname}/src`,
    },
  },
  plugins: [tanstackStart(), viteReact()],
})

export default config
