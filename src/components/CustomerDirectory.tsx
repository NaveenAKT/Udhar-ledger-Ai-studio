/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Transaction, LedgerUser } from '../types';
import { useLanguage } from '../lib/translations';
import { Search, UserPlus, Phone, Store, ArrowRight, UserCheck, Edit2, X, Loader2, Mail, Trash2, AlertTriangle } from 'lucide-react';

interface CustomerDirectoryProps {
  customers: Customer[];
  transactions: Transaction[];
  currentUser: LedgerUser | null;
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomerClick: () => void;
  onUpdateCustomer: (customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
  hasShops?: boolean;
  onGoToAddShop?: () => void;
}

export default function CustomerDirectory({
  customers,
  transactions,
  currentUser,
  onSelectCustomer,
  onAddCustomerClick,
  onUpdateCustomer,
  onDeleteCustomer,
  hasShops = true,
  onGoToAddShop,
}: CustomerDirectoryProps) {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editVillage, setEditVillage] = useState('');
  const [editMandal, setEditMandal] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperUser = currentUser?.email === 'naveenkumar31343@gmail.com' || currentUser?.email === 'akuthota.rajkumar@gmail.com';

  // Pre-calculate statistics for each customer to show on card
  const customerStats = useMemo(() => {
    const stats: Record<string, { totalUnpaid: number; uniqueShopsCount: number }> = {};

    customers.forEach(c => {
      stats[c.id] = { totalUnpaid: 0, uniqueShopsCount: 0 };
    });

    const customerUnpaidShops: Record<string, Set<string>> = {};
    customers.forEach(c => {
      customerUnpaidShops[c.id] = new Set<string>();
    });

    transactions.forEach(tx => {
      if (tx.status === 'Unpaid' && stats[tx.customerId]) {
        stats[tx.customerId].totalUnpaid += tx.amount;
        if (customerUnpaidShops[tx.customerId]) {
          customerUnpaidShops[tx.customerId].add(tx.shopId);
        }
      }
    });

    customers.forEach(c => {
      if (stats[c.id]) {
        stats[c.id].uniqueShopsCount = customerUnpaidShops[c.id]?.size || 0;
      }
    });

    return stats;
  }, [customers, transactions]);

