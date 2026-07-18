const fs = require('fs');
let code = fs.readFileSync('components/Deals/EditDealModal.tsx', 'utf8');

code = code.replace(
    'const [showBuyerMatch, setShowBuyerMatch] = useState(false);',
    'const [showBuyerMatch, setShowBuyerMatch] = useState(false);\n    const [previewDocument, setPreviewDocument] = useState<{name: string, url: string} | null>(null);'
);

code = code.replace(
    /<a href=\{doc\.url\} target="_blank" rel="noopener noreferrer" className="text-red-700 dark:text-\[#4ADE80\] font-medium text-\[14px\] hover:underline truncate block">\{doc\.name\}<\/a>/g,
    `<button type="button" onClick={() => setPreviewDocument(doc)} className="text-red-700 dark:text-[#4ADE80] font-medium text-[14px] hover:underline truncate block text-left">\{doc.name\}</button>`
);

code = code.replace(
    /<a href=\{doc\.url\} target="_blank" rel="noopener noreferrer" className="text-green-700 dark:text-\[#4ADE80\] font-medium text-\[14px\] hover:underline truncate block">\{doc\.name\}<\/a>/g,
    `<button type="button" onClick={() => setPreviewDocument(doc)} className="text-green-700 dark:text-[#4ADE80] font-medium text-[14px] hover:underline truncate block text-left">\{doc.name\}</button>`
);

code = code.replace(
    /<a href=\{doc\.url\} target="_blank" rel="noopener noreferrer" className="text-gray-700 dark:text-gray-300 font-medium text-\[13px\] hover:text-gray-900 dark:hover:text-white truncate block max-w-\[300px\]">\{doc\.name\}<\/a>/g,
    `<button type="button" onClick={() => setPreviewDocument(doc)} className="text-gray-700 dark:text-gray-300 font-medium text-[13px] hover:text-gray-900 dark:hover:text-white truncate block max-w-[300px] text-left">\{doc.name\}</button>`
);

const modalHtml = `
        {previewDocument && (
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm z-[9999]" onClick={() => setPreviewDocument(null)}>
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
            </div>
        )}
        </div>
    );
}
`;

code = code.replace(/        <\/div>\n    \);\n\}/, modalHtml);

fs.writeFileSync('components/Deals/EditDealModal.tsx', code);
