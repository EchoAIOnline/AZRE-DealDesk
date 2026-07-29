import React, { useState } from 'react';
import { Calculator, Home, Settings2, DollarSign, Percent, TrendingUp, Info, Wrench } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

export const DealAnalyzer: React.FC = () => {
    const [sqft, setSqft] = useState<number | ''>('');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    
    // Mode
    const [calculatorMode, setCalculatorMode] = useState<'Instant' | 'Quick'>('Instant');

    // AS-IS values
    const [zillow, setZillow] = useState<number | ''>('');
    const [realtor, setRealtor] = useState<number | ''>('');
    const [redfin, setRedfin] = useState<number | ''>('');
    const [other, setOther] = useState<number | ''>('');
    
    // Calculated AS-IS
    const asIsValues = [zillow, realtor, redfin, other].map(v => Number(v)).filter(v => v > 0);
    const asIsAverage = asIsValues.length > 0 ? asIsValues.reduce((a, b) => a + b, 0) / asIsValues.length : 0;

    const getAsIsScale = (value: number, mode: 'Instant' | 'Quick') => {
        if (mode === 'Instant') {
            if (value < 150000) return { exit: 60, fee: 20000 };
            if (value <= 200000) return { exit: 65, fee: 20000 };
            if (value <= 300000) return { exit: 70, fee: 25000 };
            if (value <= 400000) return { exit: 75, fee: 35000 };
            if (value <= 500000) return { exit: 80, fee: 45000 };
            return { exit: 80, fee: 45000 }; // Custom in original, defaulting to max
        } else {
            // Quick Offer scale
            if (value < 150000) return { exit: 52.5, fee: 20000 };
            if (value <= 200000) return { exit: 57.5, fee: 25000 };
            if (value <= 300000) return { exit: 62.5, fee: 30000 };
            if (value <= 400000) return { exit: 67.5, fee: 35000 };
            return { exit: 67.5, fee: 45000 };
        }
    };

    const asIsScale = getAsIsScale(asIsAverage, calculatorMode);
    const [customAsIsExit, setCustomAsIsExit] = useState<number | ''>('');
    const [customAsIsFee, setCustomAsIsFee] = useState<number | ''>('');

    const activeAsIsExitPercent = customAsIsExit !== '' ? Number(customAsIsExit) : asIsScale.exit;
    const activeAsIsFee = customAsIsFee !== '' ? Number(customAsIsFee) : asIsScale.fee;

    const asIsExitPrice = asIsAverage * (activeAsIsExitPercent / 100);
    const asIsMaxBuy = asIsExitPrice - activeAsIsFee;
    const asIsMaxBuyPercent = asIsAverage > 0 ? (asIsMaxBuy / asIsAverage) * 100 : 0;

    // ARV FORMULA
    const [arv, setArv] = useState<number | ''>('');
    const [condition, setCondition] = useState<'Light' | 'Average' | 'Heavy'>('Average');
    const [customRepairCostSqft, setCustomRepairCostSqft] = useState<number | ''>(''); 
    const [arvExitPercent, setArvExitPercent] = useState<number | ''>(70);
    const [arvWholesaleFee, setArvWholesaleFee] = useState<number | ''>(20000);

    const getRepairCostPerSqft = () => {
        if (customRepairCostSqft !== '') return Number(customRepairCostSqft);
        switch (condition) {
            case 'Light': return 10;
            case 'Average': return 25;
            case 'Heavy': return 50;
            default: return 25;
        }
    };

    const calculatedRepairCost = (Number(sqft) || 0) * getRepairCostPerSqft();
    const [manualRepairCost, setManualRepairCost] = useState<number | ''>('');
    
    const activeRepairCost = manualRepairCost !== '' ? Number(manualRepairCost) : calculatedRepairCost;
    const activeArvExitPercent = arvExitPercent !== '' ? Number(arvExitPercent) : 70;
    const activeArvWholesaleFee = arvWholesaleFee !== '' ? Number(arvWholesaleFee) : 20000;

    const arvExitPrice = (Number(arv) || 0) * (activeArvExitPercent / 100) - activeRepairCost;
    const arvMaxBuy = arvExitPrice - activeArvWholesaleFee;
    const arvMaxBuyPercent = Number(arv) > 0 ? (arvMaxBuy / Number(arv)) * 100 : 0;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Calculator className="text-blue-500" size={32} />
                        Deal Analyzer
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Advanced Offer Calculator (As-Is & ARV Formulas)</p>
                </div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setCalculatorMode('Instant')}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${calculatorMode === 'Instant' ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Instant Offer Scale
                    </button>
                    <button 
                        onClick={() => setCalculatorMode('Quick')}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${calculatorMode === 'Quick' ? 'bg-white dark:bg-gray-700 shadow text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Quick Offer Scale
                    </button>
                </div>
            </div>

            {/* Property Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Home size={20} className="text-gray-400"/> Property Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Address</label>
                        <input type="text" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SqFt</label>
                        <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={sqft} onChange={e => setSqft(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 1500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* AS-IS FORMULA */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                            <TrendingUp size={20} />
                            As-Is Formula
                        </h3>
                        <p className="text-xs text-blue-600/80 dark:text-blue-300/80 mt-1">Calculates offer price using As-Is value without estimating repairs.</p>
                    </div>
                    
                    <div className="p-6 space-y-6 flex-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Zillow Value</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pl-8 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={zillow} onChange={e => setZillow(e.target.value ? Number(e.target.value) : '')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Realtor.com Value</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pl-8 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={realtor} onChange={e => setRealtor(e.target.value ? Number(e.target.value) : '')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Redfin Value</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pl-8 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={redfin} onChange={e => setRedfin(e.target.value ? Number(e.target.value) : '')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Other Value</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                                    <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pl-8 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={other} onChange={e => setOther(e.target.value ? Number(e.target.value) : '')} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <span className="font-bold text-gray-700 dark:text-gray-300">Average As-Is Value:</span>
                            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(asIsAverage)}</span>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Percent size={16}/> Exit %</label>
                                <div className="relative w-32">
                                    <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-right pr-8 text-gray-900 dark:text-white" value={customAsIsExit !== '' ? customAsIsExit : asIsScale.exit} onChange={e => setCustomAsIsExit(e.target.value ? Number(e.target.value) : '')} placeholder={String(asIsScale.exit)} />
                                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><DollarSign size={16}/> Wholesale Fee</label>
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                    <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-right text-gray-900 dark:text-white" value={customAsIsFee !== '' ? customAsIsFee : asIsScale.fee} onChange={e => setCustomAsIsFee(e.target.value ? Number(e.target.value) : '')} placeholder={String(asIsScale.fee)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-600 dark:bg-blue-700 p-6 text-white shrink-0">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-blue-100 uppercase tracking-wider font-bold text-sm">As-Is Max Buy</span>
                            <span className="text-blue-200 text-sm">{asIsMaxBuyPercent.toFixed(1)}% of ARV</span>
                        </div>
                        <div className="text-4xl font-bold">{formatCurrency(asIsMaxBuy)}</div>
                        <div className="flex justify-between mt-4 text-sm text-blue-100 border-t border-blue-500/50 pt-3">
                            <span>Exit Price: {formatCurrency(asIsExitPrice)}</span>
                            <span>Profit: {formatCurrency(activeAsIsFee)}</span>
                        </div>
                    </div>
                </div>

                {/* ARV FORMULA */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                            <Wrench size={20} />
                            ARV Formula
                        </h3>
                        <p className="text-xs text-purple-600/80 dark:text-purple-300/80 mt-1">Calculates offer price using After Repair Value and estimated repairs.</p>
                    </div>

                    <div className="p-6 space-y-6 flex-1">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">After Repair Value (ARV)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">$</span>
                                <input type="number" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 pl-8 text-xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" value={arv} onChange={e => setArv(e.target.value ? Number(e.target.value) : '')} placeholder="0" />
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Condition</label>
                                <select className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm text-gray-900 dark:text-white outline-none" value={condition} onChange={e => setCondition(e.target.value as any)}>
                                    <option value="Light">Light ($10/sqft)</option>
                                    <option value="Average">Average ($25/sqft)</option>
                                    <option value="Heavy">Heavy ($50/sqft)</option>
                                </select>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-600 dark:text-gray-400">Custom Cost/Sqft</label>
                                <div className="relative w-24">
                                    <span className="absolute left-2 top-1.5 text-gray-500 text-sm">$</span>
                                    <input type="number" className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-1 pl-6 text-sm text-right text-gray-900 dark:text-white" value={customRepairCostSqft} onChange={e => setCustomRepairCostSqft(e.target.value ? Number(e.target.value) : '')} placeholder={String(getRepairCostPerSqft())} />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                <label className="text-sm font-bold text-gray-900 dark:text-white">Total Repairs</label>
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                    <input type="number" className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 pl-8 text-right font-bold text-gray-900 dark:text-white" value={manualRepairCost !== '' ? manualRepairCost : calculatedRepairCost} onChange={e => setManualRepairCost(e.target.value ? Number(e.target.value) : '')} placeholder={String(calculatedRepairCost)} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Percent size={16}/> Exit %</label>
                                <div className="relative w-32">
                                    <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-right pr-8 text-gray-900 dark:text-white" value={arvExitPercent} onChange={e => setArvExitPercent(e.target.value ? Number(e.target.value) : '')} />
                                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><DollarSign size={16}/> Wholesale Fee</label>
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                    <input type="number" className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-2 text-right text-gray-900 dark:text-white" value={arvWholesaleFee} onChange={e => setArvWholesaleFee(e.target.value ? Number(e.target.value) : '')} />
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="bg-purple-600 dark:bg-purple-700 p-6 text-white shrink-0">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-purple-100 uppercase tracking-wider font-bold text-sm">ARV Max Buy</span>
                            <span className="text-purple-200 text-sm">{arvMaxBuyPercent.toFixed(1)}% of ARV</span>
                        </div>
                        <div className="text-4xl font-bold">{formatCurrency(arvMaxBuy)}</div>
                        <div className="flex justify-between mt-4 text-sm text-purple-100 border-t border-purple-500/50 pt-3">
                            <span>Exit Price: {formatCurrency(arvExitPrice)}</span>
                            <span>Profit: {formatCurrency(activeArvWholesaleFee)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Notes Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Info size={20} className="text-gray-400"/> Notes</h3>
                <textarea 
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                    placeholder="Add any context, links to comps, or details about the seller here..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>
        </div>
    );
};
