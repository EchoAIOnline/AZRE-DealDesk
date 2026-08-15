const fs = require('fs');
const path = 'components/Agents/AgentCard.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(/<div className="flex items-start justify-between gap-2"><h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">\n\s*&<\/h3>{agent\.loiSent && \(<div className="px-1\.5 h-\[22px\] bg-green-100 dark:bg-green-900\/30 text-green-700 dark:text-green-400 rounded text-\[10px\] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800\/50 whitespace-nowrap mt-1"><Mail size={10} \/> LOI Sent<\/div>\)}<\/div>\n\s*<\/h3>/g,
`<div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">
                                {agent.name}
                            </h3>
                            {agent.loiSent && (
                                <div className="px-1.5 h-[22px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap mt-1">
                                    <Mail size={10} /> LOI Sent
                                </div>
                            )}
                        </div>`
);
fs.writeFileSync(path, code);
