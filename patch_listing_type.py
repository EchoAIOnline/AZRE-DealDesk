with open("components/Deals/EditDealModal.tsx", "r") as f:
    content = f.read()

orig_onchange = "onChange={e => { updateDealState({listingType: e.target.value}); if(onUpdate) onUpdate(deal.id, {listingType: e.target.value}); triggerSave(); }}"
new_onchange = """onChange={e => { 
    const val = e.target.value;
    let newPipelineType = deal.pipelineType;
    if (val === 'Listed On MLS') newPipelineType = 'mls';
    if (val === 'Off-Market') newPipelineType = 'off-market';
    updateDealState({listingType: val, pipelineType: newPipelineType}); 
    if(onUpdate) onUpdate(deal.id, {listingType: val, pipelineType: newPipelineType}); 
    triggerSave(); 
}}"""

content = content.replace(orig_onchange, new_onchange)

with open("components/Deals/EditDealModal.tsx", "w") as f:
    f.write(content)
