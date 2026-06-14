import React, { useState } from 'react';
import { Search, Filter, MessageSquare, Mail, Phone } from 'lucide-react';
import { InboxMessage } from '../../types';

export const Inbox: React.FC<{ title?: string, initialMessages?: InboxMessage[] }> = ({ title = "Unified Inbox", initialMessages = [] }) => {
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'SMS' | 'Email'>('all');

  const filteredMessages = messages.filter(msg => {
    if (channelFilter !== 'all' && msg.type !== channelFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return String(msg.contactName || '').toLowerCase().includes(q) || String(msg.lastMessage || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage all your offer conversations in one place</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition">
            <Filter size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Message List */}
        <div className="w-1/3 min-w-[300px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setChannelFilter('all')} 
                className={`px-3 py-1 text-sm rounded-full transition ${channelFilter === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                All
              </button>
              <button 
                onClick={() => setChannelFilter('Email')} 
                className={`px-3 py-1 text-sm rounded-full transition ${channelFilter === 'Email' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                Email
              </button>
              <button 
                onClick={() => setChannelFilter('SMS')} 
                className={`px-3 py-1 text-sm rounded-full transition ${channelFilter === 'SMS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                Text
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-4 mt-4 text-sm font-medium border-b border-gray-200 dark:border-gray-700">
              <button className="pb-2 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400">All ({filteredMessages.length})</button>
              <button className="pb-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Unread ({filteredMessages.filter(m => m.unread).length})</button>
              <button className="pb-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Flagged (0)</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`p-4 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${selectedMessage?.id === msg.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onClick={() => setSelectedMessage(msg)}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${msg.unread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {msg.contactName}
                    </span>
                    {msg.unread && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{msg.timestamp}</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                  {msg.type === 'SMS' ? <MessageSquare size={12} /> : <Mail size={12} />}
                  {msg.propertyAddress}
                </div>
                <p className={`text-sm truncate ${msg.unread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  {msg.lastMessage}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Message Detail View */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col">
          {selectedMessage ? (
            <>
              <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedMessage.contactName}</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Phone size={14} /> {selectedMessage.contactPhone}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedMessage.propertyAddress}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">View Deal Details</div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
                {/* Mock Conversation History */}
                <div className="flex justify-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">May 15, 2026</span>
                </div>
                
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white p-3 rounded-lg rounded-tr-none max-w-[70%] shadow-sm">
                    <p className="text-sm">Hello {selectedMessage.contactName.split(' ')[0]}, I've sent you a cash offer for {selectedMessage.propertyAddress}. Clean offer with 14-day inspection, can close in 10 days.</p>
                    <span className="text-[10px] text-blue-200 mt-1 block text-right">10:32 AM</span>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white p-3 rounded-lg rounded-tl-none max-w-[70%] shadow-sm">
                    <p className="text-sm">{selectedMessage.lastMessage}</p>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block text-left">{selectedMessage.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <textarea 
                    placeholder="Type your message..." 
                    className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-14"
                  ></textarea>
                  <button className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                    <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="msgType" defaultChecked className="text-blue-600 focus:ring-blue-500" /> SMS</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="msgType" className="text-blue-600 focus:ring-blue-500" /> Email</label>
                  </div>
                  <span>Press Enter to send</span>
                </div>
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
