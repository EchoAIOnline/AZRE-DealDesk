import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('Deals').select('*');
  const jv = await supabase.from('JVDeals').select('*');
  
  let combined = [...data.map(d => ({...d, _isJV: false})), ...(jv.data || []).map(d => ({...d, _isJV: true}))];
  const map = new Map();
  combined.forEach(item => map.set(item.id, item));
  const deduped = Array.from(map.values());
  
  let cleanDeals = deduped.map(d => {
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
                offerDecision: d.offerDecision || (['Under Contract', 'Offer Accepted'].includes(d.status) ? 'Deal Under Contract' : 'No Offer Made Yet'),
            };
  });
  
  let mlsDeals = cleanDeals.filter(d => d.pipelineType === 'mls' || !d.pipelineType);
  
  const POTENTIAL_STATUSES = [ 'No Offer Made Yet', 'Seller Counter-Offered', 'Monitoring Pending Status Before Offer', 'Requires A Buyers Agent', 'Made Verbal Offer On Property', 'Made Written Offer On Property', 'Monitoring Pending Status After Offer', 'Monitoring Offer After Seller Declined', 'Analyzing' ];
  const UNDER_CONTRACT_STATUSES = [ 'Seller Accepted Offer', 'Agent Sending Contract', 'Deal Under Contract' ];
  const DECLINED_STATUSES = [ 'Listing Removed - Now Off Market', 'Offer Declined', 'Offer Declined and Sold', 'Sold To Another Investor', 'Deal Canceled', 'Priced Too High To Buy', 'No Longer Interested In Buying', 'Declined', 'Deal No Longer Available' ];
  const CLOSED_STATUSES = [ 'Deal Successfully Closed' ];
  const OFFER_DECISIONS = [...POTENTIAL_STATUSES, ...UNDER_CONTRACT_STATUSES, ...DECLINED_STATUSES, ...CLOSED_STATUSES];

  let missingDeals = mlsDeals.filter(d => !OFFER_DECISIONS.includes(d.offerDecision));
  console.log(`Total MLS deals: ${mlsDeals.length}`);
  console.log(`Missing from tabs: ${missingDeals.length}`);
  for (let m of missingDeals) {
      console.log(`ID: ${m.id}, Address: ${m.address}, offerDecision: ${m.offerDecision}`);
  }
}
run();
