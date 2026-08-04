import re

with open('components/Deals/EditDealModal.tsx', 'r') as f:
    content = f.read()

# Replace setHasUnsavedChanges with triggerSave
content = content.replace("setHasUnsavedChanges(true);", "triggerSave();")

with open('components/Deals/EditDealModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied to EditDealModal")
