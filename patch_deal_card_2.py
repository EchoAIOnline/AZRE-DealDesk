import re

with open('/app/applet/components/Deals/DealCard.tsx', 'r') as f:
    content = f.read()

old_structure = '''            <div className="flex flex-col items-start">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">My Offer:</span>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-green-600 dark:text-green-400 font-bold">{deal.offerPrice ? formatCurrency(deal.offerPrice) : '-'}</span>
                    { (arvToDisplay !== undefined && arvToDisplay > 0) && (
                        <div className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[9px] font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800/50 whitespace-nowrap">
                            ARV: {formatCurrency(arvToDisplay)}
                        </div>
                    )}
                </div>
            </div>'''

new_structure = '''            <div className="flex flex-col items-start">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">My Offer:</span>
                <div className="flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">{deal.offerPrice ? formatCurrency(deal.offerPrice) : '-'}</span>
                    { (arvToDisplay !== undefined && arvToDisplay > 0) && (
                        <div className="px-1.5 h-[22px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800/50 whitespace-nowrap">
                            ARV: {formatCurrency(arvToDisplay)}
                        </div>
                    )}
                </div>
            </div>'''

content = content.replace(old_structure, new_structure)

with open('/app/applet/components/Deals/DealCard.tsx', 'w') as f:
    f.write(content)
