import re

with open('/app/applet/components/Deals/EditDealModal.tsx', 'r') as f:
    content = f.read()

# 1. Feasibility Study
old_fs = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 min-h-[120px] focus:outline-none focus:border-blue-500 resize-y"'
new_fs = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 outline-none h-48 resize-none"'
content = content.replace(old_fs, new_fs)

# 2. Current Asking Price
old_cap = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 pl-8 text-gray-900 dark:text-white text-xl font-bold"'
new_cap = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-3 pl-8 text-gray-900 dark:text-white text-xl font-bold focus:border-blue-500 outline-none"'
content = content.replace(old_cap, new_cap)

# 3. Original Asking Price
old_oap = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-gray-900 dark:text-white text-sm"'
new_oap = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"'
content = content.replace(old_oap, new_oap)

# 4. Price Alert
old_pa = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm"'
new_pa = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-gray-900 dark:text-white text-sm focus:border-blue-500 outline-none"'
content = content.replace(old_pa, new_pa)

# 5. My Cash Offer
old_mco = 'className="w-full bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/50 rounded p-3 pl-8 text-green-600 dark:text-green-400 text-xl font-bold"'
new_mco = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-green-200 dark:border-green-800/50 rounded p-3 pl-8 text-green-600 dark:text-green-400 text-xl font-bold focus:border-blue-500 outline-none"'
content = content.replace(old_mco, new_mco)

# 6. Accepted Asking Price
old_aap = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-green-600 dark:text-green-400 text-sm font-bold"'
new_aap = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 pl-6 text-green-600 dark:text-green-400 text-sm font-bold focus:border-blue-500 outline-none"'
content = content.replace(old_aap, new_aap)

# 7. Estimated Wholesale Profit
old_ewp = 'className="w-full bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 rounded p-2 pl-6 text-blue-600 dark:text-blue-400 font-bold text-sm"'
new_ewp = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-900/50 rounded p-2 pl-6 text-blue-600 dark:text-blue-400 font-bold text-sm focus:border-blue-500 outline-none"'
content = content.replace(old_ewp, new_ewp)

# 8. ARVs and Estimates (these share the same classes)
old_arv = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-green-600 dark:text-green-400 placeholder-green-600 dark:placeholder-green-400 text-2xl font-bold focus:border-green-500 outline-none transition-colors"'
new_arv = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-green-600 dark:text-green-400 placeholder-green-600 dark:placeholder-green-400 text-2xl font-bold focus:border-green-500 outline-none transition-colors"'
content = content.replace(old_arv, new_arv)

old_est = 'className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-gray-900 dark:text-white placeholder-gray-900 dark:placeholder-white text-2xl font-bold focus:border-blue-500 outline-none transition-colors"'
new_est = 'className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4 pl-10 text-gray-900 dark:text-white placeholder-gray-900 dark:placeholder-white text-2xl font-bold focus:border-blue-500 outline-none transition-colors"'
content = content.replace(old_est, new_est)


with open('/app/applet/components/Deals/EditDealModal.tsx', 'w') as f:
    f.write(content)
