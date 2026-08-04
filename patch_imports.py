with open("App.tsx", "r") as f:
    content = f.read()

content = content.replace("import { DFDScouterMap } from './components/DFDScouter/DFDScouterMap';\nimport { DFDScouterMap } from './components/DFDScouter/DFDScouterMap';", "import { DFDScouterMap } from './components/DFDScouter/DFDScouterMap';")

with open("App.tsx", "w") as f:
    f.write(content)
