import fs from 'fs-extra';
import archiver from 'archiver';
import path from 'node:path';

// Ensure zip folder exists
await fs.ensureDir('zip');

// Copy frontend build
await fs.copy('dist', 'zip');

// Copy Server.ts and rewrite index path
const serverSrc = 'src/Server.ts';
const serverDest = 'zip/Server.ts';
let serverContent = await fs.readFile(serverSrc, 'utf8');

// Replace any occurrences of index.html path to point to the same folder
serverContent = serverContent.replaceAll(/(['"`])(\.\/)?index\.html\1/g, (_, quote) => `${quote}${path.join(__dirname, 'index.html')}${quote}`);

await fs.writeFile(serverDest, serverContent);

// Create zip
const output = fs.createWriteStream('3d-map-generator.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory('zip/', false);
await archive.finalize();

// Delete zip folder after zipping
await fs.remove('zip');

console.log('Zip created and temporary folder deleted!');