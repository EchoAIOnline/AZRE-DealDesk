import re

with open("App.tsx", "r") as f:
    content = f.read()

# Replace tableName logic
content = content.replace("pipelineType === 'jv' ? 'JVDeals' : 'Deals'", "pipelineType === 'dfd' ? 'JVDeals' : 'Deals'")
content = content.replace("isJv ? 'JVDeals' : 'Deals'", "isDfd ? 'JVDeals' : 'Deals'")

# handleAddDeal
handle_add_deal_orig = """      const isJv = location.pathname === '/jv-pipeline';
      const newDealInit: Deal = {
          id: generateId(), 
          pipelineType: isJv ? 'jv' : 'main',"""
handle_add_deal_new = """      const isDfd = location.pathname === '/dfd-scouter';
      const isOffMarket = location.pathname === '/off-market-pipeline';
      const newDealInit: Deal = {
          id: generateId(), 
          pipelineType: isDfd ? 'dfd' : (isOffMarket ? 'off-market' : 'mls'),"""
content = content.replace(handle_add_deal_orig, handle_add_deal_new)

# filter logic
filter_orig = """    if (location.pathname === '/jv-pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'jv');
    } else if (location.pathname === '/pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'main' || !d.pipelineType);
    }"""
filter_new = """    if (location.pathname === '/dfd-scouter') {
        filtered = filtered.filter(d => d.pipelineType === 'dfd');
    } else if (location.pathname === '/off-market-pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'off-market');
    } else if (location.pathname === '/pipeline') {
        filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || d.pipelineType === 'main');
    }"""
content = content.replace(filter_orig, filter_new)

# route for main
route_main_orig = """               <Route path="/pipeline" element={
                 <PipelineView
                    title="Main Pipeline"
                    pipelineType="main"
                    deals={deals}"""
route_main_new = """               <Route path="/pipeline" element={
                 <PipelineView
                    title="MLS Pipeline"
                    pipelineType="mls"
                    deals={deals}"""
content = content.replace(route_main_orig, route_main_new)

# route for jv
route_jv_orig = """               <Route path="/jv-pipeline" element={
                 <PipelineView
                    title="DFD Pipeline"
                    pipelineType="jv"
                    deals={deals}"""
route_jv_new = """               <Route path="/off-market-pipeline" element={
                 <PipelineView
                    title="Off-Market Pipeline"
                    pipelineType="off-market"
                    deals={deals}
                    agents={agents}
                    pipelineSearch={pipelineSearch}
                    setPipelineSearch={setPipelineSearch}
                    pipelineStage={pipelineStage}
                    setPipelineStage={setPipelineStage}
                    onOpenDeal={(d) => { setDealModalZIndex('z-[160]'); setEditingDeal(d); }}
                    onViewAgent={handleViewAgent}
                 />
               } />
               <Route path="/dfd-scouter" element={
                 <PipelineView
                    title="DFD Scouter"
                    pipelineType="dfd"
                    deals={deals}"""
content = content.replace(route_jv_orig, route_jv_new)

# EditingWholesalerDealModal check
modal_orig = "{editingDeal && editingDeal.pipelineType === 'jv' ? ("
modal_new = "{editingDeal && editingDeal.pipelineType === 'dfd' ? ("
content = content.replace(modal_orig, modal_new)

# Calculator route
calc_orig = """<Route path="/calculator" element={<DealAnalyzer onAddDeal={(address, offerPrice) => handleAddDeal({ address, offerPrice, pipelineType: "main" })} />} />"""
calc_new = """<Route path="/calculator" element={<DealAnalyzer onAddDeal={(address, offerPrice) => handleAddDeal({ address, offerPrice, pipelineType: "mls" })} />} />"""
content = content.replace(calc_orig, calc_new)

with open("App.tsx", "w") as f:
    f.write(content)
