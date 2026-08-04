with open("App.tsx", "r") as f:
    content = f.read()

orig = """               <Route path="/off-market-pipeline" element={
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
               } />"""

new = """               <Route path="/off-market-pipeline" element={
                 <PipelineView
                    title="Off-Market Pipeline"
                    pipelineType="off-market"
                    deals={deals}
                    agents={agents}
                    pipelineSearch={pipelineSearch}
                    setPipelineSearch={setPipelineSearch}
                    pipelineStage={pipelineStage}
                    setPipelineStage={setPipelineStage}
                    pipelineSort={pipelineSort}
                    setPipelineSort={setPipelineSort}
                    showFilterMenu={showFilterMenu}
                    setShowFilterMenu={setShowFilterMenu}
                    filterConfig={filterConfig}
                    setFilterConfig={setFilterConfig}
                    agentFilterSearch={agentFilterSearch}
                    setAgentFilterSearch={setAgentFilterSearch}
                    showAgentFilterSuggestions={showAgentFilterSuggestions}
                    setShowAgentFilterSuggestions={setShowAgentFilterSuggestions}
                    handleAddDeal={handleAddDeal}
                    updateDeal={updateDeal}
                    setDealModalZIndex={setDealModalZIndex}
                    setEditingDeal={setEditingDeal}
                    filteredDeals={filteredDeals}
                    orderedDeals={orderedDeals}
                    handleDeleteDeal={handleDeleteDeal}
                 />
               } />"""

content = content.replace(orig, new)

# Also fix the isJv errors
content = content.replace("isJv ?", "isDfd ?")

with open("App.tsx", "w") as f:
    f.write(content)
