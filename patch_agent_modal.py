import re

with open('components/Agents/AgentProfileModal.tsx', 'r') as f:
    content = f.read()

# 1. Update listedProperties and add offMarketProperties
search_listed = "const listedProperties = deals.filter(d => d && d.agentName && d.agentName.toLowerCase().trim() === (agent.name || '').toLowerCase().trim());"
replace_listed = """
    const agentDeals = deals.filter(d => d && d.agentName && d.agentName.toLowerCase().trim() === (agent.name || '').toLowerCase().trim());
    const listedProperties = agentDeals.filter(d => d.listingType !== 'Off-Market');
    const offMarketProperties = agentDeals.filter(d => d.listingType === 'Off-Market');
"""
content = content.replace(search_listed, replace_listed.strip())

# 2. Extract Follow-Up Assistant Section
follow_up_start_str = "{/* Follow-Up Assistant (Moved from Left Column) */}"
if follow_up_start_str not in content:
    follow_up_start_str = "{/* Follow-Up Assistant"
    
follow_up_idx = content.find(follow_up_start_str)
end_section_idx = content.find("</section>", follow_up_idx) + len("</section>")

follow_up_section = content[follow_up_idx:end_section_idx]
content = content[:follow_up_idx] + content[end_section_idx:]

# 3. Insert Follow-Up Assistant below Contact Information
contact_info_end_str = "</div>\n                                </div>\n                            </section>"
contact_info_idx = content.find(contact_info_end_str) + len(contact_info_end_str)

content = content[:contact_info_idx] + "\n\n                            " + follow_up_section + content[contact_info_idx:]

# 4. Insert Off-Market Properties below Current Listed Properties
listed_prop_end_str = "No active listings found for this agent.\n                                            </div>\n                                        )}\n                                    </div>\n                                </div>\n                            </section>"

listed_prop_idx = content.find(listed_prop_end_str) + len(listed_prop_end_str)

off_market_section = """
                            {/* Current Off-Market Properties */}
                            <section>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 mt-8 flex items-center gap-2">
                                    <Home size={16}/> Current Off-Market Properties
                                </h3>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm min-h-[160px] flex flex-col">
                                    <div className="flex-1 overflow-y-auto max-h-[200px] space-y-2">
                                        {offMarketProperties.length > 0 ? (
                                            offMarketProperties.map(deal => (
                                                <div key={deal.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm">
                                                    <div className="flex flex-col truncate">
                                                        <button 
                                                            type="button"
                                                            onClick={() => onOpenDeal && onOpenDeal(deal)}
                                                            className="text-left font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
                                                        >
                                                            {deal.address}
                                                        </button>
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">{deal.offerDecision}</span>
                                                    </div>
                                                    <div className="text-xs font-mono font-medium text-gray-600 dark:text-gray-400">
                                                        {formatCurrency(deal.listPrice)}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                                                No off-market properties found for this agent.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>"""

content = content[:listed_prop_idx] + off_market_section + content[listed_prop_idx:]

with open('components/Agents/AgentProfileModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied")
