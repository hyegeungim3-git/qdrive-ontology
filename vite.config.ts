import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/qdrive-ontology/', // GitHub Pages 서브경로 — 저장소명과 일치
  plugins: [react(), tailwindcss()],
})
