import { bulkUpload } from './bulk-upload.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.resolve(__dirname, "../server/data/questiondata.json");

console.log(`Starting initial database seed from ${dataPath}...`);
bulkUpload(dataPath);
