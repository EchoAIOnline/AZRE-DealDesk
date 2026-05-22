import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

// Import constants
const POTENTIAL_STATUSES = [
  'No Offer Made Yet', 
  'Monitoring Pending Status Before Offer', 
  'Requires A Buyers Agent', 
  'Made Verbal Offer On Property', 
  'Made Written Offer On Property', 
  'Seller Counter-Offered', 
  'Monitoring Pending Status After Offer', 
  'Monitoring Offer After Seller Declined', 
  'Agent Responded To Offer',
  'Analyzing' 
];

const UNDER_CONTRACT_STATUSES = [
  'Seller Accepted Offer', 
  'Agent Sending Contract', 
  'Deal Under Contract'
];

const COUNTER_STATUSES = [
  'Seller Counter-Offered'
];

const DECLINED_STATUSES = [
  'Listing Removed - Now Off Market', 
  'Offer Declined', 
  'Offer Declined and Sold', 
  'Sold To Another Investor', 
  'Deal Canceled', 
  'Priced Too High To Buy', 
  'No Longer Interested In Property',
  'Declined' 
];

const CLOSED_STATUSES = [
  'Deal Successfully Closed',
  'Closed - Sold'
];

const OFFER_DECISIONS = [
    ...POTENTIAL_STATUSES,
    ...UNDER_CONTRACT_STATUSES,
    ...DECLINED_STATUSES,
    ...CLOSED_STATUSES
];


async function run() {
  const { data: dealsData, error } = await supabase.from('Deals').select('*');
  if (error) {
    console.error("Load deals error:", error.message);
    return;
  }
  
  const cleanDeals = dealsData.map((d: any) => ({
      ...d,
      offerDecision: d.offerDecision || (['Under Contract', 'Offer Accepted'].includes(d.status) ? 'Deal Under Contract' : 'No Offer Made Yet'),
  }));

  // Find 1008 State
  const stateDeal = cleanDeals.find((d: any) => d.address && d.address.includes('1008 State'));
  if (!stateDeal) {
    console.log("State St deal not found in clean list!");
    return;
  }
  
  console.log("=== 1008 State St NW properties ===");
  console.log("Address:", stateDeal.address);
  console.log("pipelineType:", stateDeal.pipelineType);
  console.log("offerDecision:", stateDeal.offerDecision);
  console.log("status:", stateDeal.status);
  
  // Simulation: getFilteredDeals
  // Assuming path is `/pipeline` (Main Pipeline)
  const isJvPipeline = false;
  let filtered = [...cleanDeals];
  if (isJvPipeline) {
      filtered = filtered.filter(d => d.pipelineType === 'jv');
  } else {
      filtered = filtered.filter(d => d.pipelineType === 'main' || !d.pipelineType);
  }
  
  const stateInFilteredBeforeSearch = filtered.some((d: any) => d.id === stateDeal.id);
  console.log("Is State St deal in filtered deals (Main Pipeline) before search?", stateInFilteredBeforeSearch);
  
  // Now apply search query "State St"
  const activeSearch = "State St";
  const query = activeSearch.toLowerCase().trim();
  filtered = filtered.filter(d => ( (d.address && String(d.address).toLowerCase().includes(query)) || (d.mls && String(d.mls).toLowerCase().includes(query)) || (d.agentName && String(d.agentName).toLowerCase().includes(query)) ));
  
  const stateInFilteredAfterSearch = filtered.some((d: any) => d.id === stateDeal.id);
  console.log("Is State St deal in filtered deals after search 'State St'?", stateInFilteredAfterSearch);
  console.log("Total filtered count after search:", filtered.length);
  if (filtered.length > 0) {
    console.log("First filtered deal address:", filtered[0].address);
    console.log("First filtered deal offerDecision:", filtered[0].offerDecision);
  }

  // Now check getOrderedDeals for 'All Deals'
  const statusesToShow = OFFER_DECISIONS;
  console.log("OFFER_DECISIONS contains 'Closed - Sold'?", OFFER_DECISIONS.includes('Closed - Sold'));
  console.log("Is deal.offerDecision ('" + filtered[0]?.offerDecision + "') in OFFER_DECISIONS?", statusesToShow.includes(filtered[0]?.offerDecision));
  
  const ordered = filtered.filter(d => statusesToShow.includes(d.offerDecision));
  console.log("Total ordered count:", ordered.length);
}

run();
