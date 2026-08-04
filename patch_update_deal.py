with open("App.tsx", "r") as f:
    content = f.read()

orig = """    const tableName = currentItem.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';
    const saved = await api.save({ ...currentItem, ...updates }, tableName);"""

new = """    const originalTableName = currentItem.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';
    const updatedItem = { ...currentItem, ...updates };
    const tableName = updatedItem.pipelineType === 'dfd' ? 'JVDeals' : 'Deals';
    
    if (originalTableName !== tableName) {
        await api.delete(currentItem.id, originalTableName);
    }
    
    const saved = await api.save(updatedItem, tableName);"""

content = content.replace(orig, new)

with open("App.tsx", "w") as f:
    f.write(content)