  // Real-time optimized text filter
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
  }, [customers, searchQuery]);

  const customerToDelete = useMemo(() => {
    return customers.find(c => c.id === confirmDeleteId) || null;
  }, [customers, confirmDeleteId]);

  // Open Edit Dialog
  const handleStartEdit = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation(); // prevent card click / select redirection
    setEditingCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditEmail(c.email || '');
    setEditVillage(c.village || '');
    setEditMandal(c.mandal || '');
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;

    if (!editPhone.trim()) {
      setEditError(language === 'te' ? 'మొబైల్ సంఖ్య తప్పనిసరి!' : 'Mobile number is mandatory!');
      return;
    }

    const phoneClean = editPhone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      setEditError(language === 'te' ? 'మొబైల్ ఫోన్ నంబర్ ఖచ్చితంగా 10 అంకెలు మాత్రమే ఉండాలి!' : 'Phone number must be exactly 10 digits!');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      await onUpdateCustomer(
        editingCustomer.id, 
        editName.trim(), 
        phoneClean, 
        editEmail.trim(), 
        editVillage.trim(), 
        editMandal.trim()
      );
      setEditingCustomer(null);
    } catch (err: any) {
      setEditError(err.message || "వివరాలను సవరించడంలో లోపం బంధించబడింది.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div id="customer-directory-view" className="space-y-6 animate-in fade-in duration-200 text-slate-800">
      
      {/* Edit Customer Dialog */}
      {editingCustomer && (
        <div id="edit-customer-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[85]">
          <div id="edit-customer-modal-card" className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-bold text-gray-905 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                {t.editCustomerTitle}
              </h3>
              <button 
                onClick={() => setEditingCustomer(null)}
                className="text-gray-400 hover:text-gray-600 transition"
                disabled={isSavingEdit}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSuperUser && (
              <div className="bg-blue-50/50 text-blue-700 text-[10px] font-bold uppercase tracking-wider p-2 px-3 rounded-lg border border-blue-100/50 mb-3">
                {t.superEditAllLabel}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerNameLabel}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerPhoneLabel}</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">{t.newCustomerEmailLabel}</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t.customerVillageLabel}</label>
                  <input
                    type="text"
                    placeholder={t.customerVillagePlaceholder}
                    value={editVillage}
                    onChange={(e) => setEditVillage(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">{t.customerMandalLabel}</label>
                  <input
                    type="text"
                    placeholder={t.customerMandalPlaceholder}
                    value={editMandal}
                    onChange={(e) => setEditMandal(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              {editError && (
                <p className="text-xs text-red-650 font-bold bg-red-50 p-2.5 rounded-lg border border-red-100">{editError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 border border-gray-200 text-gray-700 bg-white rounded-lg hover:bg-gray-50 text-xs font-semibold"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.savingChangesBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {confirmDeleteId && customerToDelete && (
        <div id="delete-customer-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-[90]" onClick={() => !isDeleting && setConfirmDeleteId(null)}>
          <div 
            id="delete-customer-modal-card" 
            className="bg-white w-full sm:max-w-md p-6 pb-8 sm:pb-6 rounded-t-3xl sm:rounded-2xl shadow-xl border border-gray-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-red-605">
                <AlertTriangle className="w-5 h-5 animate-pulse shrink-0 text-red-600" />
                <h3 className="font-extrabold text-base text-red-950">
                  {language === 'te' ? 'కస్టమర్ తొలగింపు నిర్ధారణ' : 'Confirm Customer Deletion'}
                </h3>
              </div>
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                disabled={isDeleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-xs text-red-950 font-semibold space-y-2">
                <p className="text-sm font-bold text-red-950">
                  {language === 'te' ? `కస్టమర్: ${customerToDelete.name}` : `Customer: ${customerToDelete.name}`}
                </p>
                {customerToDelete.phone && (
                  <p className="font-mono text-slate-500">
                    {language === 'te' ? `ఫోన్ నంబర్: ${customerToDelete.phone}` : `Phone: ${customerToDelete.phone}`}
                  </p>
                )}
                <div className="pt-2 border-t border-red-200/50 text-[11px] leading-relaxed text-red-900">
                  {language === 'te' 
                    ? '🔴 హెచ్చరిక: ఈ కస్టమర్‌ను తొలగిస్తే వారి అన్ని అనుబంధిత బకాయి మరియు చెల్లింపు లావాదేవీలు (Transactions) కూడా స్వయంచాలకంగా శాశ్వతంగా తొలగించబడతాయి. ఈ చర్యను తిరిగి మార్చలేము.' 
                    : '🔴 CRITICAL WARNING: Deleting this customer will automatically cascade and permanently delete all of their outstanding dues, ledger history, and payments recorded across all shops in our system. This action cannot be undone.'}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await onDeleteCustomer(customerToDelete.id);
                    } catch (err) {
                      console.error("Delete customer failed:", err);
                    } finally {
                      setIsDeleting(false);
                      setConfirmDeleteId(null);
                    }
                  }}
                  className="w-full h-12 bg-red-650 hover:bg-red-750 disabled:bg-red-300 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm transition active:scale-98"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {language === 'te' ? 'అవును, కస్టమర్ & బకాయిలను శాశ్వతంగా తొలగించు' : 'Yes, Delete Customer & All Transactions'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={isDeleting}
                  className="w-full h-12 border border-slate-300 bg-white text-slate-750 rounded-xl hover:bg-slate-50 text-sm font-extrabold transition cursor-pointer active:scale-98"
                >
                  {t.deleteNo || "రద్దు చేయి"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600" />
            {t.custDirTitle}
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {t.custDirSub}
          </p>
        </div>
        
        {hasShops ? (
          <button
            id="add-customer-trigger-btn"
            onClick={onAddCustomerClick}
            className="self-start sm:self-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs group cursor-pointer"
          >
            <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            {t.registerCustomerBtn}
          </button>
        ) : (
          <button
            id="add-shop-trigger-from-cust-btn"
            onClick={onGoToAddShop}
            className="self-start sm:self-center bg-amber-655 hover:bg-amber-700 bg-amber-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs group cursor-pointer"
          >
            <Store className="w-4 h-4 group-hover:scale-110 transition-transform" />
            {language === 'te' ? 'దుకాణాన్ని జోడించు (Add Shop)' : 'Add Shop'}
          </button>
        )}
      </div>

      {/* Real-time live search filter input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          id="customer-search-input"
          type="text"
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-150 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900 placeholder-slate-400 font-medium transition shadow-xs font-semibold"
        />
        {searchQuery && (
          <button
            id="clear-search-btn"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-3.5 text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            {t.clearBtn}
          </button>
        )}
      </div>

      {/* Grid of customer cards */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-150 p-8 max-w-xl mx-auto">
          <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t.noCustomersFound}</h3>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            {searchQuery 
              ? "శోధన పదానికి మ్యాచ్ అయ్యే కస్టమర్లెవరూ లభ్యం కాలేదు." 
              : "యాక్టివ్ బకాయిల నిర్వహణ కోసం మీ మొదటి కస్టమర్‌ను నమోదు చేసుకోండి."
            }
          </p>
          {!searchQuery && (
            hasShops ? (
              <button
                onClick={onAddCustomerClick}
                className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                {t.addFirstCustomerBtn}
              </button>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 inline-block border border-amber-200 font-bold max-w-sm">
                  ⚠️ {language === 'te' 
                    ? 'కస్టమర్లను జోడించడానికి మొదట దుకాణాన్ని సృష్టించండి ("దుకాణాల రిజిస్ట్రీ" ట్యాబ్‌కు వెళ్లండి).' 
                    : 'Please register a shop first under the "Shops Registry" tab to start adding customers.'
                  }
                </p>
                <button
                  type="button"
                  onClick={onGoToAddShop}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Store className="w-4 h-4" />
                  {language === 'te' ? 'దుకాణాన్ని జోడించు (Add Shop)' : 'Add Shop'}
                </button>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map(customer => {
            const stats = customerStats[customer.id] || { totalUnpaid: 0, uniqueShopsCount: 0 };
            const isOwes = stats.totalUnpaid > 0;
            const canEditCustomer = isSuperUser || (currentUser && customer.ownerId === currentUser.uid);

            return (
              <div
                id={`customer-card-${customer.id}`}
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className="group bg-white border border-gray-150 hover:border-emerald-600 rounded-2xl p-5 hover:shadow-md transition duration-200 flex flex-col justify-between cursor-pointer relative"
              >
                {isOwes && (
                  <span className="absolute top-4 right-4 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-red-100 font-mono">
                    {t.activeDebtTag}
                  </span>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors pr-16 truncate flex items-center gap-2">
                      {customer.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-slate-500 text-xs font-semibold mt-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-450" />
                        <span>{customer.phone}</span>
                      </div>
                      {(customer.village || customer.mandal) && (
                        <div className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-gray-200 font-bold tracking-wide">
                          {customer.village}{customer.mandal ? ` - ${customer.mandal}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t.unpaidBalanceLabel}
                      </span>
                      <div className="flex items-baseline font-mono">
                        <span className={`text-lg font-extrabold ${isOwes ? 'text-red-650' : 'text-slate-500'}`}>
                          ₹{stats.totalUnpaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {t.shopsOwedLabel}
                      </span>
                      <div className="flex items-center gap-1.5 font-bold text-slate-905 text-sm">
                        <Store className="w-4 h-4 text-emerald-650 shrink-0" />
                        <span>{stats.uniqueShopsCount} {stats.uniqueShopsCount === 1 ? t.shopPlural : t.shopsPlural}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100/60 flex items-center justify-between text-xs text-slate-400 font-bold group-hover:text-emerald-700 transition-colors">
                  <span className="inline-flex items-center gap-1.5">
                    {t.viewProfileLogging}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>

                  {canEditCustomer && (
                    <div className="flex gap-2 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleStartEdit(e, customer)}
                        className="h-10 px-3.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-gray-200 cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                        title={t.actionEdit}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-650" />
                        <span>{t.actionEdit}</span>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(customer.id)}
                        className="h-10 px-3.5 text-xs font-bold text-red-650 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                        title={t.actionDelete}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-605" />
                        <span>{t.actionDelete}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
