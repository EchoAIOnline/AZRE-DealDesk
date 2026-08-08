import { api } from './services/api';
(async () => {
    const dummy = {
        id: 'test-123',
        address: '123 Test St',
        pipelineType: 'mls',
        offerDecision: 'No Offer Made Yet',
        organization_id: 'test-org-123'
    };
    try {
        const saved = await api.save(dummy, 'Deals');
        console.log("Saved deal:", saved);
    } catch(e) {
        console.error("Save error:", e);
    }
    process.exit(0);
})();
