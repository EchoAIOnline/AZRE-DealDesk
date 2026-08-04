import re

with open('components/Agents/AgentsView.tsx', 'r') as f:
    content = f.read()

# Fix the map
content = content.replace(
    "tab.id === 'Contacted' ? filteredAgentsBySearch.filter(a => a.spokeWithAgent).length :",
    "tab.id === 'Agent Sent Deal' ? filteredAgentsBySearch.filter(a => a.agentSentDeal).length :"
)

# Fix the option
content = content.replace(
    '<option value="Contacted">Contacted Already</option>',
    ''
)
content = content.replace(
    '<option value="Agreed to Send">Agreed to Send Deals</option>',
    '<option value="Agreed to Send">Agreed to Send Deals</option>\n                                <option value="Agent Sent Deal">Agent Sent Deal</option>'
)

with open('components/Agents/AgentsView.tsx', 'w') as f:
    f.write(content)
