import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

import { Search, Filter, MessageSquare, Mail, Phone, Video, Star, Trash2, Paperclip, Send, ChevronDown, User, Tag, Plus, CheckSquare, Edit, Maximize2, MoreHorizontal, Settings, HelpCircle, FileText, X, ExternalLink, AlertCircle, MapPin, Loader2, Home, RefreshCw } from 'lucide-react';
import { InboxMessage } from '../../types';

export const Inbox: React.FC<{ title?: string, initialMessages?: InboxMessage[] }> = ({ title = "Conversations", initialMessages = [] }) => {
  const { deals } = useAppStore();
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [msConnected, setMsConnected] = useState(false);
  const [isFetchingMs, setIsFetchingMs] = useState(false);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [showPlainText, setShowPlainText] = useState(false);
  const [composerTab, setComposerTab] = useState<'SMS' | 'Email'>('SMS');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [sendFeedback, setSendFeedback] = useState('');
  const msAuthWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    // Check initial connection status
    fetch('/api/auth/microsoft/status')
      .then(res => res.json())
      .then(data => {
        if (data.connected) {
          setMsConnected(true);
        }
      })
      .catch(console.error);

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setMsConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectMs = async () => {
    try {
      const res = await fetch('/api/auth/microsoft/url');
      const data = await res.json();
      msAuthWindowRef.current = window.open(data.url, 'ms_auth', 'width=600,height=700');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (msConnected) {
      fetchMsEmails();
    }
  }, [msConnected]);

  const fetchMsEmails = async () => {
    setIsFetchingMs(true);
    try {
      const res = await fetch('/api/emails/acquisitions');
      if (res.status === 401) {
        setMsConnected(false);
        setIsFetchingMs(false);
        return;
      }
      const data = await res.json();
      
      // Filter emails based on deal addresses
      const dealAddresses = deals.map(d => d.address?.toLowerCase()).filter(Boolean) as string[];
      
      if (data && data.value) {
        const matchingEmails: InboxMessage[] = [];
        data.value.forEach((email: any) => {
          const bodyPreview = (email.bodyPreview || '').toLowerCase();
          const subject = (email.subject || '').toLowerCase();
          const bodyContent = (email.body?.content || '').toLowerCase();
          
          let matches = false;
          let matchedAddress = '';
          for (const address of dealAddresses) {
            const firstPart = address.split(',')[0].trim();
            if (firstPart.length > 3 && (bodyPreview.includes(firstPart) || subject.includes(firstPart) || bodyContent.includes(firstPart))) {
              matches = true;
              matchedAddress = address;
              break;
            }
          }

          if (matches) {
            const toRecipients = Array.isArray(email.toRecipients)
              ? email.toRecipients.map((r: any) => ({
                  name: r.emailAddress?.name,
                  address: r.emailAddress?.address,
                }))
              : [];

            matchingEmails.push({
              id: email.id,
              contactName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
              contactEmail: email.from?.emailAddress?.address || '',
              contactPhone: '',
              propertyAddress: matchedAddress,
              subject: email.subject || 'No Subject',
              lastMessage: email.subject || email.bodyPreview || 'No Subject',
              timestamp: new Date(email.receivedDateTime).toLocaleString(),
              unread: email.isRead === false,
              type: 'Email',
              direction: 'inbound',
              body: email.body?.content || email.bodyPreview || '',
              bodyType: email.body?.contentType?.toLowerCase() === 'html' ? 'html' : 'text',
              bodyPreview: email.bodyPreview || '',
              toRecipients,
              msEmailData: email
            });
          }
        });

        if (matchingEmails.length > 0) {
          setMessages(prev => {
            const newIds = new Set(matchingEmails.map(m => m.id));
            const filteredPrev = prev.filter(p => !newIds.has(p.id));
            return [...matchingEmails, ...filteredPrev];
          });

          // If current selection is default mock message or null, pick first synced email
          setSelectedMessage(prev => {
            if (!prev || prev.id.startsWith('msg-') || prev.id.startsWith('disp-')) {
              setComposerTab('Email');
              return matchingEmails[0];
            }
            const found = matchingEmails.find(m => m.id === prev.id);
            return found || prev;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMs(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(initialMessages.length > 0 ? initialMessages[0] : null);
  const [channelFilter, setChannelFilter] = useState<'Unread' | 'All' | 'Recent' | 'Starred'>('Unread');

  const handleSelectMessage = async (msg: InboxMessage) => {
    setSelectedMessage(msg);
    setComposerTab(msg.type === 'Email' ? 'Email' : 'SMS');
    setSendFeedback('');

    // If it's an email without full body, fetch it dynamically
    if (msg.type === 'Email' && !msg.body && msg.id && !msg.id.startsWith('msg-')) {
      setIsLoadingBody(true);
      try {
        const res = await fetch(`/api/emails/${encodeURIComponent(msg.id)}`);
        if (res.ok) {
          const detail = await res.json();
          const updatedMsg: InboxMessage = {
            ...msg,
            body: detail.body?.content || detail.bodyPreview || '',
            bodyType: detail.body?.contentType?.toLowerCase() === 'html' ? 'html' : 'text',
            bodyPreview: detail.bodyPreview || msg.bodyPreview || '',
            msEmailData: detail
          };
          setSelectedMessage(updatedMsg);
          setMessages(prev => prev.map(m => m.id === msg.id ? updatedMsg : m));
        }
      } catch (err) {
        console.error('Error fetching email body:', err);
      } finally {
        setIsLoadingBody(false);
      }
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedMessage) return;

    if (composerTab === 'Email') {
      if (!selectedMessage.contactEmail) {
        setSendFeedback('No recipient email available.');
        return;
      }

      setIsSendingReply(true);
      setSendFeedback('');
      try {
        const subject = selectedMessage.subject 
          ? (selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`)
          : `Re: ${selectedMessage.propertyAddress || 'Property Inquiry'}`;

        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_bulk_email',
            data: {
              recipients: [{ email: selectedMessage.contactEmail }],
              subject,
              body: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.5;">${replyText.replace(/\n/g, '<br/>')}</div>`,
              fromAddress: 'acquisitions@dealdesk.com'
            }
          })
        });

        if (res.ok) {
          setSendFeedback('Email sent successfully!');
          setReplyText('');
          setTimeout(() => setSendFeedback(''), 4000);
        } else {
          const errData = await res.json().catch(() => ({}));
          setSendFeedback(`Failed to send: ${errData.message || 'Server error'}`);
        }
      } catch (err: any) {
        setSendFeedback(`Error: ${err.message || 'Failed to send'}`);
      } finally {
        setIsSendingReply(false);
      }
    } else {
      // SMS reply
      setSendFeedback('SMS message sent!');
      setReplyText('');
      setTimeout(() => setSendFeedback(''), 4000);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (channelFilter === 'Unread' && !msg.unread) return false;
    if (channelFilter === 'Starred') return false; 
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(msg.contactName || '').toLowerCase().includes(q) || String(msg.lastMessage || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Team Inbox */}
        <div className="w-[340px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          {/* Header */}
          <div className="p-4 flex flex-col gap-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                 Team inbox
              </h1>
              <div className="flex items-center gap-2 text-gray-500">
                 <Filter size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
                 <Edit size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
              </div>
            </div>
            
            {title === "Acquisitions Inbox" && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                   <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <Mail size={15} />
                      <span className="font-semibold">Outlook Mailbox</span>
                   </div>
                   {msConnected ? (
                      <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>Connected</span>
                          <button onClick={fetchMsEmails} disabled={isFetchingMs} className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2.5 py-1 rounded font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 shadow-sm">
                              <RefreshCw size={11} className={isFetchingMs ? 'animate-spin' : ''} />
                              {isFetchingMs ? 'Syncing...' : 'Sync'}
                          </button>
                      </div>
                   ) : (
                      <button onClick={handleConnectMs} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-medium transition-colors shadow-sm">
                         Connect
                      </button>
                   )}
                </div>
            )}
          </div>
          
          {/* Tabs */}
          <div className="flex text-sm border-b border-gray-200 dark:border-gray-800">
             {['Unread', 'All', 'Recent', 'Starred'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setChannelFilter(tab as any)}
                  className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${channelFilter === tab ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  {tab}
                </button>
             ))}
          </div>
          
          {/* Select all & Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
             <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
             <span className="text-sm text-gray-600 dark:text-gray-400">Select all</span>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto">
             {filteredMessages.map(msg => (
               <div 
                 key={msg.id} 
                 onClick={() => handleSelectMessage(msg)}
                 className={`flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedMessage?.id === msg.id ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
               >
                  <input type="checkbox" className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" onClick={(e) => e.stopPropagation()} />
                  <div className="flex-shrink-0 w-10 h-10 bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300 rounded-full flex items-center justify-center font-semibold text-sm">
                    {msg.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                       <span className={`text-sm truncate pr-2 ${msg.unread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'}`}>
                         {msg.contactName}
                       </span>
                       <span className="text-xs text-gray-500 whitespace-nowrap">{msg.timestamp}</span>
                    </div>
                    <p className={`text-sm truncate ${msg.unread ? 'font-medium text-gray-800 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                       {msg.lastMessage}
                    </p>
                    {msg.propertyAddress && (
                      <span className="inline-block mt-1 text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-full">
                        📍 {msg.propertyAddress}
                      </span>
                    )}
                  </div>
                  {msg.unread && (
                    <div className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded text-[10px] flex items-center justify-center font-bold mt-1">
                      1
                    </div>
                  )}
               </div>
             ))}
             {filteredMessages.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                   No conversations found.
                </div>
             )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Thread / Email View */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-gray-900/50">
          {selectedMessage ? (
            <>
              {/* Thread Header */}
              <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300 rounded-full flex items-center justify-center font-semibold text-xs">
                    {selectedMessage.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">{selectedMessage.contactName}</h2>
                    {selectedMessage.contactEmail && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">{selectedMessage.contactEmail}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                   {selectedMessage.type === 'Email' && (
                     <button 
                       onClick={() => handleSelectMessage(selectedMessage)} 
                       title="Refresh email content"
                       className="p-1 hover:text-gray-700 dark:hover:text-gray-200"
                     >
                       <RefreshCw size={17} className={isLoadingBody ? 'animate-spin' : ''} />
                     </button>
                   )}
                   <Video size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Phone size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Star size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Trash2 size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                </div>
              </div>

              {/* Thread Body: Email View or SMS View */}
              {selectedMessage.type === 'Email' ? (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc] dark:bg-gray-950/40">
                  <div className="max-w-5xl mx-auto space-y-4">
                    {/* Subject & Property Banner */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                            <Mail size={22} />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug break-words">
                              {selectedMessage.subject || selectedMessage.lastMessage}
                            </h2>
                            {selectedMessage.propertyAddress && (
                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mt-2.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold shadow-2xs">
                                  <MapPin size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Matched Property:</span>
                                  <span>{selectedMessage.propertyAddress}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold flex items-center gap-1.5 border border-emerald-200/70 dark:border-emerald-800/50 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Outlook Synced
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email Message Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs overflow-hidden">
                      {/* Sender / Meta Header */}
                      <div className="p-4 md:px-6 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/70 dark:bg-gray-800/40 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                            {selectedMessage.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-bold text-sm text-gray-900 dark:text-white">
                                {selectedMessage.contactName}
                              </span>
                              {selectedMessage.contactEmail && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                  &lt;{selectedMessage.contactEmail}&gt;
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              to {selectedMessage.toRecipients && selectedMessage.toRecipients.length > 0 ? selectedMessage.toRecipients.map(r => r.name || r.address).join(', ') : 'me'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{selectedMessage.timestamp}</span>
                          {selectedMessage.bodyType === 'html' && (
                            <button
                              onClick={() => setShowPlainText(!showPlainText)}
                              className="text-xs px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors cursor-pointer shadow-2xs"
                            >
                              {showPlainText ? 'Show Formatted HTML' : 'Show Plain Text'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Email Body Content */}
                      <div className="p-4 md:p-6 bg-white dark:bg-gray-800">
                        {isLoadingBody ? (
                          <div className="py-24 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <Loader2 size={26} className="animate-spin text-blue-500" />
                            <span className="text-xs">Loading email content...</span>
                          </div>
                        ) : showPlainText || selectedMessage.bodyType === 'text' ? (
                          <div className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words bg-gray-50 dark:bg-gray-900/40 p-6 rounded-lg border border-gray-100 dark:border-gray-800">
                            {selectedMessage.body || selectedMessage.bodyPreview || 'No email content available.'}
                          </div>
                        ) : selectedMessage.body ? (
                          <div className="w-full overflow-x-auto bg-white rounded-lg border border-gray-100 shadow-2xs">
                            <iframe
                              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
                                * { box-sizing: border-box; }
                                html, body {
                                  margin: 0;
                                  padding: 24px;
                                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                  font-size: 15px;
                                  line-height: 1.65;
                                  color: #1e293b;
                                  background-color: #ffffff;
                                  overflow-x: auto;
                                  -webkit-font-smoothing: antialiased;
                                }
                                a { color: #2563eb; text-decoration: underline; }
                                img { max-width: 100%; height: auto; display: inline-block; }
                                table { border-collapse: collapse; margin: 14px 0; }
                                td, th { padding: 8px 14px; border: 1px solid #e2e8f0; vertical-align: top; text-align: left; }
                                p { margin-top: 0; margin-bottom: 1em; }
                                blockquote { border-left: 4px solid #cbd5e1; margin: 14px 0; padding-left: 14px; color: #475569; }
                              </style></head><body>${selectedMessage.body}</body></html>`}
                              className="w-full min-h-[500px] border-0 block"
                              title="Email Body"
                              onLoad={(e) => {
                                try {
                                  const doc = e.currentTarget.contentWindow?.document;
                                  if (doc?.body) {
                                    const h = Math.max(doc.body.scrollHeight + 50, 450);
                                    e.currentTarget.style.height = `${h}px`;
                                  }
                                } catch (err) {}
                              }}
                            />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-gray-900/40 p-6 rounded-lg border border-gray-100 dark:border-gray-800">
                            {selectedMessage.bodyPreview || 'No email content available.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SMS Messages Area */
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                   <div className="flex justify-center">
                      <span className="text-xs font-medium text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full shadow-sm">
                         Today
                      </span>
                   </div>
                   
                   {/* Outbound message */}
                   <div className="flex justify-end">
                      <div className="max-w-[75%]">
                         <div className="bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200 p-3 rounded-lg rounded-tr-none text-sm border border-blue-100 dark:border-blue-800/30">
                           Hi {selectedMessage.contactName.split(' ')[0]}, it's Ashari Zakar. I'm looking to buy a home in Fulton County or nearby area. I got your number from {selectedMessage.propertyAddress || 'the listing'}. Can I call you in a little bit?
                         </div>
                         <div className="text-[11px] text-gray-400 mt-1 flex justify-end items-center gap-1">
                            2:07 PM <CheckSquare size={12} className="text-blue-500" />
                         </div>
                      </div>
                   </div>

                   {/* Inbound message */}
                   <div className="flex justify-start items-end gap-2">
                      <div className="flex-shrink-0 w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-semibold text-[10px] mb-5">
                         {selectedMessage.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="max-w-[75%]">
                         <div className="text-xs text-blue-500 font-medium mb-1 ml-1">New</div>
                         <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-lg rounded-tl-none text-sm border border-gray-200 dark:border-gray-700 shadow-sm">
                           {selectedMessage.lastMessage}
                         </div>
                         <div className="text-[11px] text-gray-400 mt-1 ml-1">
                            {selectedMessage.timestamp}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Composer */}
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
                 <div className="flex gap-4 mb-2">
                    <button 
                      onClick={() => setComposerTab('SMS')}
                      className={`text-sm font-medium pb-1 border-b-2 transition-colors ${composerTab === 'SMS' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      SMS
                    </button>
                    <button 
                      onClick={() => setComposerTab('Email')}
                      className={`text-sm font-medium pb-1 border-b-2 transition-colors ${composerTab === 'Email' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Email
                    </button>
                 </div>

                 {composerTab === 'Email' && selectedMessage.contactEmail && (
                   <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                     <span>To: <strong className="text-gray-700 dark:text-gray-200">{selectedMessage.contactEmail}</strong></span>
                     <span>•</span>
                     <span className="truncate">Subject: Re: {selectedMessage.subject || selectedMessage.lastMessage}</span>
                   </div>
                 )}

                 <div className="relative flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                       <Plus size={20} />
                    </button>
                    <input 
                      type="text" 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      placeholder={composerTab === 'Email' ? `Reply to ${selectedMessage.contactName}...` : "Type a message..."} 
                      className="flex-1 py-3 px-2 bg-transparent text-sm focus:outline-none text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center pr-2 gap-1">
                       <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                         <Paperclip size={18} />
                       </button>
                       <button 
                         onClick={handleSendReply}
                         disabled={!replyText.trim() || isSendingReply}
                         className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 rounded-md disabled:opacity-40"
                       >
                         {isSendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                       </button>
                    </div>
                 </div>

                 {sendFeedback && (
                   <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                     {sendFeedback}
                   </div>
                 )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p>Select a conversation to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
