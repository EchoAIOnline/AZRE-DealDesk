import re

with open("App.tsx", "r") as f:
    content = f.read()

import_line = "import { PipelineView } from './components/Pipeline/PipelineView';\nimport { DFDScouterMap } from './components/DFDScouter/DFDScouterMap';"
content = content.replace("import { PipelineView } from './components/Pipeline/PipelineView';", import_line)

orig_route = """               <Route path="/dfd-scouter" element={
                 <PipelineView
                    title="DFD Scouter"
                    pipelineType="dfd"
                    deals={deals}
                    agents={wholesalers as any}
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
                    filteredDeals={getFilteredDeals()}
                    orderedDeals={getOrderedDeals()}
                    handleDeleteDeal={handleDeleteDeal}
                 />
               } />"""

new_route = """               <Route path="/dfd-scouter" element={
                 <DFDScouterMap handleAddDeal={(overrides) => handleAddDeal(overrides)} globalSearchQuery={globalSearchQuery} />
               } />"""

content = content.replace(orig_route, new_route)

with open("App.tsx", "w") as f:
    f.write(content)
