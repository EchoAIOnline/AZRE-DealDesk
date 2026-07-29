import fs from 'fs';

let code = fs.readFileSync('components/Buyers/BuyerCard.tsx', 'utf8');

const target = `                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Mail size={14} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                        <a href={\`mailto:\${buyer.email}\`} onClick={e => e.stopPropagation()} className="truncate hover:text-blue-500 hover:underline">{buyer.email || <span className="text-gray-400 italic">No Email</span>}</a>
                    </div>
                </div>
                {/* Expandable Activity & Notes */}
            {renderFollowUp()}
                {isExpanded && (`;

const replacement = `                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Mail size={14} className="text-gray-400 dark:text-gray-500 shrink-0"/> 
                        <a href={\`mailto:\${buyer.email}\`} onClick={e => e.stopPropagation()} className="truncate hover:text-blue-500 hover:underline">{buyer.email || <span className="text-gray-400 italic">No Email</span>}</a>
                    </div>
                </div>
            </div>
            </div>
            {renderFollowUp()}
                {isExpanded && (`;

code = code.replace(target, replacement);

fs.writeFileSync('components/Buyers/BuyerCard.tsx', code);
