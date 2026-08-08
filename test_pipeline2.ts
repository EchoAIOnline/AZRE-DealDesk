import { api } from './services/api';
import { POTENTIAL_STATUSES } from './constants';

(async () => {
    let deal = {
        id: 'test-12345',
        address: '123 Test St',
        pipelineType: 'mls',
        offerDecision: 'No Offer Made Yet',
        organization_id: 'test-org'
    };
    
    // Save
    const saved = await api.save(deal, 'Deals');
    console.log("Saved pipelineType:", saved.pipelineType);
    console.log("Saved offerDecision:", saved.offerDecision);
    
    // Filters
    let filtered = [saved];
    filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || false);
    console.log("After pipelineType filter:", filtered.length);
    
    const statusesToShow = POTENTIAL_STATUSES;
    filtered = filtered.filter(d => d && statusesToShow.includes(d.offerDecision));
    console.log("After offerDecision filter:", filtered.length);
    
    process.exit(0);
})();
