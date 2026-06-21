/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Shop, Transaction } from '../types';
import { useLanguage } from '../lib/translations';
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
  Search,
  FileText
} from 'lucide-react';

interface ShopRegistryProps {
  shops: Shop[];
  transactions: Transaction[];
  onAddShop: (name: string, phone: string, address: string) => Promise<void>;
  onUpdateShop: (shopId: string, name: string, phone: string, address: string) => Promise<void>;
  onDeleteShop: (shopId: string) => Promise<void>;
  currentUserId: string;
  currentUserEmail?: string;
  onUpdateShopCollaborators?: (shopId: string, emails: string[], uids: string[]) => Promise<void>;
  onGetMerchantByEmail?: (email: string) => Promise<{ uid: string; email: string | null; displayName: string | null } | null>;
}

export default function ShopRegistry({
  shops,
  transactions,
  onAddShop,
  onUpdateShop,
  onDeleteShop,
  currentUserId,
  currentUserEmail,
  onUpdateShopCollaborators,
  onGetMerchantByEmail,
}: ShopRegistryProps) {
  const { t, language } = useLanguage();
  const [selectedShopTxId, setSelectedShopTxId] = useState<string | null>(null);
  const [shopTxSearchQuery, setShopTxSearchQuery] = useState('');

  // Add Shop states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Shop states
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deletion state tracker (stores shop ID when delete clicked)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Collaborator interactions state
  const [collabEmailInput, setCollabEmailInput] = useState<Record<string, string>>({});
  const [isCollabWorking, setIsCollabWorking] = useState<Record<string, boolean>>({});
  const [collabError, setCollabError] = useState<Record<string, string>>({});
  const [collabSuccess, setCollabSuccess] = useState<Record<string, string>>({});

  const isSuperUser = currentUserEmail === 'naveenkumar31343@gmail.com';

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
    if (!newShopName.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddShop(newShopName.trim(), newShopPhone.trim(), newShopAddress.trim());
      setNewShopName('');
      setNewShopPhone('');
      setNewShopAddress('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditPhone(shop.phone);
    setEditAddress(shop.address);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      await onUpdateShop(editingShop.id, editName.trim(), editPhone.trim(), editAddress.trim());
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

    setIsCollabWorking(prev => ({ ...prev, [shopId]: true }));
    setCollabError(prev => ({ ...prev, [shopId]: '' }));
    setCollabSuccess(prev => ({ ...prev, [shopId]: '' }));

    try {
      let targetUid = '';
      if (onGetMerchantByEmail) {
        const m = await onGetMerchantByEmail(input);
        if (m) {
          targetUid = m.uid;
        }
      }

      const updatedEmails = [...currentEmails, input];
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

        {!showAddForm && (
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
              <label className="block text-xs font-bold text-slate-400 mb-1">{t.shopPhoneLabel}</label>
              <input
                id="shop-phone-input"
                type="text"
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              id="cancel-shop-submit-btn"
              type="button"
              onClick={() => setShowAddForm(false)}
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
              {t.creatingShopText}
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
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
          >
            {t.addFirstShopBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shops.map(shop => {
            const stats = shopStats[shop.id] || { totalUnpaid: 0, customerCount: 0 };
            const isDeletingTarget = confirmDeleteId === shop.id;

            const isOwner = shop.ownerId === currentUserId || isSuperUser;
            const emails = shop.collaboratorEmails || [];
            const uids = shop.collaboratorIds || [];

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
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Store className="w-5 h-5 text-emerald-600" />
                        {shop.name}
                      </h3>
                      <p className="text-[10px] font-mono font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        నమోదైన తేదీ: {new Date(shop.createdAt).toLocaleDateString('te-IN')}
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">బాకీదారులు</span>
                      <p className="font-mono text-slate-900 font-bold text-base font-sans">
                        {stats.customerCount} మంది
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
                                onClick={async () => {
                                  const updatedEmails = emails.filter(e => e !== email);
                                  const uidToRemove = uids[idx];
                                  const updatedUids = uids.filter(u => u !== uidToRemove);
                                  if (onUpdateShopCollaborators) {
                                    await onUpdateShopCollaborators(shop.id, updatedEmails, updatedUids);
                                  }
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
                      <p className="text-[10px] text-slate-450 font-mono bg-slate-50 p-2 rounded-lg border border-gray-150 font-bold">
                        లెడ్జర్ ఓనర్ ఐడి: <span className="font-semibold text-slate-705">{shop.ownerId.slice(0, 16)}...</span>
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
                          <p className="font-extrabold text-amber-950 mb-1">దుకాణ వివరాల తొలగింపును ధృవీకరించండి</p>
                          మీరు ఖచ్చితంగా <strong className="font-extrabold text-amber-950">{shop.name}</strong> ని తొలగించాలనుకుంటున్నారా? 
                          ఈ చర్యవల్ల దుకాణం నమోదు రద్దవుతుంది. పూర్వ లావాదేవీల రికార్డులు అలాగే ఉంటాయి.
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
                              తొలగిస్తున్నారు...
                            </>
                          ) : (
                            'శాశ్వతంగా తొలగించు'
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
                          దుకాణ నమోదు రద్దుచేయి
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          యాక్సెస్ భాగస్వామ్యం మాత్రమే
                        </span>
                      )}

                      <button
                        type="button"
                        id={`view-shop-tx-btn-${shop.id}`}
                        onClick={() => setSelectedShopTxId(selectedShopTxId === shop.id ? null : shop.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          selectedShopTxId === shop.id
                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {selectedShopTxId === shop.id 
                          ? (language === 'te' ? 'లావాదేవీలు దాచు' : 'Hide Transactions') 
                          : (language === 'te' ? 'లావాదేవీలు చూడండి' : 'View Transactions')
                        }
                      </button>
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
    </div>
  );
}
