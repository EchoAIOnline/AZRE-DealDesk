import re

with open('/app/applet/components/Deals/EditDealModal.tsx', 'r') as f:
    content = f.read()

# 1. Edit log textarea
old_edit_log = 'className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none resize-none"'
new_edit_log = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none resize-none"'
content = content.replace(old_edit_log, new_edit_log)

# 2. Add log input
old_add_log = 'className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"'
new_add_log = 'className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"'
content = content.replace(old_add_log, new_add_log)

with open('/app/applet/components/Deals/EditDealModal.tsx', 'w') as f:
    f.write(content)
