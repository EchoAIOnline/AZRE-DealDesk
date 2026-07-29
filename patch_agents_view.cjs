const fs = require('fs');
let code = fs.readFileSync('components/Agents/AgentsView.tsx', 'utf8');

const target = `                            </select>
                        </div>
                        <div className="col-span-full flex justify-end">`;

const replacement = `                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Agent Follow-Up Status</label>
                            <select className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2" onChange={e => setFilterConfig({type: 'Agent Follow-Up Status', value: e.target.value})} value={filterConfig.type === 'Agent Follow-Up Status' ? filterConfig.value : ''}>
                                <option value="">All Follow-Ups</option>
                                <option value="Future Follow-Ups">Future Follow-Ups</option>
                                <option value="Missed Follow-Ups">Missed Follow-Ups</option>
                            </select>
                        </div>
                        <div className="col-span-full flex justify-end">`;

code = code.replace(target, replacement);
fs.writeFileSync('components/Agents/AgentsView.tsx', code);
