
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Bold, Italic, List, CheckCircle, Loader2, 
    Undo, Redo, Underline, AlignLeft, AlignCenter, AlignRight, 
    FileText, HelpCircle, Eye, Columns, Layout, MapPin, User, X
} from 'lucide-react';

export interface EmailTemplate {
    id: string;
    name: string;
    html_content: string;
    is_default: boolean;
}

interface EmailEditorProps {
    content: string;
    onChange: (content: string) => void;
    contentType: string;
    onContentTypeChange: (type: any) => void;
    templateId: string;
    onTemplateIdChange: (id: string) => void;
    templates: EmailTemplate[];
    isLoadingTemplates: boolean;
}

export const EmailEditor: React.FC<EmailEditorProps> = ({
    content,
    onChange,
    contentType,
    onContentTypeChange,
    templateId,
    onTemplateIdChange,
    templates,
    isLoadingTemplates
}) => {
    const [isSplitView, setIsSplitView] = useState(false);
    const [isHTMLSource, setIsHTMLSource] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    
    // Iframe Editor Ref
    const editorIframeRef = useRef<HTMLIFrameElement>(null);
    const isTypingRef = useRef(false);

    const wordCount = useMemo(() => {
        const text = (content || '').replace(/<[^>]*>/g, '').trim();
        return text ? text.split(/\s+/).length : 0;
    }, [content]);

    // --- HELPER: Get Full HTML for Preview ---
    const getFullPreviewHtml = () => {
        const selectedTemplate = templates.find(t => t.id === templateId);
        const bodyContent = content || '<p>&nbsp;</p>';
        if (!selectedTemplate) return bodyContent;
        
        const placeholderRegex = /\{\{\s*(?:Content|template\s+"content"\s*[\.]?)\s*\}\}/g;
        return selectedTemplate.html_content.replace(placeholderRegex, bodyContent);
    };

    // --- EDITOR COMMANDS (IFRAME AWARE) ---
    const execCommand = (command: string, value: string = '') => {
        const iframe = editorIframeRef.current;
        if (iframe && iframe.contentDocument) {
            iframe.contentDocument.execCommand(command, false, value);
            // Sync back to React state immediately
            const newContent = iframe.contentDocument.getElementById('email-editor-content')?.innerHTML;
            if (newContent !== undefined) {
                isTypingRef.current = true;
                onChange(newContent);
                setTimeout(() => { isTypingRef.current = false; }, 100);
            }
        }
    };

    const insertPersonalization = (syntax: string) => {
        const iframe = editorIframeRef.current;
        if (iframe && iframe.contentDocument) {
            const doc = iframe.contentDocument;
            const selection = doc.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const span = doc.createElement('span');
                span.style.color = '#3b82f6';
                span.style.fontWeight = 'bold';
                span.innerHTML = syntax;
                range.insertNode(span);
                range.setStartAfter(span);
                range.setEndAfter(span);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // Fallback append
                const editableDiv = doc.getElementById('email-editor-content');
                if (editableDiv) editableDiv.innerHTML += ` <span style="color:#3b82f6;font-weight:bold">${syntax}</span>`;
            }
            
            // Sync
            const newContent = doc.getElementById('email-editor-content')?.innerHTML;
            if (newContent) onChange(newContent);
        }
    };

    // --- IFRAME INITIALIZATION & SYNC ---
    useEffect(() => {
        const iframe = editorIframeRef.current;
        if (!iframe) return;

        const initEditor = () => {
            const doc = iframe.contentDocument;
            if (!doc) return;

            const selectedTemplate = templates.find(t => t.id === templateId);
            let fullHtml = "";

            // Construct the Full HTML Page
            if (selectedTemplate) {
                const placeholderRegex = /\{\{\s*(?:Content|template\s+"content"\s*[\.]?)\s*\}\}/g;
                // We wrap the body content in a special div ID so we can find it
                const wrappedBody = `<div id="email-editor-content" style="outline: none; min-height: 200px;">${content}</div>`;
                fullHtml = selectedTemplate.html_content.replace(placeholderRegex, wrappedBody);
            } else {
                // No Template: Just basic HTML shell
                fullHtml = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: 'Inter', sans-serif; background-color: #ffffff; margin: 20px; color: #0f172a; }
                                #email-editor-content { min-height: 400px; }
                            </style>
                        </head>
                        <body>
                            <div id="email-editor-content" style="outline: none;">${content}</div>
                        </body>
                    </html>
                `;
            }
            
            // Inject the same Color Scheme meta tags to the Editor Iframe to match "Sent" email
            const colorSchemeMeta = `
            <meta name="color-scheme" content="light">
            <style>
              :root { color-scheme: light; }
              body { background-color: #ffffff !important; color: #0f172a !important; }
            </style>`;
            
            if (fullHtml.includes('</head>')) {
                fullHtml = fullHtml.replace('</head>', `${colorSchemeMeta}</head>`);
            } else {
                fullHtml = `<head>${colorSchemeMeta}</head>` + fullHtml;
            }

            // Write to Iframe
            doc.open();
            doc.write(fullHtml);
            doc.close();

            // Set up Editing
            const editableDiv = doc.getElementById('email-editor-content');
            if (editableDiv) {
                editableDiv.contentEditable = "true";
                
                // Add styling to show it's editable when focused
                const style = doc.createElement('style');
                style.innerHTML = `
                    #email-editor-content:focus { outline: 2px solid #3b82f6; border-radius: 4px; padding: 4px; }
                    #email-editor-content { cursor: text; }
                    /* Ensure images don't overflow in editor */
                    img { max-width: 100%; height: auto; }
                `;
                doc.head.appendChild(style);

                // Bind Input Event for Sync
                const handleInput = () => {
                    isTypingRef.current = true;
                    onChange(editableDiv.innerHTML);
                    // Reset typing flag after short delay
                    setTimeout(() => { isTypingRef.current = false; }, 100);
                };

                editableDiv.addEventListener('input', handleInput);
            }
        };

        // Re-initialize only when template changes radically
        initEditor();

    }, [templateId, templates]); // Intentionally omitting content to avoid full re-renders on typing

    // --- EXTERNAL UPDATES (AI, etc) ---
    // If body changes from outside (not typing), update the iframe
    useEffect(() => {
        if (isTypingRef.current) return; // Ignore updates from self-typing

        const iframe = editorIframeRef.current;
        if (iframe && iframe.contentDocument) {
            const editableDiv = iframe.contentDocument.getElementById('email-editor-content');
            if (editableDiv && editableDiv.innerHTML !== content) {
                editableDiv.innerHTML = content;
            }
        }
    }, [content]);

    return (
        <>
            <div className="bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden group focus-within:ring-1 focus-within:ring-blue-500/50 flex-1 min-h-[600px] text-slate-900">
                
                <div className="bg-[#1e293b] border-b border-slate-700 p-2 px-4 flex items-center justify-between shrink-0">
                    {/* ... Editor Toolbar ... */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">FORMAT:</span>
                            <select 
                                className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded focus:outline-none"
                                value={contentType}
                                onChange={(e) => onContentTypeChange(e.target.value)}
                            >
                                <option value="richtext">Rich Text</option>
                                <option value="html">Raw HTML</option>
                                <option value="markdown">Markdown</option>
                                <option value="plain">Plain Text</option>
                            </select>
                        </div>
                        <div className="h-4 w-px bg-slate-700"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TEMPLATE:</span>
                            <select 
                                className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded focus:outline-none"
                                value={templateId}
                                onChange={(e) => onTemplateIdChange(e.target.value)}
                            >
                                <option value="">No Template (Body Only)</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {isLoadingTemplates && <Loader2 size={10} className="animate-spin text-blue-500" />}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsSplitView(!isSplitView)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black transition-all ${isSplitView ? 'bg-blue-600 text-gray-900 dark:text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-gray-900 dark:text-white'}`}
                            title="Live Editing Preview"
                        >
                            <Columns size={12} /> SPLIT VIEW
                        </button>
                        <button 
                            onClick={() => setShowPreviewModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-gray-900 dark:text-white rounded text-[10px] font-black transition-all"
                        >
                            <Eye size={12} /> LIVE PREVIEW
                        </button>
                    </div>
                </div>

                <div className="bg-[#1e293b] border-b border-slate-700 px-4 py-1 flex gap-4 text-[10px] font-bold text-slate-400 shrink-0">
                    {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Table', 'Help'].map(menu => (
                        <button key={menu} className="hover:text-slate-100 px-1 py-0.5 rounded transition-colors uppercase tracking-wider">{menu}</button>
                    ))}
                </div>

                <div className="bg-slate-900/50 border-b border-slate-700 p-2 px-4 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                    <button onClick={() => execCommand('undo')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Undo"><Undo size={16}/></button>
                    <button onClick={() => execCommand('redo')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Redo"><Redo size={16}/></button>
                    <div className="w-px h-5 bg-slate-700 mx-1.5"></div>
                    <select 
                        className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded focus:outline-none cursor-pointer hover:bg-slate-800"
                        onChange={(e) => {
                            if(e.target.value) execCommand('fontName', e.target.value);
                            e.target.value = "";
                        }}
                        title="Font Family"
                    >
                        <option value="" disabled selected>Font</option>
                        <option value="Inter, sans-serif">Inter</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="Courier New, monospace">Courier</option>
                    </select>
                    <select 
                        className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded focus:outline-none cursor-pointer hover:bg-slate-800"
                        onChange={(e) => {
                            if(e.target.value) execCommand('fontSize', e.target.value);
                            e.target.value = "";
                        }}
                        title="Font Size"
                    >
                        <option value="" disabled selected>Size</option>
                        <option value="1">Small</option>
                        <option value="2">Medium</option>
                        <option value="3">Normal</option>
                        <option value="4">Large</option>
                        <option value="5">X-Large</option>
                        <option value="6">XX-Large</option>
                        <option value="7">Huge</option>
                    </select>
                    <div className="w-px h-5 bg-slate-700 mx-1.5"></div>
                    <button onClick={() => execCommand('bold')} className="p-1.5 text-slate-100 hover:bg-slate-700 rounded transition-colors" title="Bold"><Bold size={16}/></button>
                    <button onClick={() => execCommand('italic')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Italic"><Italic size={16}/></button>
                    <button onClick={() => execCommand('underline')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Underline"><Underline size={16}/></button>
                    <div className="w-px h-5 bg-slate-700 mx-1.5"></div>
                    <button onClick={() => execCommand('justifyLeft')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Align Left"><AlignLeft size={16}/></button>
                    <button onClick={() => execCommand('justifyCenter')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Align Center"><AlignCenter size={16}/></button>
                    <button onClick={(e) => execCommand('justifyRight')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="Align Right"><AlignRight size={16}/></button>
                    <div className="w-px h-5 bg-slate-700 mx-1.5"></div>
                    <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 text-slate-400 hover:text-gray-900 dark:text-white hover:bg-slate-800 rounded transition-colors" title="List"><List size={16}/></button>
                    <div className="flex-1"></div>
                    <div className="flex gap-1.5">
                        <button onClick={() => insertPersonalization('{{Name}}')} className="px-2 py-1 bg-slate-900 border border-slate-700 text-blue-400 text-[9px] font-black rounded hover:bg-blue-600 hover:text-gray-900 dark:text-white transition-all flex items-center gap-1"><User size={10}/> FIRST NAME</button>
                        <button onClick={() => insertPersonalization('{{City}}')} className="px-2 py-1 bg-slate-900 border border-slate-700 text-purple-400 text-[9px] font-black rounded hover:bg-purple-600 hover:text-gray-900 dark:text-white transition-all flex items-center gap-1"><MapPin size={10}/> CITY</button>
                        <button onClick={() => insertPersonalization('{{UnsubscribeURL}}')} className="px-2 py-1 bg-slate-900 border border-slate-700 text-red-400 text-[9px] font-black rounded hover:bg-red-600 hover:text-gray-900 dark:text-white transition-all flex items-center gap-1"><X size={10}/> UNSUBSCRIBE</button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative bg-[#0f172a] overflow-hidden">
                    <div className={`flex flex-1 min-h-0 ${isSplitView ? 'flex-row' : 'flex-col'}`}>
                        
                        {/* EDITOR CANVAS - IFRAME IMPLEMENTATION */}
                        <div className={`flex flex-col transition-all duration-300 relative overflow-y-auto custom-scrollbar ${isSplitView ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                            <div className="min-h-full p-8 flex justify-center bg-[#0f172a]">
                                {/* WHITE PAGE CONTAINER FOR EDITOR - RESTORED CARD EFFECT */}
                                <div className={`w-full max-w-4xl bg-white shadow-xl block min-h-[1100px] flex flex-col overflow-hidden relative mx-auto`}>
                                    {isHTMLSource ? (
                                        <textarea 
                                            className="w-full flex-1 p-10 font-mono text-sm bg-slate-950 text-green-400 outline-none resize-none min-h-[1100px]"
                                            value={content}
                                            onChange={(e) => onChange(e.target.value)}
                                        />
                                    ) : (
                                        <iframe 
                                            ref={editorIframeRef}
                                            title="Email Editor Canvas"
                                            className="w-full h-full min-h-[1100px] border-none"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {isSplitView && (
                            <div className="w-1/2 flex flex-col animate-in fade-in slide-in-from-right-2 duration-300 overflow-hidden bg-white border-l border-slate-200">
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Layout size={10} className="text-blue-500" /> ACCURATE LIVE RENDERING
                                    </span>
                                </div>
                                <div className="flex-1 overflow-hidden bg-white">
                                    <iframe 
                                        title="Live Preview Pane"
                                        srcDoc={getFullPreviewHtml()}
                                        className="w-full h-full border-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-[#1e293b] border-t border-slate-700 px-4 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-500 tracking-widest uppercase shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><FileText size={10} className="text-slate-600" /> {wordCount} WORDS</span>
                        <span className="flex items-center gap-1.5"><CheckCircle size={10} className="text-green-500" /> DRAFT AUTO-SAVED</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsHTMLSource(!isHTMLSource)} className={`hover:text-slate-300 ${isHTMLSource ? 'text-blue-400' : ''}`}>HTML SOURCE</button>
                        <div className="h-3 w-px bg-slate-700"></div>
                        <button className="flex items-center gap-1 hover:text-slate-300"><HelpCircle size={10}/> HELP</button>
                    </div>
                </div>
            </div>

            {/* LIVE PREVIEW MODAL */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowPreviewModal(false)}>
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Campaign Preview</h3>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-widest">
                                        TEMPLATE: {templates.find(t => t.id === templateId)?.name.toUpperCase() || 'NONE (BODY ONLY)'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 bg-white overflow-hidden p-0">
                            <iframe 
                                title="Campaign Preview Content"
                                srcDoc={getFullPreviewHtml()}
                                className="w-full h-full border-none"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end">
                            <button 
                                onClick={() => setShowPreviewModal(false)}
                                className="px-12 py-3 rounded-xl bg-blue-600 hover:bg-blue-50 text-gray-900 dark:text-white font-black shadow-xl active:scale-95 transition-all text-sm uppercase tracking-wider"
                            >
                                Back to Editor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
