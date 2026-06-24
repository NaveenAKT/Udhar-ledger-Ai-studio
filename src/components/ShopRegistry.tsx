/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Shop, Transaction, AuditLogEntry, Merchant } from '../types';
import { useLanguage } from '../lib/translations';
import { getActionTypeLabel } from './MerchantTransactions';
import { 
  Store, 
  Plus, 
  Phone, 
  MapPin, 
  Calendar, 
  Trash2, 
  ShieldAlert, 
  Loader2, 
  Landmark, 
  Users, 
  X, 
  Edit2,
  Check,
  Eye,
  ArrowRight,
  ArrowLeft,
  Search,
  FileText,
  History,
  Activity
} from 'lucide-react';

interface ShopRegistryProps {
  shops: Shop[];
  merchants?: Merchant[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];
  onAddShop: (name: string, phone: string, address: string, gstNumber: string, ownerEmail: string) => Promise<void>;
  onUpdateShop: (shopId: string, name: string, phone: string, address: string, ownerId?: string) => Promise<void>;
  onDeleteShop: (shopId: string) => Promise<void>;
  currentUserId: string;
  currentUserEmail?: string;
  onUpdateShopCollaborators?: (shopId: string, emails: string[], uids: string[]) => Promise<void>;
  onGetMerchantByEmail?: (email: string) => Promise<{ uid: string; email: string | null; displayName: string | null } | null>;
  autoOpenAddForm?: boolean;
  onAddFormOpened?: () => void;
}

