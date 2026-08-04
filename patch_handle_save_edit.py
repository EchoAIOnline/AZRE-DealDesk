with open("App.tsx", "r") as f:
    content = f.read()

orig = """    try {
        const tableName = updatedDeal.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';
        const saved = await api.save(updatedDeal, tableName);
        if (saved) {"""

new = """    try {
        const originalTableName = originalDeal?.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';
        const tableName = updatedDeal.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';

        if (originalDeal && originalTableName !== tableName) {
            await api.delete(originalDeal.id, originalTableName);
        }
        
        const saved = await api.save(updatedDeal, tableName);
        if (saved) {"""

content = content.replace(orig, new)

with open("App.tsx", "w") as f:
    f.write(content)
