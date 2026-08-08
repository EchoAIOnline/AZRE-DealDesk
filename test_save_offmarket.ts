import { api } from './services/api';
(async () => {
    const dummy = {
        id: 'test-456',
        address: '456 Test St',
        pipelineType: 'off-market',
        offerDecision: 'No Offer Made Yet',
        organization_id: 'test-org-123'
    };
    try {
        const saved = await api.save(dummy, 'Deals');
        console.log("Saved pipelineType:", saved.pipelineType);
    } catch(e) {
        console.error("Save error:", e);
    }
    process.exit(0);
})();
