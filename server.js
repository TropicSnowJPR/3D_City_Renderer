import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.get('/api/sample', (req, res) => {
    const file = path.join(__dirname, 'public', 'data.json');
    fs.readFile(file, 'utf8', (err, data) => {
        if (err) return res.status(500).send('read error');
        res.type('application/json').send(data);
    });
});

app.listen(3000);
