with open("components/Pipeline/PipelineView.tsx", "r") as f:
    content = f.read()

content = content.replace("pipelineType?: 'main' | 'jv';", "pipelineType?: 'mls' | 'off-market' | 'dfd';")
content = content.replace("pipelineType = \"main\",", "pipelineType = \"mls\",")
content = content.replace("pipelineType === 'jv'", "pipelineType === 'dfd'")

with open("components/Pipeline/PipelineView.tsx", "w") as f:
    f.write(content)
