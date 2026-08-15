import re

with open('/app/applet/components/Deals/EditDealModal.tsx', 'r') as f:
    content = f.read()

old_outer = 'className="bg-gray-50 dark:bg-black/20 rounded border border-gray-200 dark:border-gray-800 p-4 h-48 overflow-y-auto space-y-2"'
new_outer = 'className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 p-4 h-48 overflow-y-auto space-y-2"'
content = content.replace(old_outer, new_outer)

with open('/app/applet/components/Deals/EditDealModal.tsx', 'w') as f:
    f.write(content)
