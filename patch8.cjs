const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

// Update imports
code = code.replace(
    /File as FileIcon \} from 'lucide-react';/,
    "File as FileIcon, Download, ExternalLink } from 'lucide-react';"
);

// Helper function
const helperFn = `
const getPreviewUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com/uc?')) {
        const idMatch = url.match(/id=([^&]+)/);
        if (idMatch) {
            return \`https://drive.google.com/file/d/\${idMatch[1]}/preview\`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        return url.replace(/\\/view.*$/, '/preview');
    }
    
    if (url.includes('/preview')) return url;

    return \`https://docs.google.com/gview?url=\${encodeURIComponent(url)}&embedded=true\`;
};
`;

// Inject helper function right before the component export
code = code.replace(
    /export const EditDealModal:/,
    `${helperFn}\nexport const EditDealModal:`
);

// Update the modal
const oldModalStr = `
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-6xl w-full flex flex-col h-[90vh] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">{previewDocument.name}</h3>
                        <div className="flex items-center gap-3">
                            <a href={previewDocument.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                                Open in New Tab
                            </a>
                            <button onClick={() => setPreviewDocument(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2">
                                <X size={20}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-800 rounded-b-xl">
                        <iframe 
                            src={previewDocument.url.includes('drive.google.com/file/d/') ? previewDocument.url.replace(/\\/view.*$/, '/preview') : previewDocument.url} 
                            className="w-full h-full border-0" 
                            title="Document Preview"
                            allow="autoplay"
                        ></iframe>
                    </div>
                </div>
`;

const newModalStr = `
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-6xl w-full flex flex-col h-[90vh] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">{previewDocument.name}</h3>
                        <div className="flex items-center gap-3">
                            <a href={previewDocument.url} download target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md flex items-center gap-1.5 transition-colors">
                                <Download size={16} />
                                Download
                            </a>
                            <a href={previewDocument.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md flex items-center gap-1.5 transition-colors">
                                <ExternalLink size={16} />
                                Open
                            </a>
                            <button onClick={() => setPreviewDocument(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 ml-2 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative bg-gray-100 dark:bg-gray-800 rounded-b-xl">
                        <iframe 
                            src={getPreviewUrl(previewDocument.url)} 
                            className="w-full h-full border-0" 
                            title="Document Preview"
                            allow="autoplay"
                        ></iframe>
                    </div>
                </div>
`;

code = code.replace(oldModalStr, newModalStr);
fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
