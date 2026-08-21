import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
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
});
