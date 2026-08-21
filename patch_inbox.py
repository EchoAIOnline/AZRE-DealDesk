import re

with open('/app/applet/components/Inbox/Inbox.tsx', 'r') as f:
    content = f.read()

# Add imports
imports_to_add = "import { useEffect, useState, useRef } from 'react';\nimport { useAppStore } from '../../store/useAppStore';\n"
content = content.replace("import React, { useState } from 'react';", imports_to_add)

# Inside Inbox component, add logic to fetch and merge Microsoft emails
inbox_logic_hook = """export const Inbox: React.FC<{ title?: string, initialMessages?: InboxMessage[] }> = ({ title = "Conversations", initialMessages = [] }) => {
  const { deals } = useAppStore();
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [msConnected, setMsConnected] = useState(false);
  const [isFetchingMs, setIsFetchingMs] = useState(false);
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
          
          let matches = false;
          let matchedAddress = '';
          for (const address of dealAddresses) {
            // Very simple exact match for now, could use fuzzy
            // Usually we'd match the street number and name
            const firstPart = address.split(',')[0].trim();
            if (firstPart.length > 5 && (bodyPreview.includes(firstPart) || subject.includes(firstPart))) {
              matches = true;
              matchedAddress = address;
              break;
            }
          }

          if (matches) {
            matchingEmails.push({
              id: email.id,
              contactName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
              contactEmail: email.from?.emailAddress?.address,
              contactPhone: '',
              propertyAddress: matchedAddress,
              lastMessage: email.subject,
              timestamp: new Date(email.receivedDateTime).toLocaleString(),
              unread: true, // graph api has isRead field, but we'll set unread true to highlight
              type: 'Email',
              direction: 'inbound',
              msEmailData: email // save raw payload
            } as InboxMessage & { msEmailData: any });
          }
        });

        if (matchingEmails.length > 0) {
          setMessages(prev => {
            const newIds = new Set(matchingEmails.map(m => m.id));
            const filteredPrev = prev.filter(p => !newIds.has(p.id));
            return [...matchingEmails, ...filteredPrev];
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingMs(false);
    }
  };
"""

content = content.replace('export const Inbox: React.FC<{ title?: string, initialMessages?: InboxMessage[] }> = ({ title = "Conversations", initialMessages = [] }) => {\n  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);', inbox_logic_hook)

# Add connect button in UI Header
header_old = """          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-lg font-semibold flex items-center gap-2">
               Team inbox
            </h1>
            <div className="flex items-center gap-2 text-gray-500">
               <Filter size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
               <Edit size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
            </div>
          </div>"""

header_new = """          {/* Header */}
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
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800/50">
                   <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                      <Mail size={14} />
                      <span className="font-medium">Outlook Mailbox</span>
                   </div>
                   {msConnected ? (
                      <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>Connected</span>
                          <button onClick={fetchMsEmails} disabled={isFetchingMs} className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              {isFetchingMs ? 'Syncing...' : 'Sync'}
                          </button>
                      </div>
                   ) : (
                      <button onClick={handleConnectMs} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-medium transition-colors">
                         Connect
                      </button>
                   )}
                </div>
            )}
          </div>"""

content = content.replace(header_old, header_new)

with open('/app/applet/components/Inbox/Inbox.tsx', 'w') as f:
    f.write(content)
