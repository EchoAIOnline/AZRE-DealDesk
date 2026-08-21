const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Change `async function startServer() {` to `export const app = express(); async function startServer() {`
// But express is instantiated inside. Let's extract it.
code = code.replace('const app = express();', 'const app = express();\nexport { app };');

// prevent startServer from running in Vercel.
// We can check if process.env.VERCEL is set.
code = code.replace('startServer();', 'if (!process.env.VERCEL) { startServer(); }');

fs.writeFileSync('server.ts', code);
