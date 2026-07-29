import fs from 'fs';
let code = fs.readFileSync('components/DealAnalyzer/DealAnalyzer.tsx', 'utf8');

code = code.replace("Info, Tool } from 'lucide-react';", "Info, Wrench } from 'lucide-react';");
code = code.replace("<Tool size={20} />", "<Wrench size={20} />");

fs.writeFileSync('components/DealAnalyzer/DealAnalyzer.tsx', code);
