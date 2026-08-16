import re

with open('/app/applet/components/Deals/DealCard.tsx', 'r') as f:
    content = f.read()

# 1. Add arvToDisplay logic
arv_logic = """  const daysToEMD = calculateDaysRemaining(deal.emdDate);

  let arvToDisplay: number | undefined = undefined;
  if (deal.renovationARV && deal.renovationARV > 0) {
    arvToDisplay = deal.renovationARV;
  } else if (deal.newConstructionARV && deal.newConstructionARV > 0) {
    arvToDisplay = deal.newConstructionARV;
  }
"""
content = content.replace('  const daysToEMD = calculateDaysRemaining(deal.emdDate);', arv_logic)

# 2. Update the HTML structure for List Price and My Offer
old_structure = '''        <div className="flex gap-6 mb-3 text-sm">
            <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">List Price:</span>
                <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(deal.listPrice)}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">My Offer:</span>
                <div className="flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400 font-bold">{deal.offerPrice ? formatCurrency(deal.offerPrice) : '-'}</span>
                    { (deal.loiSent || deal.contactStatus === 'Sent LOI Email') && (
                        <div className="px-1.5 h-[22px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[10px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap">
                            <Mail size={10} /> LOI Sent
                        </div>
                    )}
                </div>
            </div>
        </div>'''

new_structure = '''        <div className="flex gap-6 mb-3 text-sm">
            <div className="flex flex-col items-start">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">List Price:</span>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-gray-900 dark:text-white font-bold">{formatCurrency(deal.listPrice)}</span>
                    { (deal.loiSent || deal.contactStatus === 'Sent LOI Email') && (
                        <div className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[9px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800/50 whitespace-nowrap">
                            <Mail size={10} /> LOI Sent
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-start">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wide font-semibold mb-0.5">My Offer:</span>
                <div className="flex flex-col items-start gap-1">
                    <span className="text-green-600 dark:text-green-400 font-bold">{deal.offerPrice ? formatCurrency(deal.offerPrice) : '-'}</span>
                    { (arvToDisplay !== undefined && arvToDisplay > 0) && (
                        <div className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[9px] font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800/50 whitespace-nowrap">
                            ARV: {formatCurrency(arvToDisplay)}
                        </div>
                    )}
                </div>
            </div>
        </div>'''

content = content.replace(old_structure, new_structure)

with open('/app/applet/components/Deals/DealCard.tsx', 'w') as f:
    f.write(content)
