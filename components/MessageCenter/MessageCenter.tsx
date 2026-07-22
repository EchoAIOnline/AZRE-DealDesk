import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, Mail, Phone, Search, User, PhoneCall, Hash, Clock, Calendar, PlayCircle } from 'lucide-react';
import { supabase } from '../../services/api';

type ContactType = 'Agent' | 'Buyer' | 'Wholesaler' | 'Contact';

interface UnifiedContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: ContactType;
}

export const MessageCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<UnifiedContact[]>([]);

  const [dialerInput, setDialerInput] = useState('');
  const [activeTab, setActiveTab] = useState<'SMS' | 'Email'>('SMS');
  const [messageBody, setMessageBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('');

  // Automation states
  const [sendOption, setSendOption] = useState<'Now' | 'Schedule' | 'Drip'>('Now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');

  // Fetch contacts
  useEffect(() => {
    const fetchAllContacts = async () => {
      setIsSearching(true);
      try {
        const [agentsRes, buyersRes, wholesalersRes, contactsRes] = await Promise.all([
          supabase.from('Agents').select('id, name, phone, email'),
          supabase.from('Buyers').select('id, name, phone, email'),
          supabase.from('Wholesalers').select('id, name, phone, email'),
          supabase.from('Contacts').select('id, name, phone, email')
        ]);

        const formatContacts = (data: any[] | null, type: ContactType): UnifiedContact[] => {
          if (!data) return [];
          return data.map(item => ({
            id: item.id,
            name: item.name || '',
            phone: item.phone || '',
            email: item.email || '',
            type,
            address: item.address || item.property_address || ''
          })).filter(c => c.name || c.phone || c.email);
        };

        const allContacts = [
          ...formatContacts(agentsRes.data, 'Agent'),
          ...formatContacts(buyersRes.data, 'Buyer'),
          ...formatContacts(wholesalersRes.data, 'Wholesaler'),
          ...formatContacts(contactsRes.data, 'Contact')
        ];
        
        setContacts(allContacts);
      } catch (err) {
        console.error("Error fetching contacts:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchAllContacts();
  }, []);

  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 5); // limit to top 5 results

  const handleSelectContact = (contact: UnifiedContact) => {
    if (!selectedContacts.find(c => c.id === contact.id)) {
      const newSelection = [...selectedContacts, contact];
      setSelectedContacts(newSelection);
      if (newSelection.length === 1) {
        setDialerInput(contact.phone);
      } else {
        setDialerInput('');
      }
    }
    setSearchQuery('');
  };

  const handleRemoveContact = (id: string) => {
    const newSelection = selectedContacts.filter(c => c.id !== id);
    setSelectedContacts(newSelection);
    if (newSelection.length === 1) {
      setDialerInput(newSelection[0].phone);
    } else {
      setDialerInput('');
    }
  };

  const selectGroup = (type: ContactType) => {
    const groupContacts = contacts.filter(c => c.type === type);
    const newSelection = [...selectedContacts];
    groupContacts.forEach(c => {
      if (!newSelection.find(existing => existing.id === c.id)) {
        newSelection.push(c);
      }
    });
    setSelectedContacts(newSelection);
    if (newSelection.length === 1) {
      setDialerInput(newSelection[0].phone);
    } else {
      setDialerInput('');
    }
  };

  const clearSelection = () => {
    setSelectedContacts([]);
    setDialerInput('');
  };

  const insertVariable = (variable: string) => {
    setMessageBody(prev => prev + variable);
  };

  const handleDial = (num: string) => {
    setDialerInput(prev => prev + num);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Contact Selection */}
        <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 p-5 overflow-hidden">
          <h2 className="text-xl font-bold mb-1">Communication Center</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">Select one or multiple contacts to make a call, send an SMS, or send an email.</p>
          
          {/* Bulk Actions */}
          <div className="flex flex-wrap gap-2 mb-5">
             <button onClick={() => selectGroup('Agent')} className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700">All Agents</button>
             <button onClick={() => selectGroup('Buyer')} className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700">All Buyers</button>
             <button onClick={() => selectGroup('Wholesaler')} className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700">All Wholesalers</button>
             <button onClick={() => selectGroup('Contact')} className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700">All Contacts</button>
             {selectedContacts.length > 0 && (
               <button onClick={clearSelection} className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30 rounded hover:bg-red-100 dark:hover:bg-red-900/40 ml-auto">Clear All</button>
             )}
          </div>

          {/* Search Bar */}
          <div className="relative mb-4 flex-shrink-0">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map(c => (
                    <div 
                      key={`${c.type}-${c.id}`} 
                      onClick={() => handleSelectContact(c)}
                      className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{c.name || 'Unknown Name'}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          {c.phone && <span className="flex items-center gap-1"><Phone size={10} /> {c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full font-medium">
                        {c.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">No contacts found</div>
                )}
              </div>
            )}
          </div>
          
          {/* Selected Contacts Badge */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 flex-shrink-0">Selected ({selectedContacts.length})</span>
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 pb-4">
              {selectedContacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 px-3 py-2 rounded-lg flex-shrink-0">
                   <div className="flex items-center gap-2 truncate">
                     <User size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                     <span className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{contact.name}</span>
                     <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 flex-shrink-0 border border-blue-200 dark:border-blue-700/50 px-1.5 py-0.5 rounded">{contact.type}</span>
                   </div>
                   <button 
                     onClick={() => handleRemoveContact(contact.id)} 
                     className="ml-2 text-blue-400 hover:text-blue-600 flex-shrink-0 p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50"
                   >
                     &times;
                   </button>
                </div>
              ))}
              {selectedContacts.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8 italic">No contacts selected</div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Text/Email Sender */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900/50 p-6 overflow-y-auto">
           <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
             <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 mb-6">
                <button 
                  onClick={() => setActiveTab('SMS')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'SMS' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <MessageSquare size={16} /> SMS Message
                </button>
                <button 
                  onClick={() => setActiveTab('Email')}
                  className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'Email' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  <Mail size={16} /> Email
                </button>
             </div>

             <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-5 flex flex-col min-h-0">
                {/* Recipient */}
                <div className="mb-4">
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To:</label>
                   <input 
                     type="text" 
                     disabled
                     value={selectedContacts.length > 0 ? `${selectedContacts.length} contact(s) selected` : 'Select contacts from the left panel'} 
                     className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-500"
                   />
                </div>

                {/* Email Subject (Conditional) */}
                {activeTab === 'Email' && (
                  <div className="mb-4">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject:</label>
                     <input 
                       type="text" 
                       placeholder="Enter email subject"
                       value={emailSubject}
                       onChange={e => setEmailSubject(e.target.value)}
                       className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />
                  </div>
                )}

                {/* Message Body */}
                <div className="flex-1 mb-4 flex flex-col min-h-[160px]">
                   <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message:</label>
                     <div className="flex items-center gap-1.5 flex-wrap">
                       <span className="text-xs text-gray-400 mr-1">Insert:</span>
                       <button onClick={() => insertVariable('{First Name}')} className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors">First Name</button>
                       <button onClick={() => insertVariable('{Last Name}')} className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors">Last Name</button>
                       <button onClick={() => insertVariable('{Property Address}')} className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors">Property Address</button>
                     </div>
                   </div>
                   <textarea 
                     placeholder={`Type your ${activeTab === 'SMS' ? 'text message' : 'email'} here...\nUse {First Name} to insert the contact's name.`}
                     value={messageBody}
                     onChange={e => setMessageBody(e.target.value)}
                     className="flex-1 w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                   />
                </div>

                {/* Automation Settings */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                   <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                     <PlayCircle size={16} /> Send Options & Automation
                   </h3>
                   <div className="flex flex-wrap gap-3 mb-4">
                      <button 
                         onClick={() => setSendOption('Now')}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sendOption === 'Now' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                         <Send size={14} /> Send Now
                      </button>
                      <button 
                         onClick={() => setSendOption('Schedule')}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sendOption === 'Schedule' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                         <Clock size={14} /> Schedule Later
                      </button>
                      <button 
                         onClick={() => setSendOption('Drip')}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sendOption === 'Drip' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                         <Calendar size={14} /> Add to Drip Campaign
                      </button>
                   </div>

                   {/* Conditional Inputs based on Send Option */}
                   {sendOption === 'Schedule' && (
                     <div className="flex gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex-1">
                           <label className="block text-xs text-gray-500 mb-1">Date</label>
                           <input 
                             type="date" 
                             value={scheduleDate}
                             onChange={e => setScheduleDate(e.target.value)}
                             className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           />
                        </div>
                        <div className="flex-1">
                           <label className="block text-xs text-gray-500 mb-1">Time</label>
                           <input 
                             type="time" 
                             value={scheduleTime}
                             onChange={e => setScheduleTime(e.target.value)}
                             className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           />
                        </div>
                     </div>
                   )}

                   {sendOption === 'Drip' && (
                     <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-xs text-gray-500 mb-1">Select Campaign</label>
                        <select 
                           value={selectedCampaign}
                           onChange={e => setSelectedCampaign(e.target.value)}
                           className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                           <option value="">-- Choose a Campaign --</option>
                           <option value="Motivated Seller Follow-up">Motivated Seller Follow-up (7 Days)</option>
                           <option value="Buyer Outreach">Buyer Outreach (30 Days)</option>
                           <option value="Cold Leads Re-engagement">Cold Leads Re-engagement (90 Days)</option>
                        </select>
                     </div>
                   )}
                </div>

                {/* Send Action */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
                   <div className="text-xs text-gray-500 flex items-center gap-1">
                     <Hash size={12} /> {messageBody.length} characters
                   </div>
                   <button 
                      onClick={() => {
                         if (selectedContacts.length === 0) {
                            alert('Please select at least one contact first.');
                            return;
                         }
                         if (sendOption === 'Schedule' && (!scheduleDate || !scheduleTime)) {
                            alert('Please select a date and time for scheduling.');
                            return;
                         }
                         if (sendOption === 'Drip' && !selectedCampaign) {
                            alert('Please select a drip campaign.');
                            return;
                         }
                         
                         let actionMsg = `Send ${activeTab} functionality`;
                         if (sendOption === 'Schedule') actionMsg = `Scheduling ${activeTab} for ${scheduleDate} ${scheduleTime}`;
                         if (sendOption === 'Drip') actionMsg = `Adding contact to drip campaign: ${selectedCampaign}`;
                         
                         alert(`${actionMsg} will be integrated with Twilio/Email service soon.`);
                         setMessageBody('');
                         setEmailSubject('');
                         setSendOption('Now');
                         setScheduleDate('');
                         setScheduleTime('');
                         setSelectedCampaign('');
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                   >
                      {sendOption === 'Now' ? <Send size={16} /> : sendOption === 'Schedule' ? <Clock size={16} /> : <Calendar size={16} />} 
                      {sendOption === 'Now' ? `Send ${activeTab}` : sendOption === 'Schedule' ? 'Schedule' : 'Add to Campaign'}
                   </button>
                </div>
             </div>
           </div>
        </div>

        {/* Right Column: Phone Dialer */}
        <div className="w-[280px] lg:w-[320px] flex-shrink-0 border-l border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 p-5 overflow-y-auto">
           <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2">
             <Phone size={16} /> Phone Dialer
           </h2>
           
           <div className="flex-1 flex flex-col items-center justify-center max-w-[240px] mx-auto w-full pb-4">
              {/* Number Input */}
              <div className="w-full bg-gray-50 dark:bg-gray-800 p-2 lg:p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-5 flex items-center justify-between min-h-[50px] lg:min-h-[56px]">
                 <input 
                   type="text" 
                   value={dialerInput}
                   onChange={e => setDialerInput(e.target.value)}
                   className="bg-transparent text-xl lg:text-2xl font-light text-center w-full focus:outline-none tracking-wider"
                   placeholder="(555) 555-5555"
                 />
                 {dialerInput && (
                   <button onClick={() => setDialerInput(dialerInput.slice(0, -1))} className="text-gray-400 hover:text-gray-600 ml-2">
                     &times;
                   </button>
                 )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 lg:gap-3 mb-5 w-full">
                 {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                    <button 
                      key={key} 
                      onClick={() => handleDial(key)}
                      className="aspect-square bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex flex-col items-center justify-center transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                       <span className="text-lg lg:text-xl font-semibold">{key}</span>
                       {key !== '*' && key !== '#' && (
                         <span className="text-[8px] lg:text-[9px] text-gray-500 uppercase tracking-widest mt-0.5 lg:mt-1">
                           {key === '2' ? 'ABC' : key === '3' ? 'DEF' : key === '4' ? 'GHI' : key === '5' ? 'JKL' : key === '6' ? 'MNO' : key === '7' ? 'PQRS' : key === '8' ? 'TUV' : key === '9' ? 'WXYZ' : ''}
                         </span>
                       )}
                    </button>
                 ))}
              </div>

              {/* Call Button */}
              <button 
                onClick={() => alert('Dialing functionality will be integrated with Twilio soon.')}
                className="w-14 h-14 lg:w-16 lg:h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                 <PhoneCall size={24} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
