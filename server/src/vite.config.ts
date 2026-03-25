import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [
        Vue()
    ],
    server: {
        proxy: {
            "/api": "http://localhost:3000"
        }
    }
});
