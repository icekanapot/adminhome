import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue' // หรือ react ตามที่ใช้

export default defineConfig({
  plugins: [vue()],
  base: '/adminhome/',
})