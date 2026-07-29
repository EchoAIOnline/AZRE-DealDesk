import fs from 'fs';

let agentCode = fs.readFileSync('components/Agents/AgentCard.tsx', 'utf8');

// I will look for:
//                 </div>
//             {renderFollowUp()}
//                 {isExpanded && agent.notes && agent.notes.length > 0 && (
//                     ...
//                 )}
//             </div>
//         </div>
//     );

// It's easier to just replace this exact chunk:
agentCode = agentCode.replace(
    '                </div>\n            {renderFollowUp()}\n                {isExpanded && agent.notes && agent.notes.length > 0 && (\n                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">\n                         <div className="font-bold mb-2 uppercase text-[10px] text-gray-400">Notes & Activity</div>\n                         <div className="space-y-2 max-h-40 overflow-y-auto pr-1">\n                             {agent.notes.map((note, idx) => (\n                                <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-700 pl-2">\n                                    {note}\n                                </div>\n                             ))}\n                        </div>\n                    </div>\n                )}\n            </div>\n        </div>',
    '                </div>\n            </div>\n            {renderFollowUp()}\n            {isExpanded && agent.notes && agent.notes.length > 0 && (\n                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2">\n                     <div className="font-bold mb-2 uppercase text-[10px] text-gray-400">Notes & Activity</div>\n                     <div className="space-y-2 max-h-40 overflow-y-auto pr-1">\n                         {agent.notes.map((note, idx) => (\n                            <div key={idx} className="border-l-2 border-gray-300 dark:border-gray-700 pl-2">\n                                {note}\n                            </div>\n                         ))}\n                    </div>\n                </div>\n            )}\n        </div>'
);
fs.writeFileSync('components/Agents/AgentCard.tsx', agentCode);
