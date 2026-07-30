const fs = require('fs');

// Patch Dashboard.tsx
let dashboard = fs.readFileSync('components/Dashboard/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace(
    'onMove: (id: string, decision: string) => void;',
    'onMove: (id: string, decision: string) => void;\n    onAddDeal: () => void;'
);
dashboard = dashboard.replace(
    'export const Dashboard: React.FC<DashboardProps> = ({ currentUser, deals, agents, buyers, onEdit, onUpdate, onDelete, onMove }) => {',
    'export const Dashboard: React.FC<DashboardProps> = ({ currentUser, deals, agents, buyers, onEdit, onUpdate, onDelete, onMove, onAddDeal }) => {'
);
dashboard = dashboard.replace(
    '<button onClick={() => navigate(\'/pipeline\')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">',
    '<button onClick={() => { onAddDeal(); navigate(\'/pipeline\'); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">'
);
fs.writeFileSync('components/Dashboard/Dashboard.tsx', dashboard);

// Patch App.tsx
let app = fs.readFileSync('App.tsx', 'utf8');
app = app.replace(
    'onMove={handlePipelineMove}',
    'onMove={handlePipelineMove}\n                    onAddDeal={handleAddDeal}'
);
fs.writeFileSync('App.tsx', app);
