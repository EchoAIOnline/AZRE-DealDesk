import re

with open('components/Deals/EditDealModal.tsx', 'r') as f:
    content = f.read()

# Replace empty string with null
content = content.replace("lastContactDate: e.target.value", "lastContactDate: e.target.value || null")
content = content.replace("nextFollowUpDate: e.target.value", "nextFollowUpDate: e.target.value || null")
content = content.replace("inspectionDate: e.target.value", "inspectionDate: e.target.value || null")
content = content.replace("emdDate: e.target.value", "emdDate: e.target.value || null")
content = content.replace("dateListed: e.target.value", "dateListed: e.target.value || null")

with open('components/Deals/EditDealModal.tsx', 'w') as f:
    f.write(content)

print("Patch applied to EditDealModal")
