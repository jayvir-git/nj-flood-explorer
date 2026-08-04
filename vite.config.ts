import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite otherwise modulepreloads the lazy MapStage → ArcGIS graph into
    // index.html (~200 links), putting the SDK back on the critical path (P3/D18).
    modulePreload: false,
  },
})
