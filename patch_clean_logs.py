with open("App.tsx", "r") as f:
    content = f.read()

content = content.replace("""const getFilteredDeals = () => {
    console.log("deals inside getFilteredDeals:", deals.length);""", "const getFilteredDeals = () => {")
content = content.replace("""filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || false);
console.log("after mls filter:", filtered.length);""", "filtered = filtered.filter(d => d.pipelineType === 'mls' || !d.pipelineType || false);")
content = content.replace("""filtered = filtered.filter(d => d.pipelineType === 'off-market');
console.log("after off-market filter:", filtered.length);""", "filtered = filtered.filter(d => d.pipelineType === 'off-market');")

with open("App.tsx", "w") as f:
    f.write(content)
