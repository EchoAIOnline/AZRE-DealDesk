with open('constants.ts', 'r') as f:
    content = f.read()

# Remove the blank line created by sed if it exists
content = content.replace("  \n  { id: 'Investor Friendly'", "  { id: 'Investor Friendly'")

# Insert 'Agent Sent Deal' after 'Agreed to Send Deals'
content = content.replace(
    "{ id: 'Agreed to Send', label: 'Agreed to Send Deals', activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' },",
    "{ id: 'Agreed to Send', label: 'Agreed to Send Deals', activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' },\n  { id: 'Agent Sent Deal', label: 'Agent Sent Deal', activeColorClass: 'text-cyan-600 dark:text-cyan-400 border-cyan-600 dark:border-cyan-400' },"
)

with open('constants.ts', 'w') as f:
    f.write(content)
