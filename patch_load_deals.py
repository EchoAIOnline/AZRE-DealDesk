import re

with open("App.tsx", "r") as f:
    content = f.read()

orig_load = """        const dealsData = await api.load('Deals');
        const jvDealsData = await api.load('JVDeals');
        const allDealsData = deduplicateById([...dealsData, ...jvDealsData]);
        const cleanDeals = allDealsData.map((d: any) => ({
            ...d,
            logs: Array.isArray(d.logs) ? d.logs : [],
            dealType: Array.isArray(d.dealType) ? d.dealType : [],
            offerDecision: d.offerDecision || (['Under Contract', 'Offer Accepted'].includes(d.status) ? 'Deal Under Contract' : 'No Offer Made Yet'),
            inspectionDate: d.inspectionDate ? String(d.inspectionDate).split('T')[0] : null,
            emdDate: d.emdDate ? String(d.emdDate).split('T')[0] : null,
            nextFollowUpDate: d.nextFollowUpDate ? String(d.nextFollowUpDate).split('T')[0] : null,
            lastContactDate: d.lastContactDate ? String(d.lastContactDate).split('T')[0] : null,
            dateListed: d.dateListed ? String(d.dateListed).split('T')[0] : null,
        }));"""

new_load = """        const dealsData = await api.load('Deals');
        const jvDealsData = await api.load('JVDeals');
        const allDealsData = deduplicateById([
            ...dealsData.map((d: any) => ({ ...d, _isJV: false })), 
            ...jvDealsData.map((d: any) => ({ ...d, _isJV: true }))
        ]);
        const cleanDeals = allDealsData.map((d: any) => {
            let pType = d.pipelineType;
            if (d._isJV || pType === 'jv' || pType === 'dfd') {
                pType = 'dfd';
            } else if (d.listingType === 'Off-Market' || pType === 'off-market') {
                pType = 'off-market';
            } else {
                pType = 'mls';
            }
            return {
                ...d,
                pipelineType: pType,
                logs: Array.isArray(d.logs) ? d.logs : [],
                dealType: Array.isArray(d.dealType) ? d.dealType : [],
                offerDecision: d.offerDecision || (['Under Contract', 'Offer Accepted'].includes(d.status) ? 'Deal Under Contract' : 'No Offer Made Yet'),
                inspectionDate: d.inspectionDate ? String(d.inspectionDate).split('T')[0] : null,
                emdDate: d.emdDate ? String(d.emdDate).split('T')[0] : null,
                nextFollowUpDate: d.nextFollowUpDate ? String(d.nextFollowUpDate).split('T')[0] : null,
                lastContactDate: d.lastContactDate ? String(d.lastContactDate).split('T')[0] : null,
                dateListed: d.dateListed ? String(d.dateListed).split('T')[0] : null,
            };
        });"""

content = content.replace(orig_load, new_load)

with open("App.tsx", "w") as f:
    f.write(content)
