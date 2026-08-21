const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace('const app = express();\\nexport { app };', 'const app = express();');
code = code.replace('if (!process.env.VERCEL) { startServer(); }', 'startServer();');
fs.writeFileSync('server.ts', code);
