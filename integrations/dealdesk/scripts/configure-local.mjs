import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const config={mcpServers:{dealdesk:{command:process.execPath,args:[`--env-file-if-exists=${root}.env`,`${root}src/server.mjs`]}}};
await writeFile(new URL('../.mcp.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
process.stdout.write('Local MCP launch paths configured. Secrets stay in .env.\n');
