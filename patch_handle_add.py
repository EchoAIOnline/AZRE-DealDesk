import re

with open("App.tsx", "r") as f:
    content = f.read()

orig_code = """      const isDfd = location.pathname === '/dfd-scouter';
      const isOffMarket = location.pathname === '/off-market-pipeline';
      const newDealInit: Deal = {"""

new_code = """      let isDfd = location.pathname === '/dfd-scouter';
      let isOffMarket = location.pathname === '/off-market-pipeline';
      if (overrides && overrides.pipelineType) {
          isDfd = overrides.pipelineType === 'dfd';
          isOffMarket = overrides.pipelineType === 'off-market';
      }
      const newDealInit: Deal = {"""

content = content.replace(orig_code, new_code)

with open("App.tsx", "w") as f:
    f.write(content)
