import React, { useState } from 'react';
import { X, ExternalLink, Globe } from 'lucide-react';

interface WebEmbedModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WebEmbedModal: React.FC<WebEmbedModalProps> = ({ isOpen, onClose }) => {
    const [url, setUrl] = useState('');
    const [iframeUrl, setIframeUrl] = useState('');

    if (!isOpen) return null;

    const handleLoad = (e: React.FormEvent) => {
        e.preventDefault();
        let finalUrl = url.trim();
        if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        setIframeUrl(finalUrl);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-5xl h-[80vh] border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Globe className="text-blue-500" size={20} />
                        Embedded Website Viewer
                    </h3>
                    <div className="flex items-center gap-4">
                        <form onSubmit={handleLoad} className="flex items-center gap-2">
                            <input 
                                type="text" 
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="Enter URL (e.g. https://google.com)"
                                className="w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                Load
                            </button>
                        </form>
                        {iframeUrl && (
                            <a href={iframeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 transition-colors" title="Open in new tab">
                                <ExternalLink size={20} />
                            </a>
                        )}
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-950 relative">
                    {!iframeUrl ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
                            <Globe size={48} className="mb-4 opacity-50" />
                            <p>Enter a URL above to load a website.</p>
                            <p className="text-xs mt-2 opacity-75">Note: Some websites block being embedded in iframes.</p>
                        </div>
                    ) : (
                        <iframe 
                            src={iframeUrl} 
                            className="w-full h-full border-none"
                            title="Embedded Website"
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
