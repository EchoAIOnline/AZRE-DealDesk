import React, { useState } from 'react';
import { Search, Filter, MessageSquare, Mail, Phone, Video, Star, Trash2, Paperclip, Send, ChevronDown, User, Tag, Plus, CheckSquare, Edit, Maximize2, MoreHorizontal, Settings, HelpCircle, FileText, X, ExternalLink, AlertCircle } from 'lucide-react';
import { InboxMessage } from '../../types';

export const Inbox: React.FC<{ title?: string, initialMessages?: InboxMessage[] }> = ({ title = "Conversations", initialMessages = [] }) => {
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(initialMessages.length > 0 ? initialMessages[0] : null);
  const [channelFilter, setChannelFilter] = useState<'Unread' | 'All' | 'Recent' | 'Starred'>('Unread');

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
          <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-lg font-semibold flex items-center gap-2">
               Team inbox
            </h1>
            <div className="flex items-center gap-2 text-gray-500">
               <Filter size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
               <Edit size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
            </div>
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
                 onClick={() => setSelectedMessage(msg)}
                 className={`flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedMessage?.id === msg.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
               >
                  <input type="checkbox" className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" onClick={(e) => e.stopPropagation()} />
                  <div className="flex-shrink-0 w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-semibold text-sm">
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

        {/* MIDDLE COLUMN: Thread */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-gray-900/50">
          {selectedMessage ? (
            <>
              {/* Thread Header */}
              <div className="h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-semibold text-xs">
                    {selectedMessage.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{selectedMessage.contactName}</h2>
                </div>
                <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                   <Video size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Phone size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Star size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                   <Trash2 size={18} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" />
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 <div className="flex justify-center">
                    <span className="text-xs font-medium text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full shadow-sm">
                       Today
                    </span>
                 </div>
                 
                 {/* Fake outbound message */}
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

              {/* Composer */}
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
                 <div className="flex gap-4 mb-2">
                    <button className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 pb-1">SMS</button>
                    <button className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-b-2 border-transparent hover:border-gray-300 pb-1">Email</button>
                 </div>
                 <div className="relative flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                       <Plus size={20} />
                    </button>
                    <input 
                      type="text" 
                      placeholder="Type a message..." 
                      className="flex-1 py-3 px-2 bg-transparent text-sm focus:outline-none text-gray-900 dark:text-white"
                    />
                    <div className="flex items-center pr-2 gap-1">
                       <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                         <Paperclip size={18} />
                       </button>
                       <button className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 rounded-md">
                         <Send size={16} />
                       </button>
                    </div>
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

        {/* RIGHT COLUMN: Contact Details */}
        <div className="w-[320px] flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
          {selectedMessage ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Contact Details</h3>
                  <Maximize2 size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex-shrink-0 w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-semibold text-lg">
                      {selectedMessage.contactName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{selectedMessage.contactName}</h2>
                   </div>
                   <ExternalLink size={16} className="text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-200" /> 
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 
                 {/* Owner / Followers */}
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
                      <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                         <div className="flex items-center gap-2">
                           <User size={14} className="text-gray-400" />
                           <span className="truncate max-w-[100px]">Ashari Zakar</span>
                         </div>
                         <X size={12} className="text-gray-400 hover:text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Followers</label>
                      <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                         <div className="flex items-center gap-2">
                           <User size={14} className="text-gray-400" />
                           <span className="text-gray-400">Add</span>
                         </div>
                         <ChevronDown size={14} className="text-gray-400" />
                      </div>
                    </div>
                 </div>

                 {/* Tags */}
                 <div>
                    <label className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
                       <span>Tags (1)</span>
                       <Plus size={14} className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"/>
                    </label>
                    <div className="flex flex-wrap gap-2">
                       <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                         Fulton County 7.17.2026 
                         <X size={12} className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1" />
                       </span>
                    </div>
                 </div>

                 {/* Tabs */}
                 <div className="flex text-sm border-b border-gray-200 dark:border-gray-800">
                    <button className="flex-1 pb-2 border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-medium">All fields</button>
                    <button className="flex-1 pb-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium">DND</button>
                    <button className="flex-1 pb-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium">Actions</button>
                 </div>

                 {/* Form Fields */}
                 <div className="space-y-4">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                      <input type="text" placeholder="Search fields and folders" className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                       <div className="bg-gray-50 dark:bg-gray-800/80 p-3 flex justify-between items-center cursor-pointer border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contact</span>
                          <ChevronDown size={16} className="text-gray-500" />
                       </div>
                       <div className="p-4 space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">First name</label>
                            <input type="text" defaultValue={selectedMessage.contactName.split(' ')[0]} className="w-full p-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Last name</label>
                            <input type="text" defaultValue={selectedMessage.contactName.split(' ').slice(1).join(' ')} className="w-full p-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 group focus-within:border-blue-500 transition-colors">
                               <span className="text-base mr-2 flex items-center gap-1 opacity-80">
                                 🇺🇸 <ChevronDown size={12} className="text-gray-400" />
                               </span>
                               <input type="text" defaultValue={selectedMessage.contactPhone} className="flex-1 p-2 text-sm bg-transparent focus:outline-none text-gray-900 dark:text-white" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                            <input type="email" defaultValue={selectedMessage.contactEmail || ''} className="w-full p-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-colors" />
                            <div className="mt-2 text-[11px] text-gray-500 flex items-start gap-1">
                               <AlertCircle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
                               <span>Email is not verified and you can <a href="#" className="text-blue-500 hover:underline">Verify here</a></span>
                            </div>
                            <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                               <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                               Exclude from email verification
                            </label>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Business name</label>
                            <input type="text" placeholder="--" className="w-full p-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-colors" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Market</label>
                            <input type="text" placeholder="--" className="w-full p-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-colors" />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                <User size={32} className="mb-2 opacity-20" />
                <span className="text-sm">Select a conversation to view contact details</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
