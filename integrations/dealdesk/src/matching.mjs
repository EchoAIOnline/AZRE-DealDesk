import { activeStages } from './domain.mjs';
const norm = v => String(v || '').trim().toLowerCase();
const strategy = v => ({'new build':'new construction',reno:'renovation','fix & flip':'renovation',flip:'renovation','buy & hold':'rental',hold:'rental',multifamily:'multi-family'}[norm(v)] || norm(v));
const array = v => Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map(s=>s.trim()) : [];
const numeric = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export function evaluateBuyer(deal,buyer) {
  const matched=[], mismatches=[], missing=[];
  let bb = buyer.buyBox;
  if (typeof bb === 'string') { try { bb=JSON.parse(bb); } catch { bb=null; } }
  if (!bb || typeof bb !== 'object') return {eligible:false,matched,mismatches,missing:['buyBox'],score:0};
  if (buyer.status === 'Deactivated' || buyer.pluginArchivedAt) mismatches.push('Buyer inactive');
  if (!deal.offerDecision) missing.push('offerDecision');
  else if (!activeStages.includes(deal.offerDecision)) mismatches.push('Deal is not in an active pipeline stage');
  const locations = String(bb.locations || '').split(',').map(norm).filter(Boolean);
  const zips = locations.map(s=>s.replace(/^zip(?: code)?:\s*/, '')).filter(s=>/^\d{5}$/.test(s));
  const dealZip = String(deal.address || '').match(/\b\d{5}\b/)?.[0];
  if (!locations.length) missing.push('buyer target locations');
  else if (zips.length) {
    if (!dealZip) missing.push('property ZIP');
    else if (!zips.includes(dealZip)) mismatches.push('ZIP outside buy box');
    else matched.push('Target ZIP');
  } else {
    const candidates = [deal.subMarket,deal.neighborhood,deal.county].map(v=>norm(v).replace(/ county$/,'')).filter(Boolean);
    const targets = locations.map(s=>s.replace(/^(city|county|neighborhood):\s*/,'').replace(/ county$/,''));
    if (!candidates.length) missing.push('property city, neighborhood or county');
    else if (!targets.some(t=>candidates.includes(t))) mismatches.push('Location outside buy box (exact named-area comparison; no geocoding)');
    else matched.push('Target location');
  }
  const wanted=array(bb.propertyTypes).map(strategy), actual=array(deal.dealType).map(strategy);
  if (!wanted.length || !actual.length) missing.push('investment strategy');
  else if (!wanted.some(v=>actual.includes(v))) mismatches.push('Investment strategy');
  else matched.push('Investment strategy');
  const newBuild = actual.length === 1 && actual[0] === 'new construction';
  const price = Number(deal.offerPrice)>0 ? deal.offerPrice : deal.listPrice;
  const arv = newBuild ? deal.newConstructionARV : deal.renovationARV;
  const check=(label,value,min,max,zeroUnknown=false)=>{
    if (!(Number(min)>0 || Number(max)>0)) return;
    if (!numeric(value) || (zeroUnknown && Number(value)<=0)) { missing.push(label); return; }
    if ((Number(min)>0 && Number(value)<Number(min)) || (Number(max)>0 && Number(value)>Number(max))) mismatches.push(label);
    else matched.push(label);
  };
  check('Price',price,bb.minPrice,bb.maxPrice,true);
  check('ARV',arv,bb.minArv,bb.maxArv,true);
  check('Renovation budget',deal.renovationEstimate,undefined,bb.maxRenoBudget);
  if (!newBuild) {
    check('Bedrooms',deal.bedrooms,bb.minBedrooms);
    check('Bathrooms',deal.bathrooms,bb.minBathrooms);
    check('Square feet',deal.sqft,bb.minSqft,bb.maxSqft,true);
    check('Year built',deal.yearBuilt,bb.earliestYearBuilt,bb.latestYearBuilt,true);
  }
  return {eligible:!mismatches.length && !missing.length,matched,mismatches,missing,score:Math.round(100*matched.length/Math.max(1,matched.length+mismatches.length+missing.length)),price_basis:Number(deal.offerPrice)>0?'offerPrice':'listPrice',note:'Screening against recorded criteria, not a buyer commitment. Price excludes any unrecorded assignment fee.'};
}
