import {setupEnvironment} from '../src/runtime.js';
import {defaultPath} from '../src/db.js';
import {fileURLToPath} from 'node:url';
console.log(JSON.stringify(setupEnvironment({directory:process.cwd(),template:fileURLToPath(new URL('../.env.example',import.meta.url)),database:defaultPath})));
