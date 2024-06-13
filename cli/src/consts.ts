import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

export const CALM_META_SCHEMA_DIRECTORY = __dirname + '/calm/meta';
export const CALM_SPECTRAL_RULES_DIRECTORY = __dirname + '/spectral';