
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Send, Save, Image as ImageIcon, Loader2, Sparkles, Mail, User, Settings, CheckSquare, 
    Square, ChevronDown, X, Search, PenTool, Plus, CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { Recipient, api, sendEmail, sendBulkEmailGAS } from '../services/api';
import { Buyer, Agent, Deal, User as UserType, Wholesaler } from '../types';
import { formatCurrency, processPhotoUrl, serverFunctions, getLogTimestamp, generateId } from '../services/utils';
import { EmailEditor, EmailTemplate } from './EmailManager/EmailEditor';
import { StartCampaignButton } from './EmailManager/StartCampaignButton';
import { StartCampaignButtonLog } from '../services/StartCampaignButtonLog';

interface LOIBlastCampaignManagerProps {
    buyers: Buyer[];
    agents: Agent[];
    wholesalers: Wholesaler[];
    deals: Deal[];
    // Updated signature to include fromAddress
    onSendTest: (email: string, subject: string, body: string, templateId?: string, fromAddress?: string) => Promise<void>;
    onCampaignComplete: (campaign: any) => Promise<void>;
    onSaveDraft?: (campaignData: any) => Promise<void>;
    initialData?: any;
    activeTab: 'settings' | 'content';
    onTabChange: (tab: 'settings' | 'content') => void;
}

