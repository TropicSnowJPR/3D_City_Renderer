import Vue from '@vitejs/plugin-vue';
import { defineConfig, PluginOption } from 'vite';

export default defineConfig({
    plugins: [ Vue() as unknown as PluginOption ],
    build: {
        target: "esnext",
        rollupOptions: { output: { format: "es" } },
    },
    worker: { format: "es" },
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
                secure: false,
            }
        }
    }
});
