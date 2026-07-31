import re

with open('components/Agents/AgentProfileModal.tsx', 'r') as f:
    content = f.read()

# Replace listPrice with offerPrice in the specific span for Listed Properties and Off-Market Properties
content = content.replace('{formatCurrency(deal.listPrice)}', '{formatCurrency(deal.offerPrice)}')

with open('components/Agents/AgentProfileModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied")
