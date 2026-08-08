import { api } from './services/api';
(async () => {
    const originalDeals = [{
        id: 'test-12345',
        address: '123 Test St',
        pipelineType: 'mls',
        offerDecision: 'No Offer Made Yet',
        organization_id: 'test-org'
    }];
    
    const dealToSave = { ...originalDeals[0], offerPrice: 10000 };
    
    // Save
    const saved = await api.save(dealToSave, 'Deals');
    
    // setDeals logic
    const exists = originalDeals.some(d => d.id === dealToSave.id);
    let newDeals;
    if (exists) newDeals = originalDeals.map(d => d.id === dealToSave.id ? saved : d);
    else newDeals = [saved, ...originalDeals];
    
    console.log("New Deals length:", newDeals.length);
    console.log("First deal id:", newDeals[0].id);
    console.log("First deal pipelineType:", newDeals[0].pipelineType);
    console.log("First deal offerDecision:", newDeals[0].offerDecision);
    process.exit(0);
})();