export const LOIBlastCampaignManager: React.FC<LOIBlastCampaignManagerProps> = ({ 
    buyers = [], agents = [], wholesalers = [], deals = [], 
    onSendTest, onCampaignComplete, onSaveDraft, 
    initialData, activeTab, onTabChange 
}) => {
    // --- 1. STATE ARCHITECTURE ---
    const [campaignData, setCampaignData] = useState({
        id: initialData?.id || generateId(),
        status: initialData?.status || "draft" as "draft" | "scheduled" | "running" | "finished",
        name: initialData?.name || "",
        type: initialData?.type || "loi_blast",
        subject: initialData?.subject || "",
        from_email: initialData?.from_email || "dispo@asharizakargroup.com", // Updated default
        lists: initialData?.lists || [] as string[],
        tags: initialData?.tags || [] as string[],
        send_at: initialData?.send_at || null as string | null,
        content_type: initialData?.content_type || "richtext" as "richtext" | "html" | "markdown" | "plain",
        body: initialData?.body || "<p>Start typing your message here...</p>",
        alt_body: initialData?.alt_body || "",
        template_id: initialData?.template_id || "",
        deliveryLogs: initialData?.deliveryLogs || [] as any[]
    });

    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    // Signature Related States
    const [users, setUsers] = useState<UserType[]>([]);
    const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [signatureTargetUser, setSignatureTargetUser] = useState<UserType | null>(null);
    const [newSignatureText, setNewSignatureText] = useState("");
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // New Integration States
    const [selectedDealId, setSelectedDealId] = useState<string>("");
    const [emailType, setEmailType] = useState<'Agent' | 'Wholesaler' | 'Other'>('Agent');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [propertySearch, setPropertySearch] = useState("");
    const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

    // Progress State for Sending
    const [sendingState, setSendingState] = useState<{
        isSending: boolean;
        total: number;
        sent: number;
        failed: number;
        status: 'idle' | 'sending' | 'completed' | 'error';
    }>({ isSending: false, total: 0, sent: 0, failed: 0, status: 'idle' });

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingRecipients, setPendingRecipients] = useState<Recipient[]>([]);
    
    // Logs Modal State
    const [showLogsModal, setShowLogsModal] = useState(false);

    const selectedDeal = useMemo(() => deals.find(d => d.id === selectedDealId), [deals, selectedDealId]);

    const fetchUsers = async () => {
        try {
            const data = await api.load('Users') as UserType[];
            setUsers(data);
        } catch (e) {
            console.error("Failed to load users", e);
        }
    };

    useEffect(() => {
        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const data = await api.load('EmailTemplates');
                if (Array.isArray(data)) {
                    setTemplates(data as any);
                    if (!campaignData.template_id) {
                        const def = data.find((t: any) => t.is_default);
                        if (def) updateCampaign({ template_id: def.id });
                    }
                } else {
                    setTemplates([]);
                }
            } catch (e) {
                console.error("Failed to load templates", e);
                setTemplates([]);
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        fetchTemplates();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (initialData) {
            setCampaignData({
                id: initialData.id,
                status: initialData.status || "draft",
                name: initialData.name || "",
                type: initialData.type || "loi_blast",
                subject: initialData.subject || "",
                from_email: initialData.from_email || "dispo@asharizakargroup.com",
                lists: initialData.lists || [],
                tags: initialData.tags || [],
                send_at: initialData.send_at || null,
                content_type: initialData.content_type || "richtext",
                body: initialData.body || "",
                alt_body: initialData.alt_body || "",
                template_id: initialData.template_id || "",
                deliveryLogs: initialData.deliveryLogs || []
            });
        }
    }, [initialData]);

    // --- 2. VIEW LOGIC ---
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [isScheduling, setIsScheduling] = useState(!!campaignData.send_at);
    const [isSaving, setIsSaving] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [showTestModal, setShowTestModal] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState<{type: 'success' | 'error', message: string} | null>(null);
     
    // Resolve List IDs to actual Recipients
    const resolveRecipients = (listIds: string[]): Recipient[] => {
        const recipientMap = new Map<string, Recipient>();
        
        listIds.forEach(id => {
            if (!id || typeof id !== 'string') return;

            const parts = id.split(':');
            if (parts.length < 2) return;
            
            const type = parts[0];
            const filter = parts[1];

            // Safety checks for undefined arrays
            let source: any[] = [];
            if (type === 'buyer') source = buyers || [];
            else if (type === 'agent') source = agents || [];
            else if (type === 'wholesaler') source = wholesalers || [];

            let filtered = source;
            
            if (filter !== 'all') {
                if (type === 'buyer') {
                    filtered = source.filter(b => b.status && b.status.includes(filter));
                } else if (type === 'agent') {
                    if (filter === 'contacted') filtered = source.filter(a => a.spokeWithAgent);
                    else if (filter === 'investor_friendly') filtered = source.filter(a => a.investorFriendly);
                    else if (filter === 'agreed_to_send') filtered = source.filter(a => a.agreedToSend);
                    else if (filter === 'closed') filtered = source.filter(a => a.hasClosedDeals);
                } else if (type === 'wholesaler') {
                    filtered = source.filter(w => w.status === filter);
                }
            }

            filtered.forEach(item => {
                if (type === 'buyer') {
                    if ((item as Buyer).subscriptionStatus === 'Unsubscribed') return;
                }

                if (item.email) {
                    if (!item.email) return;
                    const emailKey = (item.email || "").toLowerCase().trim();
                    if (!recipientMap.has(emailKey)) {
                        recipientMap.set(emailKey, {
                            email: emailKey,
                            name: item.name || item.companyName || "there",
                            city: item.city || (item.buyBox?.locations ? item.buyBox.locations.split(',')[0] : "your area")
                        });
                    }
                }
            });
        });

        return Array.from(recipientMap.values());
    };

    const isContentDisabled = useMemo(() => campaignData.lists.length === 0 || !campaignData.subject, [campaignData.lists, campaignData.subject]);

    // --- HELPERS ---
    const updateCampaign = (updates: Partial<typeof campaignData>) => {
        setCampaignData(prev => ({ ...prev, ...updates }));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.trim().replace(/,/g, '');
            if (tag && !campaignData.tags.includes(tag)) {
                updateCampaign({ tags: [...campaignData.tags, tag] });
                setTagInput("");
            }
        }
    };

    const removeTag = (tag: string) => {
        updateCampaign({ tags: campaignData.tags.filter(t => t !== tag) });
    };

    const toggleList = (id: string) => {
        const newLists = campaignData.lists.includes(id) 
            ? campaignData.lists.filter(l => l !== id)
            : [...campaignData.lists, id];
        updateCampaign({ lists: newLists });
    };

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            if (onSaveDraft) {
                await onSaveDraft(campaignData);
                alert("Campaign draft saved to database.");
            }
        } catch (e) {
            alert("Failed to save draft.");
        } finally {
            setIsSaving(false);
        }
    };

    const getFinalEmailBody = () => {
        const selectedTemplate = templates.find(t => t.id === campaignData.template_id);
        const content = campaignData.body || "";
        let fullHtml = content;
        
        if (selectedTemplate && selectedTemplate.html_content) {
             const placeholderRegex = /\{\{\s*(?:Content|template\s+"content"\s*[\.]?)\s*\}\}/g;
             fullHtml = selectedTemplate.html_content.replace(placeholderRegex, content);
        } else {
            fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
        margin: 0; 
        padding: 20px; 
        line-height: 1.6;
    }
    a { color: #2563eb; text-decoration: none; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
        }
        
        const currentYear = new Date().getFullYear().toString();
        
        fullHtml = fullHtml
            .replace(/\{\{\s*now\s*\|\s*date\s*"[^"]+"\s*\}\}/gi, currentYear)
            .replace(/\{\{\s*UnsubscribeURL\s*\}\}/gi, '#')
            .replace(/\{\{\s*MessageURL\s*\}\}/gi, '#')
            .replace(/\{\{\s*L\.T\s+"email\.unsub"\s*\}\}/gi, 'Unsubscribe')
            .replace(/\{\{\s*L\.T\s+"email\.viewInBrowser"\s*\}\}/gi, 'View in browser')
            .replace(/\{\{\s*TrackView\s*\}\}/gi, '');

        return fullHtml;
    };

    const handleStartCampaign = async () => {
        StartCampaignButtonLog.reset();
        StartCampaignButtonLog.add('User Action', 'INFO', 'Start Campaign button clicked');

        try {
            if (campaignData.lists.length === 0) {
                StartCampaignButtonLog.add('Validation Failed', 'ERROR', 'No recipient lists selected');
                alert("Please select at least one recipient list.");
                return;
            }
            if (!campaignData.subject) {
                StartCampaignButtonLog.add('Validation Failed', 'ERROR', 'Missing subject line');
                alert("Please enter a subject line.");
                return;
            }
            if (!campaignData.body) {
                StartCampaignButtonLog.add('Validation Failed', 'ERROR', 'Missing email body content');
                alert("Please enter email content.");
                return;
            }
            
            StartCampaignButtonLog.add('Resolving Recipients', 'INFO', `Resolving from ${campaignData.lists.length} lists`);
            const recipients = resolveRecipients(campaignData.lists);
            if (recipients.length === 0) {
                StartCampaignButtonLog.add('Validation Failed', 'ERROR', 'Lists resolved to 0 valid recipients');
                return alert("Selected lists contain no valid email addresses.");
            }
            StartCampaignButtonLog.add('Recipients Resolved', 'SUCCESS', `Found ${recipients.length} unique recipients`);

            setPendingRecipients(recipients);
            setShowConfirmModal(true);
            StartCampaignButtonLog.add('User Interface', 'INFO', 'Confirmation modal opened');

        } catch (e: any) {
            console.error("Start campaign error:", e);
            StartCampaignButtonLog.add('Critical Error', 'ERROR', e.message || 'Unknown error during preparation');
            alert("Error triggering campaign delivery: " + (e.message || "Unknown Error"));
        }
    };

    const handleCancelConfirmation = () => {
        setShowConfirmModal(false);
        setPendingRecipients([]);
        StartCampaignButtonLog.add('User Action', 'WARNING', 'User cancelled confirmation dialog');
    };

    const executeCampaign = async () => {
        setShowConfirmModal(false);
        const recipients = pendingRecipients;
        const fromAddress = campaignData.from_email; 
        
        StartCampaignButtonLog.add('User Action', 'SUCCESS', 'User confirmed campaign start');
        StartCampaignButtonLog.add('Sender Config', 'INFO', `Sending from: ${fromAddress}`);
        
        setSendingState({
            isSending: true,
            total: recipients.length,
            sent: 0,
            failed: 0,
            status: 'sending'
        });

        // Initialize logs container
        let allLogs: any[] = [];

        try {
            const finalStatus = campaignData.send_at ? "scheduled" : "Sent";
            const finalBody = getFinalEmailBody();
            
            const BATCH_SIZE = 25; // Adjusted for GAS limit saftey
            const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);

            let globalSent = 0;
            let globalFailed = 0;

            for (let i = 0; i < totalBatches; i++) {
                const batch = recipients.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                StartCampaignButtonLog.add('Batch Processing', 'INFO', `Processing Batch ${i + 1}/${totalBatches}`);
                
                // Use new GAS bulk sender
                const result = await sendBulkEmailGAS(batch, campaignData.subject, finalBody, fromAddress);
                
                let batchSent = 0;
                let batchFailed = 0;
                const timestamp = new Date().toISOString();

                if (result && (result.status === 'success' || result.status === 'partial_success')) {
                    batchSent = result.sent_count || 0;
                    batchFailed = result.error_count || 0;
                    
                    // Create Logs
                    const batchLogs = batch.map(r => {
                        // Check if this specific email had an error returned
                        const errObj = result.errors ? result.errors.find((e: any) => e.email === r.email) : null;
                        return {
                            email: r.email,
                            name: r.name,
                            status: errObj ? 'failed' : 'sent',
                            error: errObj ? errObj.error : null,
                            timestamp
                        };
                    });
                    allLogs = [...allLogs, ...batchLogs];

                } else {
                    // Entire batch failed (network/backend error)
                    batchFailed = batch.length;
                    const errorMsg = result?.error || result?.message || "Unknown backend error";
                    const batchLogs = batch.map(r => ({
                        email: r.email,
                        name: r.name,
                        status: 'failed',
                        error: errorMsg,
                        timestamp
                    }));
                    allLogs = [...allLogs, ...batchLogs];
                    StartCampaignButtonLog.add('Batch Error', 'ERROR', `Batch ${i+1} failed: ${errorMsg}`);
                }
                
                globalSent += batchSent;
                globalFailed += batchFailed;

                setSendingState(prev => ({
                    ...prev,
                    sent: prev.sent + batchSent,
                    failed: prev.failed + batchFailed
                }));
            }

            StartCampaignButtonLog.add('Sending Complete', 'SUCCESS', `Sent: ${globalSent}, Failed: ${globalFailed}`);

            setSendingState(prev => ({ ...prev, status: 'completed' }));
            
            // Update local state
            updateCampaign({ 
                status: finalStatus,
                deliveryLogs: allLogs 
            });

            const finalCampaign = {
                ...campaignData,
                status: finalStatus,
                sentAt: new Date().toISOString(),
                recipientCount: recipients.length,
                last_updated: new Date().toISOString(),
                deliveryLogs: allLogs // Save logs to DB
            };

            setTimeout(async () => {
                await onCampaignComplete(finalCampaign);
                StartCampaignButtonLog.add('Finished', 'SUCCESS', 'Campaign completed and saved');
            }, 1500);
        } catch (e: any) {
            console.error("Execute campaign error:", e);
            StartCampaignButtonLog.add('Critical Error', 'ERROR', e.message || 'Unknown error during execution');
            setSendingState(prev => ({ ...prev, status: 'error' }));
            alert("Error executing campaign: " + (e.message || "Unknown Error"));
        }
    };

    const handleSendPreview = async () => {
        setTestEmailResult(null);
        const targetEmail = testEmail.trim();
        if (!targetEmail) {
            setTestEmailResult({type: 'error', message: "Please enter a target email address."});
            return;
        }
        setIsSendingTest(true);
        
        const finalBody = getFinalEmailBody();
        const fromAddress = campaignData.from_email; // Capture the sender

        try {
            // Test send via GAS to ensure same path
            await sendBulkEmailGAS(
                [{ email: targetEmail, name: "Test User" }], 
                campaignData.subject, 
                finalBody, 
                fromAddress
            );
            setTestEmailResult({type: 'success', message: `Test email sent to ${targetEmail} from ${fromAddress}`});
            setTimeout(() => {
                setShowTestModal(false);
                setTestEmailResult(null);
            }, 3000);
        } catch (e: any) {
            console.error(e);
            setTestEmailResult({type: 'error', message: "Test send failed: " + (e.message || "Unknown error")});
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleGenerateEmailWithAI = async () => {
        alert("Google API usage is disabled for this feature.");
        return;
    };

    const handleGenerateSubjectAI = async () => {
        alert("Google API usage is disabled for this feature.");
        return;
    };

    const handleInsertPhotos = async () => {
        if (!selectedDeal) {
            alert("Please select a property first.");
            return;
        }

        const mainPhoto = (selectedDeal.photos && selectedDeal.photos.length > 0) 
            ? processPhotoUrl(selectedDeal.photos[0]) 
            : null;
        
        let photoBlockHtml = "";

        if (mainPhoto) {
            photoBlockHtml += `<div style="text-align:center; margin-bottom:5px;">
                <img src="${mainPhoto}" style="max-width:100%; height:auto; border-radius:12px;" alt="Property Main View" />
            </div>`;
        }

        try {
            const res = await serverFunctions.getFolderUrl(selectedDeal.address);
            if (res && res.url) {
                photoBlockHtml += `<p style="text-align:center; margin-top:0px; margin-bottom:20px; font-family: sans-serif;">
                    <a href="${res.url}" target="_blank" style="display:inline-block; background-color:#3b82f6; color:#ffffff !important; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">
                        Click Here To View Photos of the Property
                    </a>
                </p>`;
            }
        } catch (e) {
            console.error("Failed to get folder URL", e);
        }

        const newBody = photoBlockHtml + campaignData.body;
        updateCampaign({ body: newBody });
    };

    const handleApplySignature = (user: UserType) => {
        if (!user.signature) {
            alert("No signature found for " + user.name + ". Please add one first.");
            return;
        }
        const signatureHtml = user.signature.replace(/\n/g, '<br/>');
        const newBody = campaignData.body + '<br/><br/>' + signatureHtml;
        updateCampaign({ body: newBody });
        setShowSignatureDropdown(false);
    };

    const handleSaveSignature = async () => {
        if (!signatureTargetUser || !newSignatureText.trim()) return;
        setIsSavingSignature(true);
        try {
            const updatedUser = { ...signatureTargetUser, signature: newSignatureText };
            await api.save(updatedUser, 'Users');
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            setShowSignatureModal(false);
            setSignatureTargetUser(null);
            setNewSignatureText("");
            alert("Signature updated successfully.");
        } catch (e) {
            alert("Failed to save signature.");
        } finally {
            setIsSavingSignature(false);
        }
    };

    const filteredDeals = useMemo(() => 
        deals.filter(d => (d.address || "").toLowerCase().includes((propertySearch || "").toLowerCase())),
    [deals, propertySearch]);

    // Construct List Groups for Dropdown (Same as before)
    const listGroups = [
        {
            label: "Agent Database",
            items: [
                { id: 'agent:all', name: 'All Agents', count: (agents || []).length },
                { id: 'agent:contacted', name: 'Contacted Already', count: (agents || []).filter(a => a.spokeWithAgent).length },
                { id: 'agent:investor_friendly', name: 'Investor Friendly', count: (agents || []).filter(a => a.investorFriendly).length },
                { id: 'agent:agreed_to_send', name: 'Agreed to Send', count: (agents || []).filter(a => a.agreedToSend).length },
                { id: 'agent:closed', name: 'Closed With AZRE', count: (agents || []).filter(a => a.hasClosedDeals).length },
            ]
        },
        {
            label: "Wholesaler Database",
            items: [
                { id: 'wholesaler:all', name: 'All Wholesalers', count: (wholesalers || []).length },
                { id: 'wholesaler:New', name: 'New Leads', count: (wholesalers || []).filter(w => w.status === 'New').length },
                { id: 'wholesaler:Vetted', name: 'Vetted', count: (wholesalers || []).filter(w => w.status === 'Vetted').length },
                { id: 'wholesaler:JV Partner', name: 'JV Partners', count: (wholesalers || []).filter(w => w.status === 'JV Partner').length },
            ]
        }
    ];

    const getSelectedListNames = () => {
        const selectedNames: string[] = [];
        listGroups.forEach(group => {
            group.items.forEach(item => {
                if (campaignData.lists.includes(item.id)) {
                    selectedNames.push(item.name);
                }
            });
        });
        return selectedNames;
    };

    const selectedCount = getSelectedListNames().length;
    const progressPercent = sendingState.total > 0 ? Math.round((sendingState.sent / sendingState.total) * 100) : 0;

    return (
        <div className="flex flex-col h-full w-full bg-[#0f172a] text-gray-200 animate-in fade-in duration-300">
            {/* ACTION BAR */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e293b] shrink-0 z-[100] relative">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-2 rounded-lg">
                        <Mail className="text-blue-500" size={20} />
                    </div>
                    <div>
                        <h1 className="text-white font-bold tracking-tight text-sm">Campaigns / {campaignData.name || "New Campaign"}</h1>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                campaignData.status === 'draft' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                campaignData.status === 'running' ? 'bg-green-600/20 text-green-400 border-green-500/20' :
                                'bg-blue-600/20 text-blue-400 border-blue-500/20'
                            }`}>
                                {campaignData.status}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">ID: {campaignData.id}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {(campaignData.status === 'Sent' || campaignData.status === 'finished') && (
                        <button 
                            type="button"
                            onClick={() => setShowLogsModal(true)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 rounded-lg hover:bg-slate-800"
                        >
                            <FileText size={14} /> View Logs
                        </button>
                    )}
                    <button 
                        type="button"
                        onClick={() => setShowTestModal(true)}
                        className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 rounded-lg hover:bg-slate-800"
                    >
                        <Sparkles size={14} /> Send Test
                    </button>
                    <button 
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 rounded-lg hover:bg-slate-800"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Draft
                    </button>
                    {campaignData.status !== 'Sent' && campaignData.status !== 'finished' && (
                        <StartCampaignButton onClick={handleStartCampaign} isSending={sendingState.isSending} />
                    )}
                </div>
            </header>

            {/* SENDING OVERLAY MODAL */}
            {sendingState.isSending && (
                <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-8 shadow-2xl flex flex-col items-center text-center">
                        {sendingState.status === 'completed' ? (
                            <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle size={40} className="text-green-500" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Campaign Successfully Sent!</h2>
                                <p className="text-slate-400 text-sm mb-6">
                                    {sendingState.failed > 0 
                                        ? `Completed with ${sendingState.failed} errors.` 
                                        : `All ${sendingState.total} emails dispatched successfully.`}
                                </p>
                                <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                                    <div className="bg-green-500 h-2 rounded-full w-full transition-all duration-500"></div>
                                </div>
                                <span className="text-green-500 font-bold text-xs">Redirecting to Dashboard...</span>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center">
                                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 relative">
                                    <Loader2 size={40} className="text-blue-500 animate-spin absolute" />
                                    <Send size={20} className="text-blue-400/50" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Sending Campaign...</h2>
                                <p className="text-slate-400 text-sm mb-8">Please keep this window open while we blast your list.</p>
                                
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                                        <span>Progress</span>
                                        <span>{progressPercent}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
                                        <div 
                                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                                            style={{ width: `${progressPercent}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-center mt-2 flex justify-between text-xs font-mono">
                                        <span className="text-green-400">Sent: {sendingState.sent}</span>
                                        <span className="text-red-400">Failed: {sendingState.failed}</span>
                                        <span className="text-slate-400">Total: {sendingState.total}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CUSTOM CONFIRMATION MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={handleCancelConfirmation}>
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500">
                                <Send size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Confirm Campaign</h3>
                                <p className="text-slate-400 text-sm">Ready to blast this email?</p>
                            </div>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 mb-6 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Recipients:</span>
                                <span className="text-white font-mono font-bold">{pendingRecipients.length.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subject:</span>
                                <span className="text-white font-bold truncate max-w-[200px]" title={campaignData.subject}>{campaignData.subject}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">From:</span>
                                <span className="text-blue-400 font-bold truncate max-w-[200px]">{campaignData.from_email}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleCancelConfirmation}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeCampaign}
                                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-7000 font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Send size={16} /> Send Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELIVERY LOGS MODAL */}
            {showLogsModal && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowLogsModal(false)}>
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#1e293b]">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText size={20} className="text-blue-500" /> Delivery Logs
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">Detailed status for {campaignData.deliveryLogs?.length || 0} recipients</p>
                            </div>
                            <button onClick={() => setShowLogsModal(false)} className="text-gray-400 hover:text-white p-2 hover:bg-slate-800 rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-[#0f172a] p-0 custom-scrollbar">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#1e293b] text-[10px] font-black uppercase tracking-widest text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3">Timestamp</th>
                                        <th className="px-6 py-3">Email</th>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {campaignData.deliveryLogs && campaignData.deliveryLogs.length > 0 ? (
                                        campaignData.deliveryLogs.map((log: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-3 font-mono text-xs text-slate-500">
                                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-white">{log.email}</td>
                                                <td className="px-6 py-3 text-slate-400">{log.name || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        log.status === 'sent' 
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-xs text-red-400 font-mono">
                                                    {log.error || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">No logs recorded for this campaign.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0f172a] p-6">
                <div className={`max-w-screen-2xl mx-auto flex flex-col ${activeTab === 'content' ? 'h-full' : 'min-h-0'}`}>
                    
                    {activeTab === 'settings' ? (
                        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300 pb-24">
                            {/* Property Selection Toolbar */}
                            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row items-end gap-4 shadow-lg">
                                <div className="flex-1 min-w-0 w-full relative">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1.5 block">Select Property from Pipeline</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 pl-9 pr-4 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                                            placeholder="Find Property in Pipeline..."
                                            value={propertySearch}
                                            onChange={(e) => { setPropertySearch(e.target.value); setShowPropertyDropdown(true); }}
                                            onFocus={() => setShowPropertyDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowPropertyDropdown(false), 200)}
                                        />
                                        {selectedDeal && (
                                            <button 
                                                onClick={() => { setSelectedDealId(""); setPropertySearch(""); }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {showPropertyDropdown && filteredDeals.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[70] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                                            {filteredDeals.map(d => (
                                                <button
                                                    key={d.id}
                                                    onClick={() => {
                                                        setSelectedDealId(d.id);
                                                        setPropertySearch(d.address);
                                                        setShowPropertyDropdown(false);
                                                        if (!campaignData.name) updateCampaign({ name: d.address });
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group"
                                                >
                                                    <div className="text-xs font-bold text-white group-hover:text-blue-400">{d.address}</div>
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                                        <span className="font-mono">{formatCurrency(d.listPrice)}</span>
                                                        <span>•</span>
                                                        <span className="uppercase">{d.offerDecision}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={handleGenerateSubjectAI}
                                    disabled={!selectedDealId || isGeneratingAI}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-tight shadow-xl flex items-center gap-2 transition-all h-[42px]"
                                >
                                    {isGeneratingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    GENERATE SUBJECT LINE
                                </button>
                            </div>

                            {/* Standard Fields */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Internal Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all font-medium"
                                    placeholder="e.g. 2024 Q4 Wholesale Blast"
                                    value={campaignData.name}
                                    onChange={(e) => updateCampaign({ name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Subject Line</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all font-medium"
                                    placeholder="Email subject..."
                                    value={campaignData.subject}
                                    onChange={(e) => updateCampaign({ subject: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">From Address</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all font-medium"
                                        value={campaignData.from_email}
                                        onChange={(e) => updateCampaign({ from_email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Tags</label>
                                    <div className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-1.5 flex flex-wrap gap-1.5 min-h-[46px] focus-within:border-blue-500 transition-all">
                                        {campaignData.tags.map(tag => (
                                            <span key={tag} className="bg-blue-600/10 text-blue-400 px-2 py-1 rounded text-[10px] font-bold border border-blue-500/20 flex items-center gap-1.5">
                                                {tag}
                                                <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={12}/></button>
                                            </span>
                                        ))}
                                        <input 
                                            type="text" 
                                            className="bg-transparent border-none outline-none text-white text-sm px-2 flex-1 min-w-[100px]"
                                            placeholder="Add tag..."
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={handleTagKeyDown}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 relative">
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Recipient Lists</label>
                                <button 
                                    onClick={() => setIsListDropdownOpen(!isListDropdownOpen)}
                                    className={`w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-left flex justify-between items-center transition-all ${isListDropdownOpen ? 'border-blue-500 shadow-lg' : ''}`}
                                >
                                    <div className="flex gap-2 items-center overflow-hidden">
                                        {selectedCount === 0 ? (
                                            <span className="text-slate-500 text-sm">Select lists...</span>
                                        ) : (
                                            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-black uppercase">
                                                {selectedCount} {selectedCount === 1 ? 'List' : 'Lists'} Selected
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-400 truncate">
                                            {getSelectedListNames().join(', ')}
                                        </span>
                                    </div>
                                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${isListDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                                </button>
                                
                                {isListDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[90]" onClick={() => setIsListDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[95] animate-in fade-in slide-in-from-top-2 duration-200 max-h-80 overflow-y-auto custom-scrollbar">
                                            {listGroups.map((group, groupIdx) => (
                                                <div key={groupIdx} className="border-b border-white/5 last:border-0">
                                                    <div className="px-3 py-2 bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 backdrop-blur-sm">
                                                        {group.label}
                                                    </div>
                                                    <div className="p-1">
                                                        {group.items.map((list) => (
                                                            <button 
                                                                key={list.id}
                                                                onClick={() => toggleList(list.id)}
                                                                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {campaignData.lists.includes(list.id) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-slate-600 group-hover:text-slate-400" />}
                                                                    <span className={`text-xs font-bold ${campaignData.lists.includes(list.id) ? 'text-white' : 'text-slate-300'}`}>{list.name}</span>
                                                                </div>
                                                                <span className="text-[10px] font-mono text-slate-600 bg-black/20 px-1.5 py-0.5 rounded">{list.count}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Content Type</label>
                                    <select 
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-all font-medium appearance-none"
                                        value={campaignData.content_type}
                                        onChange={(e) => updateCampaign({ content_type: e.target.value as any })}
                                    >
                                        <option value="richtext">Rich Text</option>
                                        <option value="html">Raw HTML</option>
                                        <option value="markdown">Markdown</option>
                                        <option value="plain">Plain Text</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] uppercase font-black tracking-widest text-slate-500">Send Later</label>
                                        <button 
                                            onClick={() => {
                                                const newState = !isScheduling;
                                                setIsScheduling(newState);
                                                if (!newState) updateCampaign({ send_at: null });
                                                else if (!campaignData.send_at) updateCampaign({ send_at: new Date().toISOString() });
                                            }}
                                            className={`w-10 h-5 rounded-full transition-all relative border border-slate-700 ${isScheduling ? 'bg-blue-600' : 'bg-slate-800'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${isScheduling ? 'left-5.5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <div className={`transition-all duration-300 ${isScheduling ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-30 pointer-events-none translate-y-2'}`}>
                                        <input 
                                            type="datetime-local" 
                                            className="w-full bg-[#1e293b] border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                            value={campaignData.send_at ? campaignData.send_at.slice(0, 16) : ""}
                                            onChange={(e) => updateCampaign({ send_at: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-4 animate-in slide-in-from-right-4 duration-300 flex-1 min-h-0">
                            
                            {/* SUBJECT BANNER */}
                            <div className="bg-[#1e293b] border border-slate-800 rounded-xl px-6 py-3 flex items-center justify-between shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600/20 p-2 rounded-lg"><Mail size={16} className="text-blue-500" /></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">EDITING BODY FOR:</span>
                                        <span className="text-sm text-slate-200 font-bold leading-none truncate max-w-lg">{campaignData.subject || "No Subject Set"}</span>
                                    </div>
                                </div>
                                <button onClick={() => onTabChange('settings')} className="text-[10px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-colors flex items-center gap-2 border border-slate-800 rounded-lg px-3 py-1.5">
                                    <Settings size={12} /> EDIT SETUP
                                </button>
                            </div>

                            {/* INTEGRATION TOOLBAR */}
                            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-3 flex flex-wrap items-center gap-4 shadow-lg">
                                {/* Property Search Box */}
                                <div className="flex-1 min-w-[280px] relative">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                        <input 
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 pl-9 pr-4 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                                            placeholder="Find Property in Pipeline..."
                                            value={propertySearch}
                                            onChange={(e) => { setPropertySearch(e.target.value); setShowPropertyDropdown(true); }}
                                            onFocus={() => setShowPropertyDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowPropertyDropdown(false), 200)}
                                        />
                                        {selectedDeal && (
                                            <button 
                                                onClick={() => { setSelectedDealId(""); setPropertySearch(""); }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {showPropertyDropdown && filteredDeals.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[70] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                                            {filteredDeals.map(d => (
                                                <button
                                                    key={d.id}
                                                    onClick={() => {
                                                        setSelectedDealId(d.id);
                                                        setPropertySearch(d.address);
                                                        setShowPropertyDropdown(false);
                                                        if (!campaignData.name) updateCampaign({ name: d.address });
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group"
                                                >
                                                    <div className="text-xs font-bold text-white group-hover:text-blue-400">{d.address}</div>
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                                        <span className="font-mono">{formatCurrency(d.listPrice)}</span>
                                                        <span>•</span>
                                                        <span className="uppercase">{d.offerDecision}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Email Type Selection */}
                                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
                                    {(['Agent', 'Wholesaler', 'Other'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setEmailType(type)}
                                            className={`px-3 py-1.5 rounded text-[10px] font-black uppercase transition-all ${
                                                emailType === type 
                                                ? 'bg-blue-600 text-white shadow-lg' 
                                                : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                {/* AI Button */}
                                <button 
                                    onClick={handleGenerateEmailWithAI}
                                    disabled={isGeneratingAI || !selectedDealId}
                                    className="px-4 py-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-lg text-xs font-black flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                    GENERATE EMAIL WITH AI
                                </button>

                                {/* Insert Photos Button */}
                                <button 
                                    onClick={handleInsertPhotos}
                                    disabled={!selectedDealId}
                                    className="px-4 py-2 bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/20 rounded-lg text-xs font-black flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ImageIcon size={14} /> INSERT PROPERTY PHOTOS
                                </button>

                                {/* Signature Dropdown */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowSignatureDropdown(!showSignatureDropdown)}
                                        className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 rounded-lg text-xs font-black flex items-center gap-2 transition-all shadow-sm"
                                    >
                                        <PenTool size={14} className="text-blue-500" /> SIGNATURES <ChevronDown size={12} className={`transition-transform ${showSignatureDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showSignatureDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-[55]" onClick={() => setShowSignatureDropdown(false)}></div>
                                            <div className="absolute top-full right-0 mt-2 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[80] p-2 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[200px]">
                                                {users.length > 0 ? users.map(user => (
                                                    <button 
                                                        key={user.id}
                                                        onClick={() => handleApplySignature(user)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-lg border-b border-white/5 last:border-0 transition-colors flex items-center justify-between group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                                                                {user.photo ? <img src={user.photo} className="w-full h-full object-cover" /> : <User size={12} className="text-slate-500" />}
                                                            </div>
                                                            <span className="text-xs font-bold text-white group-hover:text-blue-400">{user.name}</span>
                                                        </div>
                                                        <PenTool size={12} className="text-slate-600 group-hover:text-blue-500" />
                                                    </button>
                                                )) : (
                                                    <div className="px-4 py-3 text-xs text-slate-500 italic">No users found.</div>
                                                )}
                                                <button 
                                                    onClick={() => { setShowSignatureModal(true); setShowSignatureDropdown(false); }}
                                                    className="w-full text-left px-4 py-3 mt-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all text-xs font-black uppercase flex items-center gap-2"
                                                >
                                                    <Plus size={14} /> Add / Edit Signature
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* EMAIL EDITOR */}
                            <EmailEditor 
                                content={campaignData.body}
                                onChange={(val) => updateCampaign({ body: val })}
                                contentType={campaignData.content_type}
                                onContentTypeChange={(val) => updateCampaign({ content_type: val })}
                                templateId={campaignData.template_id}
                                onTemplateIdChange={(val) => updateCampaign({ template_id: val })}
                                templates={templates}
                                isLoadingTemplates={isLoadingTemplates}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* SIGNATURE MODAL */}
            {showSignatureModal && (
                <div className="fixed inset-0 bg-black/80 z-[160] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowSignatureModal(false)}>
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><PenTool size={20} className="text-blue-500"/> Manage User Signatures</h3>
                            <button onClick={() => setShowSignatureModal(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5 block">Select User</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer"
                                    value={signatureTargetUser?.id || ""}
                                    onChange={(e) => {
                                        const user = users.find(u => u.id === e.target.value);
                                        setSignatureTargetUser(user || null);
                                        setNewSignatureText(user?.signature || "");
                                    }}
                                >
                                    <option value="">Choose User...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5 block">Signature Content (Multi-line)</label>
                                <textarea 
                                    className="w-full h-40 bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-blue-500 outline-none resize-none placeholder:text-slate-600"
                                    placeholder="Thanks,&#10;Ashari Zakar&#10;AZRE Team"
                                    value={newSignatureText}
                                    onChange={(e) => setNewSignatureText(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
                            <button onClick={() => setShowSignatureModal(false)} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs">Cancel</button>
                            <button 
                                onClick={handleSaveSignature}
                                disabled={isSavingSignature || !signatureTargetUser}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2 rounded-xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center gap-2"
                            >
                                {isSavingSignature ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                SAVE SIGNATURE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TEST EMAIL MODAL */}
            {showTestModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-[#1e293b] border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles size={20} className="text-blue-500"/> Send Test Message</h3>
                            <button onClick={() => setShowTestModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1.5 block">Target Email</label>
                                <input 
                                    type="email" 
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                    placeholder="your-email@domain.com"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                />
                            </div>
                            {testEmailResult && (
                                <div className={`p-3 rounded-lg text-sm ${testEmailResult.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                    {testEmailResult.message}
                                </div>
                            )}
                            <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleSendPreview(); }}
                                disabled={isSendingTest || !testEmail}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-black text-sm shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
                            >
                                {isSendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {isSendingTest ? 'Sending...' : 'Send Preview'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
