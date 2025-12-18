import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    plugins: [{
        name: 'serve-sample-json',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/data.json') {
                    const file = path.resolve(__dirname, 'public', 'data.json');
                    const data = fs.readFileSync(file, 'utf8');
                    res.setHeader('content-type', 'application/json');
                    res.end(data);
                } else next();
            });
        }
    }]
});