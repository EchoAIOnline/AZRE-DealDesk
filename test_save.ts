import { api } from './services/api';
(async () => {
    const deals = await api.load('Deals');
    if (deals.length === 0) { console.log('No deals found'); process.exit(0); }
    const deal = deals[0];
    console.log('Original deal offerDecision:', deal.offerDecision, 'pipelineType:', deal.pipelineType);
    
    // Simulate edit
    const updated = { ...deal, listPrice: deal.listPrice ? deal.listPrice + 1 : 10000 };
    const saved = await api.save(updated, 'Deals');
    
    console.log('Saved deal offerDecision:', saved.offerDecision, 'pipelineType:', saved.pipelineType);
    console.log('Saved matches original?', saved.offerDecision === deal.offerDecision && saved.pipelineType === deal.pipelineType);
    
    // Find missing fields
    const missing = [];
    for (const key in updated) {
        if (!(key in saved) || saved[key] !== updated[key]) {
            missing.push({ key, updated: updated[key], saved: saved[key] });
        }
    }
    console.log('Fields in updated that are missing/different in saved:', missing);
    process.exit(0);
})();
