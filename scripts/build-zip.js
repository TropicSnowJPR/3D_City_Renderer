import fs from 'fs-extra';
import archiver from 'archiver';
import path from 'node:path';

await fs.ensureDir('zip');

await fs.copy('dist', 'zip');

const serverSrc = 'src/Server.ts';
const serverDest = 'zip/Server.ts';
let serverContent = await fs.readFile(serverSrc, 'utf8');

serverContent = serverContent.replaceAll(/(['"`])(\.\/)?index\.html\1/g, (_, quote) => `${quote}${path.join(__dirname, 'index.html')}${quote}`);

await fs.writeFile(serverDest, serverContent);

const output = fs.createWriteStream('3d-map-generator.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);
archive.directory('zip/', false);
await archive.finalize();

await fs.remove('zip');

console.log('Zip created and temporary folder deleted!');