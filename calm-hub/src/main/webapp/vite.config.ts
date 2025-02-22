import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'build/',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/calm' :'http://localhost:8080'
    }
  }
})