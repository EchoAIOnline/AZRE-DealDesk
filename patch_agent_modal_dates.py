import re

with open('components/Agents/AgentProfileModal.tsx', 'r') as f:
    content = f.read()

# Replace for lastContactDate
content = content.replace(
    "onChange={e => handleChange('lastContactDate', e.target.value)}",
    "onChange={e => handleChange('lastContactDate', e.target.value || null)}"
)

# Replace for nextFollowUpDate
content = content.replace(
    "onChange={e => handleChange('nextFollowUpDate', e.target.value)}",
    "onChange={e => handleChange('nextFollowUpDate', e.target.value || null)}"
)

with open('components/Agents/AgentProfileModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied")
