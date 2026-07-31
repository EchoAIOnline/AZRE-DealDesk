import re

with open('components/Agents/AgentProfileModal.tsx', 'r') as f:
    content = f.read()

# Replace the specific span for Listed Properties and Off-Market Properties
content = content.replace('{formatCurrency(deal.offerPrice)}', '<span className="text-green-600 dark:text-green-400 mr-1">My Offer:</span>{formatCurrency(deal.offerPrice)}')

with open('components/Agents/AgentProfileModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied")
