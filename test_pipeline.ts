import { api } from './services/api';
import { POTENTIAL_STATUSES } from './constants';

(async () => {
    // 1. Fetch Deals directly like load does
    const deals = await api.load('Deals');
    const validDeals = deals.filter((d:any) => d.id);
    if (validDeals.length === 0) {
         console.log("No deals.");
         process.exit(0);
    }
    
    let deal = validDeals[0];
    console.log("Original Deal:", deal.pipelineType, deal.offerDecision);
    
    // 2. Mock Edit
    const updatedDeal = { ...deal, offerDecision: 'No Offer Made Yet' };
    
    // 3. Save
    const saved = await api.save(updatedDeal, 'Deals');
    console.log("Saved Deal:", saved.pipelineType, saved.offerDecision);
    
    // 4. Filters
    let filtered = [saved];
    filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || false);
    console.log("After pipelineType filter:", filtered.length);
    
    const statusesToShow = POTENTIAL_STATUSES;
    filtered = filtered.filter(d => d && statusesToShow.includes(d.offerDecision));
    console.log("After offerDecision filter:", filtered.length);
    
    process.exit(0);
})();
