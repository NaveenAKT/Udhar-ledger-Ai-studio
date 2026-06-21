/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Transaction, LedgerUser } from '../types';
import { useLanguage } from '../lib/translations';
import { Search, UserPlus, Phone, Store, ArrowRight, UserCheck, Edit2, X, Loader2, Mail } from 'lucide-react';

interface CustomerDirectoryProps {
  customers: Customer[];
  transactions: Transaction[];
  currentUser: LedgerUser | null;
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomerClick: () => void;
  onUpdateCustomer: (customerId: string, name: string, phone: string, email: string, village?: string, mandal?: string) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
}

export default function CustomerDirectory({
  customers,
  transactions,
  currentUser,
  onSelectCustomer,
  onAddCustomerClick,
  onUpdateCustomer,
  onDeleteCustomer,
}: CustomerDirectoryProps) {
  const { t } = useLanguage();
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

  const isSuperUser = currentUser?.email === 'naveenkumar31343@gmail.com';

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
    if (!editingCustomer || !editName.trim() || !editPhone.trim()) return;

    setIsSavingEdit(true);
    setEditError('');
    try {
      await onUpdateCustomer(
        editingCustomer.id, 
        editName.trim(), 
        editPhone.trim(), 
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

  const handleDeleteWithConfirm = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    if (window.confirm("ఈ కస్టమర్‌ను నిరవధికంగా తొలగించాలనుకుంటున్నారా? దీనివల్ల వారి బకాయి సమాచారం పోవచ్చు.")) {
      try {
        await onDeleteCustomer(customerId);
      } catch (err) {
        console.error(err);
      }
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
        
        <button
          id="add-customer-trigger-btn"
          onClick={onAddCustomerClick}
          className="self-start sm:self-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs group cursor-pointer"
        >
          <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          {t.registerCustomerBtn}
        </button>
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
            <button
              onClick={onAddCustomerClick}
              className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              {t.addFirstCustomerBtn}
            </button>
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
                    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleStartEdit(e, customer)}
                        className="p-1 px-2 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-md border border-gray-200 cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-emerald-650" />
                        {t.actionEdit}
                      </button>
                      {isSuperUser && (
                        <button
                          onClick={(e) => handleDeleteWithConfirm(e, customer.id)}
                          className="p-1 px-2 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-100 cursor-pointer"
                        >
                          {t.actionDelete}
                        </button>
                      )}
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
