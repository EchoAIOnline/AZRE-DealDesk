with open("App.tsx", "r") as f:
    content = f.read()

content = content.replace("filteredDeals={filteredDeals}", "filteredDeals={getFilteredDeals()}")
content = content.replace("orderedDeals={orderedDeals}", "orderedDeals={getOrderedDeals()}")
content = content.replace("d.pipelineType === 'main'", "false")

with open("App.tsx", "w") as f:
    f.write(content)