export default function ShopRegistry({
  shops,
  merchants = [],
  transactions,
  auditLogs = [],
  onAddShop,
  onUpdateShop,
  onDeleteShop,
  currentUserId,
  currentUserEmail,
  onUpdateShopCollaborators,
  onGetMerchantByEmail,
  autoOpenAddForm,
  onAddFormOpened,
}: ShopRegistryProps) {
  const { t, language } = useLanguage();
  const [selectedShopTxId, setSelectedShopTxId] = useState<string | null>(null);
  const [shopTxSearchQuery, setShopTxSearchQuery] = useState('');
  const [viewingHistoryShop, setViewingHistoryShop] = useState<Shop | null>(null);
  const [activeMobileBottomSheetTx, setActiveMobileBottomSheetTx] = useState<Transaction | null>(null);

  // Add Shop states
  const [showAddForm, setShowAddForm] = useState(false);

  React.useEffect(() => {
    if (autoOpenAddForm) {
      setShowAddForm(true);
      onAddFormOpened?.();
    }
  }, [autoOpenAddForm, onAddFormOpened]);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopGst, setNewShopGst] = useState('');
  const [newShopOwnerEmail, setNewShopOwnerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shopError, setShopError] = useState('');

  // Edit Shop states
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editOwnerError, setEditOwnerError] = useState('');

  // Deletion state tracker (stores shop ID when delete clicked)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Collaborator interactions state
  const [collabEmailInput, setCollabEmailInput] = useState<Record<string, string>>({});
  const [isCollabWorking, setIsCollabWorking] = useState<Record<string, boolean>>({});
  const [collabError, setCollabError] = useState<Record<string, string>>({});
  const [collabSuccess, setCollabSuccess] = useState<Record<string, string>>({});

  // Confirmation state for adding/removing collaborators
  const [collabAddConfirm, setCollabAddConfirm] = useState<{
    shopId: string;
    email: string;
    currentEmails: string[];
    currentUids: string[];
  } | null>(null);

  const [collabRemoveConfirm, setCollabRemoveConfirm] = useState<{
    shopId: string;
    email: string;
    idx: number;
    currentEmails: string[];
    currentUids: string[];
  } | null>(null);

  const isSuperUser = currentUserEmail === 'naveenkumar31343@gmail.com' || currentUserEmail === 'akuthota.rajkumar@gmail.com';

  // Compute stats for each shop
  const shopStats = useMemo(() => {
    const stats: Record<string, { totalUnpaid: number; customerCount: number }> = {};
    
    shops.forEach(s => {
      stats[s.id] = { totalUnpaid: 0, customerCount: 0 };
    });

    const shopCustomers: Record<string, Set<string>> = {};
    shops.forEach(s => {
      shopCustomers[s.id] = new Set<string>();
    });

    transactions.forEach(tx => {
      if (tx.status === 'Unpaid' && stats[tx.shopId]) {
        stats[tx.shopId].totalUnpaid += tx.amount;
        if (shopCustomers[tx.shopId]) {
          shopCustomers[tx.shopId].add(tx.customerId);
        }
      }
    });

    shops.forEach(s => {
      if (stats[s.id]) {
        stats[s.id].customerCount = shopCustomers[s.id]?.size || 0;
      }
    });

    return stats;
  }, [shops, transactions]);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError('');
    if (!newShopName.trim()) return;

    if (!isSuperUser) {
      setShopError(language === 'te' ? 'వ్యాపారిని సృష్టించడానికి సూపర్ యూజర్ అనుమతి మాత్రమే అవసరం.' : 'Only super users are authorized to register merchants.');
      return;
    }

    if (!newShopGst.trim()) {
      setShopError(language === 'te' ? 'GST నంబర్ తప్పనిసరిగా నమోదు చేయాలి!' : 'GST number is mandatory!');
      return;
    }

    if (isSuperUser && !newShopOwnerEmail.trim()) {
      setShopError(language === 'te' ? 'యజమాని ఇమెయిల్ తప్పనిసరి!' : 'Owner Email is mandatory!');
      return;
    }

    const phoneClean = newShopPhone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      setShopError(language === 'te' ? 'మొబైల్ ఫోన్ నంబర్ ఖచ్చితంగా 10 అంకెలు మాత్రమే ఉండాలి!' : 'Phone number must be exactly 10 digits!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddShop(newShopName.trim(), phoneClean, newShopAddress.trim(), newShopGst.trim(), newShopOwnerEmail.trim());
      setNewShopName('');
      setNewShopPhone('');
      setNewShopAddress('');
      setNewShopGst('');
      setNewShopOwnerEmail('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setShopError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditPhone(shop.phone);
    setEditAddress(shop.address);
    setEditOwnerError('');
    // Do not prefill owner email - keep it blank as per requirement
    setEditOwnerEmail('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop || !editName.trim()) return;

    setIsSavingEdit(true);
    setEditOwnerError('');
    try {
      let ownerId: string | undefined = undefined;
      const isSuperUser = currentUserEmail === 'naveenkumar31343@gmail.com' || currentUserEmail === 'akuthota.rajkumar@gmail.com';
      if (isSuperUser) {
        if (!editOwnerEmail.trim()) {
          setEditOwnerError(language === 'te' ? 'యజమాని ఇమెయిల్ తప్పనిసరి!' : 'Owner Email is mandatory!');
          setIsSavingEdit(false);
          return;
        }
        const originalOwner = merchants?.find(m => m.uid === editingShop.ownerId);
        if (editOwnerEmail.trim() !== (originalOwner?.email || '')) {
          if (onGetMerchantByEmail) {
            const merch = await onGetMerchantByEmail(editOwnerEmail.trim());
            if (merch) {
              ownerId = merch.uid;
            } else {
              setEditOwnerError(language === 'te' ? 'ఈ ఇమెయిల్ కలిగిన మర్చంట్ లభించలేదు.' : 'No merchant with this email address found.');
              setIsSavingEdit(false);
              return;
            }
          }
        }
      }

      await onUpdateShop(editingShop.id, editName.trim(), editPhone.trim(), editAddress.trim(), ownerId);
      setEditingShop(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (shopId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteShop(shopId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddCollaborator = async (shopId: string, currentEmails: string[], currentUids: string[]) => {
    const input = collabEmailInput[shopId]?.trim();
    if (!input || !onUpdateShopCollaborators) return;

    // Fast validation
    if (!input.includes('@')) {
      setCollabError(prev => ({ ...prev, [shopId]: 'ఖచ్చితమైన ఇమెయిల్ అడ్రస్ ఎంటర్ చేయండి.' }));
      return;
    }

    if (currentEmails.map(e => e.toLowerCase()).includes(input.toLowerCase())) {
      setCollabError(prev => ({ ...prev, [shopId]: 'ఈ వ్యాపార సహాయకుడు ఇప్పటికే జోడించబడ్డారు.' }));
      return;
    }

    setCollabAddConfirm({
      shopId,
      email: input,
      currentEmails,
      currentUids
    });
  };

  const executeAddCollaborator = async () => {
    if (!collabAddConfirm || !onUpdateShopCollaborators) return;
    const { shopId, email, currentEmails, currentUids } = collabAddConfirm;
    setCollabAddConfirm(null);

    setIsCollabWorking(prev => ({ ...prev, [shopId]: true }));
    setCollabError(prev => ({ ...prev, [shopId]: '' }));
    setCollabSuccess(prev => ({ ...prev, [shopId]: '' }));

    try {
      let targetUid = '';
      if (onGetMerchantByEmail) {
        const m = await onGetMerchantByEmail(email);
        if (m) {
          targetUid = m.uid;
        }
      }

      const updatedEmails = [...currentEmails, email];
      const updatedUids = targetUid ? [...currentUids, targetUid] : [...currentUids];

      await onUpdateShopCollaborators(shopId, updatedEmails, updatedUids);
      
      setCollabEmailInput(prev => ({ ...prev, [shopId]: '' }));
      if (targetUid) {
        setCollabSuccess(prev => ({ ...prev, [shopId]: 'సహాయకుడు విజయవంతంగా జోడించబడ్డారు!' }));
      } else {
        setCollabSuccess(prev => ({ ...prev, [shopId]: 'సహాయకుడిని లింక్ చేసాము! వారు ప్రవేశించినప్పుడు ఈ షాప్ కనిపిస్తుంది.' }));
      }
      setTimeout(() => setCollabSuccess(prev => ({ ...prev, [shopId]: '' })), 5000);
    } catch (err: any) {
      setCollabError(prev => ({ ...prev, [shopId]: err?.message || 'ధృవీకరణ తిరస్కరించబడింది.' }));
    } finally {
      setIsCollabWorking(prev => ({ ...prev, [shopId]: false }));
    }
  };

  const executeRemoveCollaborator = async () => {
    if (!collabRemoveConfirm || !onUpdateShopCollaborators) return;
    const { shopId, email, idx, currentEmails, currentUids } = collabRemoveConfirm;
    setCollabRemoveConfirm(null);

    setIsCollabWorking(prev => ({ ...prev, [shopId]: true }));
    setCollabError(prev => ({ ...prev, [shopId]: '' }));
    setCollabSuccess(prev => ({ ...prev, [shopId]: '' }));

    try {
      const updatedEmails = currentEmails.filter(e => e !== email);
      const uidToRemove = currentUids[idx];
      const updatedUids = currentUids.filter(u => u !== uidToRemove);

      await onUpdateShopCollaborators(shopId, updatedEmails, updatedUids);
      setCollabSuccess(prev => ({ ...prev, [shopId]: 'సహాయకుడు విజయవంతంగా తొలగించబడ్డారు!' }));
      setTimeout(() => setCollabSuccess(prev => ({ ...prev, [shopId]: '' })), 5000);
    } catch (err: any) {
      setCollabError(prev => ({ ...prev, [shopId]: err?.message || 'కూటమి నుండి తొలగించడం విఫలమైంది.' }));
    } finally {
      setIsCollabWorking(prev => ({ ...prev, [shopId]: false }));
    }
  };

  if (selectedShopTxId) {
    const selectedShop = shops.find(s => s.id === selectedShopTxId);
    if (selectedShop) {
      const shopTxList = transactions.filter(tx => tx.shopId === selectedShopTxId);
      
      const filteredShopTxList = shopTxList.filter(tx => {
        const query = shopTxSearchQuery.toLowerCase().trim();
        if (!query) return true;
        return tx.customerName.toLowerCase().includes(query) ||
               (tx.notes && tx.notes.toLowerCase().includes(query)) ||
               tx.amount.toString().includes(query);
      });

      return (
        <div id="shop-transactions-page" className="space-y-6 animate-in fade-in duration-200 text-slate-800">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
            <button
              id="close-shop-tx-btn-p"
              onClick={() => { setSelectedShopTxId(null); setShopTxSearchQuery(''); }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold px-5 py-2.5 rounded-xl transition border border-gray-250 cursor-pointer text-xs group shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-600 group-hover:-translate-x-1 transition-transform" />
              <span>{language === 'te' ? 'తిరిగి దుకాణాల జాబితాకు' : 'Back to Shop Registry'}</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 border border-emerald-250 rounded-xl flex items-center justify-center text-emerald-750 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-905 flex items-center gap-2">
                  <span>{selectedShop.name}</span>
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-extrabold tracking-wide font-mono">
                    {shopTxList.length} {language === 'te' ? 'లావాదేవీలు' : 'Transactions'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  {language === 'te' ? 'ఈ దుకాణానికి సంబంధించిన అన్ని బకాయి/చెల్లింపుల రికార్డు' : 'All credit/payment records for this shop'}
                </p>
              </div>
            </div>
          </div>

          {/* Search bar and info */}
          <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{language === 'te' ? 'బకాయి వివరాల లీజర్ రికార్డు' : 'Due ledger records'}</h4>
            </div>

            {shopTxList.length > 0 && (
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  id="shop-tx-search-input-p"
                  type="text"
                  placeholder={language === 'te' ? 'కస్టమర్ పేరు లేదా వివరాలతో శోధించండి...' : 'Search by customer name, notes...'}
                  value={shopTxSearchQuery}
                  onChange={(e) => setShopTxSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800"
                />
              </div>
            )}

            {filteredShopTxList.length === 0 ? (
              <div className="text-center py-16 p-8 border border-dashed border-gray-200 rounded-xl bg-slate-50/50">
                <p className="text-sm text-slate-450 font-bold italic">
                  {shopTxList.length === 0 
                    ? (language === 'te' ? 'ఈ దుకాణానికి ఎటువంటి లావాదేవీలు లేవు.' : 'No transactions recorded for this shop.')
                    : (language === 'te' ? 'శోధనకు సరిపోలే లావాదేవీలు లేవు.' : 'No matching transactions found.')
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-150 rounded-xl shadow-2xs">
                {/* Desktop view (table) */}
                <table className="hidden md:table w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-extrabold text-gray-400">
                      <th className="px-6 py-3.5">{language === 'te' ? 'తేదీ' : 'Date'}</th>
                      <th className="px-6 py-3.5">{language === 'te' ? 'కస్టమర్ పేరు' : 'Customer Name'}</th>
                      <th className="px-6 py-3.5">{language === 'te' ? 'వివరాలు / నోట్స్' : 'Notes / Details'}</th>
                      <th className="px-6 py-3.5">{language === 'te' ? 'మొత్తం' : 'Amount'}</th>
                      <th className="px-6 py-3.5">{language === 'te' ? 'స్థితి' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                    {filteredShopTxList.map(tx => {
                      const isUnpaid = tx.status === 'Unpaid';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/30 transition">
                          <td className="px-6 py-4 font-mono text-gray-450 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString('te-IN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-extrabold text-slate-900 text-sm">
                            {tx.customerName}
                          </td>
                          <td className="px-6 py-4 text-gray-655 max-w-xs font-medium">
                            {tx.notes || <span className="text-gray-300 italic font-medium">{language === 'te' ? 'వివరాలు లేవు' : 'No details'}</span>}
                          </td>
                          <td className="px-6 py-4 font-mono font-extrabold whitespace-nowrap text-sm">
                            <span className={isUnpaid ? 'text-red-650' : 'text-emerald-650'}>
                              ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black leading-none uppercase ${
                              isUnpaid ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {tx.status === 'Unpaid' ? 'Unpaid' : 'Settled'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile view (list) - fully mobile responsive and highly readable */}
                <div className="block md:hidden bg-white divide-y divide-gray-150">
                  {filteredShopTxList.map(tx => {
                    const isUnpaid = tx.status === 'Unpaid';
                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => setActiveMobileBottomSheetTx(tx)}
                        className="p-4 space-y-2 hover:bg-slate-50/30 active:bg-slate-50/55 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-905 text-sm truncate max-w-[70%]">{tx.customerName}</span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isUnpaid ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {tx.status === 'Unpaid' ? (language === 'te' ? 'బాకీ' : 'Unpaid') : (language === 'te' ? 'చెల్లించినది' : 'Settled')}
                          </span>
                        </div>
                        {tx.notes && (
                          <p className="text-xs text-slate-600 truncate">{tx.notes}</p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-405 font-mono font-bold">
                            {new Date(tx.createdAt).toLocaleDateString('te-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`font-mono text-sm font-extrabold ${isUnpaid ? 'text-red-655' : 'text-emerald-655'}`}>
                            ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div id="shop-registry-view" className="space-y-6 animate-in fade-in duration-200 text-slate-800">
      
      {/* Edit Shop Modal */}
      {editingShop && (
        <div id="edit-shop-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[75]">
          <div id="edit-shop-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-905 text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                {t.editShopTitle}
              </h3>
              <button 
                onClick={() => setEditingShop(null)}
                className="text-gray-400 hover:text-gray-600 transition"
                disabled={isSavingEdit}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopNameLabel}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopPhoneLabel}</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopAddressField}</label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                />
              </div>

              {((currentUserEmail === 'naveenkumar31343@gmail.com' || currentUserEmail === 'akuthota.rajkumar@gmail.com')) && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    {language === 'te' ? 'యజమాని ఇమెయిల్ (Owner Email)' : 'Owner Email'}
                  </label>
                  <input
                    type="email"
                    required
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-850"
                  />
                  {editOwnerError && (
                    <p className="text-[10px] text-red-650 font-bold mt-1">{editOwnerError}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 border border-gray-200 text-gray-750 bg-white rounded-lg hover:bg-gray-50 text-xs font-bold"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.savingChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            {t.shopRegistryHeader}
          </h2>
          <p className="text-xs font-semibold text-slate-450 mt-1">
            {t.shopRegistrySub}
          </p>
        </div>

        {isSuperUser && !showAddForm && (
          <button
            id="register-shop-trigger"
            onClick={() => setShowAddForm(true)}
            className="self-start sm:self-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {t.registerShopBtn}
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          id="add-shop-form"
          onSubmit={handleCreateShop}
          className="bg-white border border-gray-150 p-6 rounded-2xl shadow-xs space-y-4 max-w-xl animate-in slide-in-from-top-4 duration-200"
        >
          <h3 className="font-extrabold text-slate-905 text-xs uppercase tracking-wider mb-2">{t.registerNewShopTitle}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopNameLabel}</label>
              <input
                id="shop-name-input"
                type="text"
                required
                placeholder="ఉదా. మాతా కిరాణా జనరల్ స్టోర్స్"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                {t.shopPhoneLabel} *
              </label>
              <input
                id="shop-phone-input"
                type="text"
                required
                placeholder="ఉదా. 9848012345"
                value={newShopPhone}
                onChange={(e) => setNewShopPhone(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopAddressField}</label>
            <input
              id="shop-address-input"
              type="text"
              placeholder="ఉదా. మెయిన్ రోడ్, బస్టాండ్ ఎదురుగా, కడప"
              value={newShopAddress}
              onChange={(e) => setNewShopAddress(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              {language === 'te' ? 'జీఎస్‌టీ సంఖ్య (GST Number) *' : 'GST Number *'}
            </label>
            <input
              id="shop-gst-input"
              type="text"
              required
              placeholder="e.g. 37AAAAA0000A1Z5"
              value={newShopGst}
              onChange={(e) => setNewShopGst(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
            />
          </div>

          {isSuperUser && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                {language === 'te' ? 'యజమాని ఇమెయిల్ (Owner Email) *' : 'Owner Email *'}
              </label>
              <input
                id="shop-owner-email-input"
                type="email"
                required
                placeholder="e.g. owner@gmail.com"
                value={newShopOwnerEmail}
                onChange={(e) => setNewShopOwnerEmail(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-slate-900"
              />
            </div>
          )}

          {shopError && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100">
              {shopError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              id="cancel-shop-submit-btn"
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setShopError('');
              }}
              className="px-4 py-2 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 text-xs font-bold transition cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              id="confirm-shop-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t.creatingShopText : (language === 'te' ? 'నమోదు చేయి' : 'Register')}
            </button>
          </div>
        </form>
      )}

      {/* Grid of registered shops */}
      {shops.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-150 p-8 max-w-xl mx-auto">
          <div className="w-12 h-12 bg-gray-50 border border-gray-150 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
            <Store className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t.shopNoShops}</h3>
          <p className="text-slate-500 text-xs mt-1">
            {t.shopNoShopsDesc}
          </p>
          {isSuperUser && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
            >
              {t.addFirstShopBtn}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shops.map(shop => {
            const stats = shopStats[shop.id] || { totalUnpaid: 0, customerCount: 0 };
            const isDeletingTarget = confirmDeleteId === shop.id;

            const isOwner = shop.ownerId === currentUserId || isSuperUser;
            const emails = shop.collaboratorEmails || [];
            const uids = shop.collaboratorIds || [];
            const ownerMerchant = merchants?.find(m => m.uid === shop.ownerId);
            const ownerName = ownerMerchant?.displayName || ownerMerchant?.email || shop.ownerId;

            return (
              <div
                id={`shop-card-${shop.id}`}
                key={shop.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition ${
                  selectedShopTxId === shop.id ? 'border-emerald-550 ring-2 ring-emerald-550/15 bg-slate-50/50' : 'border-gray-150'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold">
                        <button
                          onClick={() => setViewingHistoryShop(shop)}
                          className="flex items-center gap-2 text-emerald-650 hover:text-emerald-800 hover:underline text-left cursor-pointer transition font-bold"
                          title={language === 'te' ? 'దుకాణ వివరాల మార్పుల చరిత్రను చూపించు' : 'Click to see details change history of this shop'}
                        >
                          <Store className="w-5 h-5 shrink-0 text-emerald-600" />
                          <span>{shop.name}</span>
                        </button>
                      </h3>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {t.profileRegisterDate}: {new Date(shop.createdAt).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN')}
                      </p>
                    </div>

                    {isOwner && (
                      <button
                        onClick={() => handleStartEdit(shop)}
                        className="p-1 px-2 text-[10px] font-bold text-slate-650 bg-slate-50 hover:bg-slate-100 rounded border border-gray-200 cursor-pointer flex items-center gap-1 transition"
                      >
                        <Edit2 className="w-3 h-3 text-emerald-650" />
                        {t.actionEdit}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-gray-150/40">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.unpaidBalanceLabel}</span>
                      <p className="font-mono text-red-600 font-extrabold text-base">
                        ${stats.totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {language === 'te' ? 'బాకీదారులు' : 'Debtors'}
                      </span>
                      <p className="font-mono text-slate-900 font-bold text-base font-sans">
                        {stats.customerCount} {language === 'te' ? 'మంది' : 'customers'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-gray-100 font-semibold">
                    {shop.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-450" />
                        <span className="font-semibold text-slate-700">{shop.phone}</span>
                      </div>
                    )}
                    {shop.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-450 shrink-0 mt-0.5" />
                        <span className="font-semibold text-slate-700 leading-tight">{shop.address}</span>
                      </div>
                    )}
                    {shop.gstNumber && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded border border-gray-200">
                          GST: {shop.gstNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Collaborators Management Segment */}
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                        <Users className="w-4.5 h-4.5 text-emerald-600" />
                        {t.collabTitle} ({emails.length})
                      </span>
                      {isOwner ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {t.coOwnerLabel}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-100 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {t.shopCollaboratorsLabel}
                        </span>
                      )}
                    </div>

                    {/* Collaborator Emails List */}
                    {emails.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {emails.map((email, idx) => (
                          <div 
                            key={email} 
                            className="bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-xs text-slate-700 font-semibold flex items-center gap-1.5"
                          >
                            <span>{email}</span>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCollabRemoveConfirm({
                                    shopId: shop.id,
                                    email: email,
                                    idx: idx,
                                    currentEmails: emails,
                                    currentUids: uids
                                  });
                                }}
                                className="text-slate-400 hover:text-red-650 transition ml-0.5 cursor-pointer rounded-full p-0.5"
                                title="Remove Collaborator"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-bold italic">{t.shopNoCollaborators}</p>
                    )}

                    {/* Add Collaborator Form (Owners Only) */}
                    {isOwner ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder={t.addPartnerPlaceholder}
                            value={collabEmailInput[shop.id] || ''}
                            onChange={(e) => setCollabEmailInput(prev => ({ ...prev, [shop.id]: e.target.value }))}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                await handleAddCollaborator(shop.id, emails, uids);
                              }
                            }}
                            className="flex-1 bg-slate-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-600 font-semibold text-slate-800"
                          />
                          <button
                            type="button"
                            disabled={isCollabWorking[shop.id]}
                            onClick={() => handleAddCollaborator(shop.id, emails, uids)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3 rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {t.addPartnerBtn}
                          </button>
                        </div>
                        {collabError[shop.id] && (
                          <p className="text-[10px] text-red-650 font-semibold">{collabError[shop.id]}</p>
                        )}
                        {collabSuccess[shop.id] && (
                          <p className="text-[10px] text-green-700 font-semibold">{collabSuccess[shop.id]}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-450 bg-slate-50 p-2 rounded-lg border border-gray-150 font-bold">
                        {t.merchantOwnerName}: <span className="font-semibold text-slate-705">{ownerName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* SECURED CONFIRMATION BANNER FOR DELETION */}
                <div className="pt-4 border-t border-gray-150 flex items-center justify-between font-bold">
                  {isDeletingTarget ? (
                    <div
                      id={`delete-confirm-banner-${shop.id}`}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 w-full animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-normal">
                          <p className="font-extrabold text-amber-950 mb-1">
                            {language === 'te' ? 'దుకాణ వివరాల తొలగింపును ధృవీకరించండి' : 'Confirm Shop Deregistration'}
                          </p>
                          {language === 'te' ? (
                            <>
                              మీరు ఖచ్చితంగా <strong className="font-extrabold text-amber-950">{shop.name}</strong> ని తొలగించాలనుకుంటున్నారా? 
                              ఈ చర్యవల్ల దుకాణం నమోదు రద్దవుతుంది. పూర్వ లావాదేవీల రికార్డులు అలాగే ఉంటాయి.
                            </>
                          ) : (
                            <>
                              Are you sure you want to delete <strong className="font-extrabold text-amber-950">{shop.name}</strong>? 
                              This action will de-register the shop. Historical transactions will remain.
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          id={`cancel-delete-shop-${shop.id}`}
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 border border-amber-250 bg-white text-slate-700 rounded-lg hover:bg-gray-50 font-extrabold transition disabled:opacity-50 cursor-pointer"
                        >
                          {t.deleteNo}
                        </button>
                        <button
                          id={`confirm-delete-shop-${shop.id}`}
                          disabled={isDeleting || !isOwner}
                          onClick={() => handleConfirmDelete(shop.id)}
                          className="px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-lg font-extrabold transition flex items-center gap-1 disabled:opacity-50 cursor-pointer animate-pulse"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {language === 'te' ? 'తొలగిస్తున్నారు...' : 'Deleting...'}
                            </>
                          ) : (
                            language === 'te' ? 'శాశ్వతంగా తొలగించు' : 'Permanently Delete'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isOwner ? (
                        <button
                          id={`delete-shop-btn-${shop.id}`}
                          onClick={() => setConfirmDeleteId(shop.id)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-orange-50 text-orange-750 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-orange-100/40"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-orange-650" />
                          {language === 'te' ? 'దుకాణ నమోదు రద్దుచేయి' : 'Deregister Shop'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          {language === 'te' ? 'యాక్సెస్ భాగస్వామ్యం మాత్రమే' : 'Shared Access Only'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Shop Transactions Detail Section */}
      {selectedShopTxId && (
        (() => {
          const selectedShop = shops.find(s => s.id === selectedShopTxId);
          if (!selectedShop) return null;

          const shopTxList = transactions.filter(tx => tx.shopId === selectedShopTxId);
          
          // Filter dynamically by search query
          const filteredShopTxList = shopTxList.filter(tx => {
            const query = shopTxSearchQuery.toLowerCase().trim();
            if (!query) return true;
            return tx.customerName.toLowerCase().includes(query) ||
                   (tx.notes && tx.notes.toLowerCase().includes(query)) ||
                   tx.amount.toString().includes(query);
          });

          return (
            <div 
              id="shop-transactions-detail-panel" 
              className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-750 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 leading-none flex items-center gap-2">
                      <span>{selectedShop.name}</span>
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-extrabold tracking-wide">
                        {shopTxList.length} {language === 'te' ? 'లావాదేవీలు' : 'Transactions'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-450 font-bold mt-1.5">
                      {language === 'te' ? 'ఈ దుకాణానికి సంబంధించిన అన్ని బకాయి/చెల్లింపుల రికార్డు' : 'All credit/payment records for this shop'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="close-shop-tx-btn"
                  onClick={() => setSelectedShopTxId(null)}
                  className="p-1 px-2.5 bg-slate-200/65 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-extrabold transition cursor-pointer self-start sm:self-auto border border-slate-300/40"
                >
                  {language === 'te' ? 'మూసివేయి ✕' : 'Close ✕'}
                </button>
              </div>

              {/* SEARCH FILTER */}
              {shopTxList.length > 0 && (
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="shop-tx-search-input"
                    type="text"
                    placeholder={language === 'te' ? 'కస్టమర్ పేరు లేదా వివరాలతో శోధించండి...' : 'Search by customer name, notes...'}
                    value={shopTxSearchQuery}
                    onChange={(e) => setShopTxSearchQuery(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-800"
                  />
                </div>
              )}

              {/* TRANSACTIONS LIST */}
              {filteredShopTxList.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 p-6">
                  <p className="text-sm text-slate-400 font-bold italic">
                    {shopTxList.length === 0 
                      ? (language === 'te' ? 'ఈ దుకాణానికి ఎటువంటి లావాదేవీలు లేవు.' : 'No transactions recorded for this shop.')
                      : (language === 'te' ? 'శోధనకు సరిపోలే లావాదేవీలు లేవు.' : 'No matching transactions found.')
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden bg-white rounded-xl border border-gray-150 shadow-3xs divide-y divide-gray-100">
                  {filteredShopTxList.map((tx) => {
                    const txDate = new Date(tx.createdAt).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900">{tx.customerName}</span>
                            <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                              tx.status === 'Paid'
                                ? 'bg-green-50 text-green-700 border-green-150 font-bold'
                                : 'bg-red-50 text-red-650 border-red-150 font-bold'
                            }`}>
                              {tx.status === 'Paid' ? (language === 'te' ? 'చెల్లించబడింది' : 'Paid') : (language === 'te' ? 'బాకీ' : 'Unpaid')}
                            </span>
                          </div>
                          {tx.notes && (
                            <p className="text-xs text-slate-500 font-medium">
                              {tx.notes}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-bold font-mono">
                            {txDate}
                          </p>
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 text-right shrink-0">
                          ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* SHOP AUDIT LOG CHANGE HISTORY MODAL overlay */}
      {viewingHistoryShop && (() => {
        const shopLogs = auditLogs.filter(log => log.itemType === 'Shop' && log.itemId === viewingHistoryShop.id);
        return (
          <div id="shop-history-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-in fade-in duration-200">
            <div id="shop-history-modal-card" className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-6 border border-gray-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-905 text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" />
                    <span>{viewingHistoryShop.name} - {language === 'te' ? 'మార్పుల చరిత్ర' : 'Change History'}</span>
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {language === 'te' ? 'దుకాణం వివరాల మార్పు రికార్డులు' : 'Audit trail records of shop metadata updates'}
                  </p>
                </div>
                <button 
                  onClick={() => setViewingHistoryShop(null)}
                  className="text-gray-400 hover:text-gray-600 transition p-1 cursor-pointer bg-slate-50 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {shopLogs.length === 0 ? (
                  <div className="text-center py-12 p-6">
                    <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-700">{language === 'te' ? 'మార్పు రికార్డులు ఏవీ లేవు' : 'No Modification Logs Available'}</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {language === 'te' ? 'ఈ షాపు కొరకు ఎలాంటి మార్పు రికార్డులు లభించలేదు.' : 'No audit entries were recorded for this shop details so far.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {shopLogs.map(log => (
                      <div key={log.id} className="p-4 hover:bg-slate-50/45 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                          <span className="text-[10px] font-black uppercase font-mono tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-md px-2 py-0.5">
                            {getActionTypeLabel(log.actionType, language)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            {new Date(log.createdAt).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-normal">
                          {language === 'te' ? log.detailsTe : log.details}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <span>{language === 'te' ? 'నిర్వహించిన వారు' : 'Performed By'}:</span>
                          <span className="text-slate-700 font-extrabold">{log.performedByName}</span>
                          <span className="text-slate-400 font-mono">({log.performedByEmail})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewingHistoryShop(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {language === 'te' ? 'మూసిވެయి' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal to Add Collaborator */}
      {collabAddConfirm && (
        <div id="collab-add-confirm-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99] animate-in fade-in duration-200">
          <div id="collab-add-confirm-card" className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border-l-4 border-emerald-600 animate-in zoom-in-95 duration-250">
            <h3 className="text-base font-extrabold text-gray-905 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>{language === 'te' ? 'వ్యాపార సహాయకుడిని జోడించాలా?' : 'Add Collaborator Confirmation'}</span>
            </h3>
            <p className="text-xs font-semibold text-slate-600 mt-3 leading-relaxed">
              {language === 'te' ? (
                <>
                  మీరు నిజంగా <strong className="font-extrabold text-slate-900">{collabAddConfirm.email}</strong> ని సహాయకుడిగా జోడించాలనుకుంటున్నారా? 
                  జోడించిన తర్వాత, వారు ఈ దుకాణంలోని లావాదేవీలను చూడగలరు మరియు మార్పులు చేయగలరు.
                </>
              ) : (
                <>
                  Are you sure you want to add <strong className="font-extrabold text-slate-900">{collabAddConfirm.email}</strong> as a collaborator for this shop? 
                  Once added, they will have access to view and manage transactions for this shop.
                </>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2 text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setCollabAddConfirm(null)}
                className="px-4 py-2 border border-gray-200 text-slate-700 bg-white rounded-lg hover:bg-gray-50 cursor-pointer min-h-[44px]"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={executeAddCollaborator}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg cursor-pointer min-h-[44px]"
              >
                {language === 'te' ? 'అవును, జోడించు' : 'Yes, Add Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Remove Collaborator */}
      {collabRemoveConfirm && (
        <div id="collab-remove-confirm-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99] animate-in fade-in duration-200">
          <div id="collab-remove-confirm-card" className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border-l-4 border-red-500 animate-in zoom-in-95 duration-250">
            <h3 className="text-base font-extrabold text-gray-905 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>{language === 'te' ? 'సహాయకుడిని తొలగించాలా?' : 'Remove Collaborator'}</span>
            </h3>
            <p className="text-xs font-semibold text-slate-600 mt-3 leading-relaxed">
              {language === 'te' ? (
                <>
                  మీరు <strong className="font-extrabold text-slate-900">{collabRemoveConfirm.email}</strong> ని ఈ దుకాణం సహాయక బృందం నుండి తొలగించాలనుకుంటున్నారా?
                  తొలగించిన తర్వాత శూన్యమైన అనుమతులతో వారు ఈ దుకాణ వివరాలను యాక్సెస్ చేయలేరు.
                </>
              ) : (
                <>
                  Are you sure you want to remove <strong className="font-extrabold text-slate-900">{collabRemoveConfirm.email}</strong> from this shop's collaborator team? 
                  Once removed, they will immediately lose all permissions to access this shop's details.
                </>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2 text-xs font-bold font-sans">
              <button
                type="button"
                onClick={() => setCollabRemoveConfirm(null)}
                className="px-4 py-2 border border-gray-200 text-slate-700 bg-white rounded-lg hover:bg-gray-50 cursor-pointer min-h-[44px]"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={executeRemoveCollaborator}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg cursor-pointer min-h-[44px]"
              >
                {language === 'te' ? 'అవును, తొలగించు' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Sheet Component */}
      {activeMobileBottomSheetTx && (
        <div className="fixed inset-0 z-[90] md:hidden">
          {/* Backdrop */}
          <div 
            onClick={() => setActiveMobileBottomSheetTx(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />

          {/* Bottom Sheet Container */}
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl z-[100] border-t border-gray-150 overflow-hidden flex flex-col max-h-[80vh] h-[65vh] animate-in slide-in-from-bottom duration-300 ease-out">
            {/* Drag Handle Indicator */}
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="px-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{activeMobileBottomSheetTx.customerName}</span>
              </h3>
              <button 
                onClick={() => setActiveMobileBottomSheetTx(null)}
                className="p-1 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-650 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrolling Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-28">
              {/* Date */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'తేదీ' : 'Date'}</span>
                <span className="font-mono text-slate-800">{new Date(activeMobileBottomSheetTx.createdAt).toLocaleDateString('te-IN')}</span>
              </div>

              {/* Shop Location */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'దుకాణం' : 'Shop Location'}</span>
                <span className="text-slate-800">{activeMobileBottomSheetTx.shopName}</span>
              </div>

              {/* Amount Due & Status */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'మొత్తం' : 'Amount Due'}</span>
                <span className="font-mono text-slate-800 font-black text-sm">
                  {activeMobileBottomSheetTx.amount < 0 ? (
                    <span className="text-blue-650">
                      - ₹{Math.abs(activeMobileBottomSheetTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className={activeMobileBottomSheetTx.status === 'Unpaid' ? 'text-red-655 font-bold' : 'text-emerald-655 font-bold'}>
                      ₹{activeMobileBottomSheetTx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 font-bold text-xs">
                <span className="text-slate-400">{language === 'te' ? 'స్థితి' : 'Status'}</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black leading-none uppercase ${
                  activeMobileBottomSheetTx.amount < 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : activeMobileBottomSheetTx.status === 'Unpaid'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {activeMobileBottomSheetTx.amount < 0
                    ? (language === 'te' ? 'జమ (payment)' : 'Payment')
                    : activeMobileBottomSheetTx.status === 'Unpaid'
                      ? 'Unpaid'
                      : 'Settled'}
                </span>
              </div>

              {/* Comments / Notes */}
              <div className="py-2.5 space-y-1 text-xs">
                <span className="text-slate-400 font-bold">{language === 'te' ? 'వివరాలు / నోట్స్' : 'Comments & Notes'}</span>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-slate-750 font-medium leading-relaxed whitespace-normal break-words">
                  {activeMobileBottomSheetTx.notes || <span className="text-slate-350 italic font-medium">{language === 'te' ? 'వివరాలు లేవు' : 'No description logged'}</span>}
                </div>
              </div>

              {/* Creator & Editor details */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-[10px] font-semibold text-slate-500">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">{language === 'te' ? 'సృష్టించినది' : 'Created By'}</span>
                  <span className="text-slate-800 font-bold">{activeMobileBottomSheetTx.createdByName || 'System/Merchant'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">{language === 'te' ? 'చివరి సవరణ' : 'Updated By'}</span>
                  <span className="text-slate-800 font-bold">{activeMobileBottomSheetTx.updatedByName || activeMobileBottomSheetTx.createdByName || 'System/Merchant'}</span>
                </div>
              </div>
            </div>

            {/* Anchored bottom button bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-150 p-4 pb-6 flex gap-2.5 z-[110]">
              <button
                onClick={() => setActiveMobileBottomSheetTx(null)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                {language === 'te' ? 'పూర్తయింది' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
