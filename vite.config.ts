import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const wsopcuaGenerated = fileURLToPath(
  new URL('./node_modules/@wsopcua/wsopcua/_esm/generated', import.meta.url),
)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@wsopcua/wsopcua/generated': wsopcuaGenerated,
    },
  },
  /* @wsopcua/wsopcua 在浏览器侧可能依赖 Node 全局；集成阶段按实际报错补充 polyfill */
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@wsopcua/wsopcua'],
  },
})
