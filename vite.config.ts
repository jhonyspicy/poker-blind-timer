import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages のプロジェクトサイト配下で配信するため base を固定する
export default defineConfig({
  base: '/poker-blind-timer/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
