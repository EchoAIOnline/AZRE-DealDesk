import os
for file in ["constants.ts", "App.tsx", "components/Pipeline/PipelineView.tsx"]:
    with open(file, "r") as f:
        content = f.read()
    content = content.replace("JV_PIPELINE_STATUSES", "DFD_PIPELINE_STATUSES")
    with open(file, "w") as f:
        f.write(content)
