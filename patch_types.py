with open("types.ts", "r") as f:
    content = f.read()

content = content.replace("pipelineType?: 'main' | 'jv';", "pipelineType?: 'mls' | 'off-market' | 'dfd';")

with open("types.ts", "w") as f:
    f.write(content)
