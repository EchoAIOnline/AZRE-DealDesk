import re

with open('components/Agents/AgentCard.tsx', 'r') as f:
    content = f.read()

# Fix the broken section
bad_string = """<div className="flex items-start justify-between gap-2"><h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">
                            &</h3>{agent.loiSent && (<div className="px-1.5 h-[22px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap mt-1"><Mail size={10} /> LOI Sent</div>)}</div>
                        </h3>"""

good_string = """<div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight break-words">
                                {agent.name}
                            </h3>
                            {agent.loiSent && (
                                <div className="px-1.5 h-[22px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap mt-1">
                                    <Mail size={10} /> LOI Sent
                                </div>
                            )}
                        </div>"""

content = content.replace(bad_string, good_string)

with open('components/Agents/AgentCard.tsx', 'w') as f:
    f.write(content)
