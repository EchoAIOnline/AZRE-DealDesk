
import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter, Phone, Mail, MapPin, Edit2, Trash2, Building, User, BookUser, X, Save } from 'lucide-react';
import { Contact } from '../../types';
import { formatPhoneNumber, generateId } from '../../services/utils';
import { api } from '../../services/api';

interface ContactsManagerProps {
    contacts: Contact[];
    setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
}

const CONTACT_TYPES = [
    "Contractor", 
    "Lender", 
    "Title Company", 
    "Attorney", 
    "Inspector", 
    "Handyman", 
    "Property Manager", 
    "Bird Dog",
    "Other"
];

export const ContactsManager: React.FC<ContactsManagerProps> = ({ contacts, setContacts }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
    const [isCustomType, setIsCustomType] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Contact>({
        id: '',
        name: '',
        type: '',
        phone: '',
        email: '',
        company: '',
        address: '',
        notes: ''
    });

    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            const matchesSearch = 
                String(contact.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(contact.company || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(contact.type || "").toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesFilter = filterType === "All" || contact.type === filterType;

            return matchesSearch && matchesFilter;
        });
    }, [contacts, searchQuery, filterType]);

    const handleOpenModal = (contact?: Contact) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({ ...contact });
            setIsCustomType(!availableTypes.includes(contact.type || ''));
        } else {
            setEditingContact(null);
            setFormData({
                id: generateId(),
                name: '',
                type: '',
                phone: '',
                email: '',
                company: '',
                address: '',
                notes: ''
            });
            setIsCustomType(false);
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const tempId = editingContact ? editingContact.id : formData.id;
        const contactToSave: Contact = {
            ...formData,
            id: tempId, // Ensure we keep ID if editing
            created_at: editingContact ? editingContact.created_at : new Date().toISOString()
        };

        // Close modal immediately
        setIsModalOpen(false);

        // Optimistic Update
        if (editingContact) {
            setContacts(prev => prev.map(c => c.id === tempId ? contactToSave : c));
        } else {
            setContacts(prev => [...prev, contactToSave]);
        }

        // DB Save
        const saved = await api.save(contactToSave, 'Contacts');
        if (saved) {
             // Update with real DB data (e.g. if ID changed)
             setContacts(prev => prev.map(c => c.id === tempId ? saved : c));
        } else {
             alert("Failed to save contact. Please check connection.");
             // Revert if new contact
             if (!editingContact) {
                 setContacts(prev => prev.filter(c => c.id !== tempId));
             }
        }
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteConfirmation(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;
        
        const id = deleteConfirmation;
        // Optimistic Update
        const previousContacts = [...contacts];
        setContacts(prev => prev.filter(c => String(c.id) !== String(id)));
        setDeleteConfirmation(null);

        try {
            const success = await api.delete(id, 'Contacts');
            if (!success) {
                throw new Error("API returned false");
            }
        } catch (error) {
            console.error("Failed to delete contact:", error);
            alert("Failed to delete contact. Please try again.");
            setContacts(previousContacts); // Revert
        }
    };

    // Extract unique types for the filter dropdown
    const availableTypes = useMemo(() => {
        const types = new Set(CONTACT_TYPES);
        contacts.forEach(c => c.type && types.add(c.type));
        return Array.from(types).sort();
    }, [contacts]);

    return (
        <div className="p-6 md:p-8 space-y-6 h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <BookUser className="text-blue-600" size={32} />
                        Contacts Manager
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Manage your network of contractors, lenders, and professional services.
                    </p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95 text-sm"
                >
                    <Plus size={18} /> Add Contact
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center shrink-0">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search contacts..." 
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-blue-500 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative w-full md:w-64">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="All">All Types</option>
                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-100 dark:bg-gray-900/50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-6 py-4">Name / Company</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Contact Info</th>
                                <th className="px-6 py-4 hidden md:table-cell">Notes</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredContacts.length > 0 ? (
                                filteredContacts.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                                    {contact.company ? <Building size={18} /> : <User size={18} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 dark:text-white">{contact.name}</div>
                                                    {contact.company && <div className="text-xs text-gray-500">{contact.company}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-600">
                                                {contact.type || "Other"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {contact.phone && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Phone size={12} className="text-gray-400" />
                                                        {formatPhoneNumber(contact.phone)}
                                                    </div>
                                                )}
                                                {contact.email && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Mail size={12} className="text-gray-400" />
                                                        <a href={`mailto:${contact.email}`} className="hover:text-blue-500 hover:underline">{contact.email}</a>
                                                    </div>
                                                )}
                                                {contact.address && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <MapPin size={12} className="text-gray-400" />
                                                        <span className="truncate max-w-[150px]" title={contact.address}>{contact.address}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell max-w-xs">
                                            <p className="truncate text-xs text-gray-500" title={contact.notes}>{contact.notes || "—"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleOpenModal(contact)} 
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} className="pointer-events-none" />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteClick(contact.id, e)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer relative z-10"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} className="pointer-events-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic">
                                        No contacts found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 text-center">
                    Showing {filteredContacts.length} contacts
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {editingContact ? 'Edit Contact' : 'Add New Contact'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <X size={24}/>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Full Name</label>
                                    <input 
                                        required 
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Role / Type</label>
                                    {isCustomType ? (
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                                value={formData.type} 
                                                onChange={e => setFormData({...formData, type: e.target.value})} 
                                                placeholder="Type new role..."
                                                autoFocus
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setIsCustomType(false);
                                                    setFormData({...formData, type: ''});
                                                }}
                                                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 rounded"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500"
                                            value={formData.type}
                                            onChange={e => {
                                                if (e.target.value === 'ADD_NEW') {
                                                    setIsCustomType(true);
                                                    setFormData({...formData, type: ''});
                                                } else {
                                                    setFormData({...formData, type: e.target.value});
                                                }
                                            }}
                                        >
                                            <option value="" disabled>Select or type new role...</option>
                                            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            <option value="ADD_NEW" className="font-bold text-blue-500">Add New...</option>
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Company</label>
                                <input 
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                    value={formData.company} 
                                    onChange={e => setFormData({...formData, company: e.target.value})} 
                                    placeholder="Business LLC"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Phone</label>
                                    <input 
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                        value={formData.phone} 
                                        onChange={e => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})} 
                                        placeholder="(555) 555-5555"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Email</label>
                                    <input 
                                        type="email"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Address</label>
                                <input 
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" 
                                    value={formData.address} 
                                    onChange={e => setFormData({...formData, address: e.target.value})} 
                                    placeholder="123 Main St, Atlanta GA"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold mb-1 block">Notes</label>
                                <textarea 
                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500 resize-none h-24" 
                                    value={formData.notes} 
                                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                                    placeholder="Additional details..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 rounded-lg font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                                >
                                    <Save size={16} /> Save Contact
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
                <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDeleteConfirmation(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-sm border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden p-6 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 mx-auto flex items-center justify-center mb-4">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Contact?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                            Are you sure you want to delete this contact? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmation(null)}
                                className="flex-1 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white py-2.5 rounded-lg font-bold text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-red-900/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
