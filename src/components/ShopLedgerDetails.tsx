import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shop, Customer, Transaction } from '../types';
import { useLanguage } from '../lib/translations';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Search, 
  UserCheck, 
  ArrowRight,
  Info,
  Calendar,
  Building,
  CheckCircle,
  Coins
} from 'lucide-react';

interface ShopLedgerDetailsProps {
  shop: Shop;
  transactions: Transaction[];
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
}

export default function ShopLedgerDetails({ 
  shop, 
  transactions, 
  customers, 
  onSelectCustomer 
}: ShopLedgerDetailsProps) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [minOwedAmount, setMinOwedAmount] = useState<string>('');

  // 1. Filter transactions to only those belonging to this particular shop
  const shopTransactions = useMemo(() => {
    return transactions.filter(tx => tx.shopId === shop.id);
  }, [transactions, shop.id]);

  // 2. Identify all customers with transactions at this shop
  const uniqueCustomerIdsForShop = useMemo(() => {
    const ids = new Set<string>();
    shopTransactions.forEach(tx => {
      if (tx.customerId) ids.add(tx.customerId);
    });
    return Array.from(ids);
  }, [shopTransactions]);

  // 3. Aggregate due (owed) and settled amounts per customer for this specific shop
  const customerSummaryList = useMemo(() => {
    const recordsMap: Record<string, { 
      customer: Customer | null;
      customerId: string;
      fallbackName: string;
      owed: number; 
      settled: number;
      txCount: number;
    }> = {};

    // Group and aggregate
    shopTransactions.forEach(tx => {
      const cid = tx.customerId;
      if (!recordsMap[cid]) {
        // Find main customer details
        const found = customers.find(c => c.id === cid) || null;
        recordsMap[cid] = {
          customer: found,
          customerId: cid,
          fallbackName: tx.customerName || 'Unknown Customer',
          owed: 0,
          settled: 0,
          txCount: 0
        };
      }

      recordsMap[cid].txCount += 1;
      
      // Calculate unpaid/owed
      if (tx.status === 'Unpaid') {
        recordsMap[cid].owed += tx.amount;
        if (tx.amount < 0) {
          recordsMap[cid].settled += Math.abs(tx.amount);
        }
      } else {
        recordsMap[cid].settled += tx.amount;
      }
    });

    // Convert to list
    return Object.values(recordsMap);
  }, [shopTransactions, customers]);

  // 4. Calculate grand totals for this shop
  const grandTotals = useMemo(() => {
    let totalOwed = 0;
    let totalSettled = 0;
    customerSummaryList.forEach(item => {
      totalOwed += item.owed;
      totalSettled += item.settled;
    });
    return {
      totalOwed,
      totalSettled,
      customerCount: customerSummaryList.length,
      txCount: shopTransactions.length
    };
  }, [customerSummaryList, shopTransactions]);

  // 5. Apply real-time query filter and amount filter on aggregated customer records
  const filteredCustomerSummaryList = useMemo(() => {
    let result = customerSummaryList;

    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(item => {
        const name = (item.customer?.name || item.fallbackName).toLowerCase();
        const phone = (item.customer?.phone || '').toLowerCase();
        const village = (item.customer?.village || '').toLowerCase();
        const mandal = (item.customer?.mandal || '').toLowerCase();
        return name.includes(query) || phone.includes(query) || village.includes(query) || mandal.includes(query);
      });
    }

    const minAmt = parseFloat(minOwedAmount);
    if (!isNaN(minAmt)) {
      result = result.filter(item => item.owed >= minAmt);
    }

    return result;
  }, [customerSummaryList, searchQuery, minOwedAmount]);

  const formatCurrency = (amt: number) => {
    const isNegative = amt < 0;
    const absVal = Math.abs(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (isNegative ? '-' : '') + '₹' + absVal;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
      id={`shop-ledger-details-page-${shop.id}`}
    >
      {/* Top Breadcrumb & Page Headings */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="p-2 border border-gray-250 bg-white hover:bg-slate-50 text-slate-705 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 shadow-3xs"
            id="back-to-transactions-btn"
            title={language === 'te' ? 'వ్యాపార లావాదేవీలకు తిరిగి వెళ్ళండి' : 'Go back to merchant ledger'}
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-650 shrink-0" />
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                {shop.name}
              </h2>
            </div>
            {shop.address && (
              <p className="text-xs font-semibold text-slate-400 mt-1.5 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-350" />
                <span>{shop.address}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-450 bg-slate-50 border border-gray-150 rounded-xl px-3 py-1.5 shrink-0 self-start md:self-auto font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{language === 'te' ? 'దుకాణ ప్రారంభం' : 'Active since'}: {new Date(shop.createdAt).toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN')}</span>
        </div>
      </div>

      {/* Numerical Performance / Metrics Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="shop-metrics-bento">
        {/* Metric Card 1: Amount Owed */}
        <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              {language === 'te' ? 'కస్టమర్ బకాయి మొత్తం' : 'Amount Customers Owe'}
            </span>
            <span className="text-2xl font-mono font-black text-red-650 block">
              {formatCurrency(grandTotals.totalOwed)}
            </span>
          </div>
          <div className="text-[10px] text-slate-450 font-bold border-t border-dashed border-gray-120 pt-2.5 mt-4 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-red-400" />
            <span>{language === 'te' ? 'యాక్టివ్ బాకీ రికార్డులు' : 'Outstanding credits'}</span>
          </div>
        </div>

        {/* Metric Card 2: Settled Amount */}
        <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              {language === 'te' ? 'చెల్లించబడిన / జమ మొత్తం' : 'Settled amount'}
            </span>
            <span className="text-2xl font-mono font-black text-emerald-700 block">
              {formatCurrency(grandTotals.totalSettled)}
            </span>
          </div>
          <div className="text-[10px] text-slate-450 font-bold border-t border-dashed border-gray-120 pt-2.5 mt-4 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>{language === 'te' ? 'పూర్తిగా వసూలైనవి' : 'Fully settled balances'}</span>
          </div>
        </div>

        {/* Metric Card 3: Total Customers */}
        <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              {language === 'te' ? 'మొత్తం ఖాతాదారులు' : 'Total Customers'}
            </span>
            <span className="text-2xl font-mono font-black text-slate-800 block">
              {grandTotals.customerCount}
            </span>
          </div>
          <div className="text-[10px] text-slate-450 font-bold border-t border-dashed border-gray-120 pt-2.5 mt-4">
            <span>{language === 'te' ? 'లావాదేవీలు ఉన్న కస్టమర్లు' : 'Customers with entries'}</span>
          </div>
        </div>

        {/* Metric Card 4: Total Entries */}
        <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              {language === 'te' ? 'మొత్తం లావాదేవీలు' : 'Total Entries'}
            </span>
            <span className="text-2xl font-mono font-black text-slate-800 block">
              {grandTotals.txCount}
            </span>
          </div>
          <div className="text-[10px] text-slate-450 font-bold border-t border-dashed border-gray-120 pt-2.5 mt-4">
            <span>{language === 'te' ? 'మొత్తం రికార్డుల సంఖ్య' : 'Logs and entries sum'}</span>
          </div>
        </div>
      </div>

      {/* Main Aggregated Customer List */}
      <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs flex flex-col">
        {/* Search header container */}
        <div className="p-5 border-b border-gray-150 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
              {language === 'te' ? 'ఖాతాదారుల సమగ్ర బకాయిల పట్టిక' : 'Customer-wise Aggregated Debt Dashboard'}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">
              {language === 'te' ? 'ఈ దుకాణానికి సంబంధించిన కస్టమర్ల బకాయి మరియు రికార్డుల వివరణ' : 'Specific metrics and settled statements for each individual customer at this active shop.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative max-w-md w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={language === 'te' ? 'ఖాతాదారుని శోధించండి (పేరు/ఫోన్)...' : 'Search customer (name/phone)...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-250 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-3xs"
              />
            </div>

            <div className="relative max-w-xs w-full sm:w-48 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                {language === 'te' ? 'బకాయి >=' : 'Owed >= '}
              </span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono font-bold">₹</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={minOwedAmount}
                  onChange={e => setMinOwedAmount(e.target.value)}
                  className="w-full pl-6 pr-3 py-2 bg-white border border-gray-250 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-3xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content list or table */}
        {filteredCustomerSummaryList.length === 0 ? (
          <div className="text-center py-16 px-4">
            <UserCheck className="w-10 h-10 text-slate-350 mx-auto mb-3" />
            <h4 className="font-extrabold text-slate-800 text-sm">
              {language === 'te' ? 'ఖాతాదారులు ఎవరూ లభించలేదు' : 'No Customer Accounts Found'}
            </h4>
            <p className="text-xs text-slate-405 mt-1 max-w-sm mx-auto">
              {searchQuery 
                ? (language === 'te' ? 'మీ శోధనకు సరిపోయే కస్టమర్ రికార్డులు లేవు.' : 'There are no ledger entries matches for the query.')
                : (language === 'te' ? 'ఈ దుకాణంలో ఇప్పటివరకు ఎలాంటి లావాదేవీలు నమోదు చేయబడలేదు.' : 'No active history recorded for this shop yet.')}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-gray-150 text-[10px] font-black uppercase tracking-widest text-slate-450 font-mono">
                    <th className="py-3 px-6">{language === 'te' ? 'ఖాతాదారుడు' : 'Customer'}</th>
                    <th className="py-3 px-6">{language === 'te' ? 'మొబైల్ / ఇమెయిల్' : 'Contact Details'}</th>
                    <th className="py-3 px-6">{language === 'te' ? 'గ్రామం & మండలం' : 'Village / Area'}</th>
                    <th className="py-3 px-6 text-right">{language === 'te' ? 'బాకీ ఉన్న మొత్తం' : 'Amount Owed'}</th>
                    <th className="py-3 px-6 text-right">{language === 'te' ? 'చెల్లించిన మొత్తం' : 'Settled Amount'}</th>
                    <th className="py-3 px-6 text-center">{language === 'te' ? 'లావాదేవీలు' : 'Entries'}</th>
                    <th className="py-3 px-6 text-center">{language === 'te' ? 'చర్య' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150/70 text-xs">
                  {filteredCustomerSummaryList.map(item => {
                    const cName = item.customer?.name || item.fallbackName;
                    const cPhone = item.customer?.phone || 'No Phone';
                    const cEmail = item.customer?.email || '';
                    const cVillage = item.customer?.village || '-';
                    const cMandal = item.customer?.mandal || '-';

                    return (
                      <tr 
                        key={item.customerId}
                        onClick={() => item.customer && onSelectCustomer(item.customer)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer font-bold text-slate-705 group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center font-extrabold text-xs shrink-0 uppercase">
                              {cName.charAt(0)}
                            </div>
                            <span className="font-extrabold text-slate-800 text-sm group-hover:text-emerald-800 transition-colors">
                              {cName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-800 font-mono text-xs">{cPhone}</span>
                            {cEmail && <span className="text-[10px] text-slate-400 font-semibold">{cEmail}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-semibold">
                          {cVillage !== '-' || cMandal !== '-' ? (
                            <span>{cVillage}, {cMandal}</span>
                          ) : (
                            <span className="text-slate-350 italic">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-red-650 text-sm">
                          {formatCurrency(item.owed)}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-emerald-700 text-sm">
                          {formatCurrency(item.settled)}
                        </td>
                        <td className="py-4 px-6 text-center font-mono font-bold text-slate-450">
                          {item.txCount}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center">
                            <span className="text-emerald-650 font-black flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all text-[11px] transform translate-x-2 group-hover:translate-x-0">
                              <span>{language === 'te' ? 'ప్రొఫైల్ చూడు' : 'View Profile'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card Grid */}
            <div className="block md:hidden divide-y divide-gray-150">
              {filteredCustomerSummaryList.map(item => {
                const cName = item.customer?.name || item.fallbackName;
                const cPhone = item.customer?.phone || 'No Phone';
                const cVillage = item.customer?.village || '';
                const cMandal = item.customer?.mandal || '';

                return (
                  <div 
                    key={item.customerId}
                    onClick={() => item.customer && onSelectCustomer(item.customer)}
                    className="p-4 active:bg-slate-50 transition-colors cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center font-extrabold text-xs uppercase shrink-0">
                          {cName.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-extrabold text-slate-800 block">
                            {cName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                            {cPhone} {cVillage ? `• ${cVillage}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-2xs font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                          {language === 'te' ? 'బాకీ' : 'Owed'}
                        </span>
                        <span className="text-sm font-mono font-extrabold text-red-650 block">
                          {formatCurrency(item.owed)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-dashed border-gray-120 flex items-center justify-between text-2xs">
                      <div className="text-slate-500 font-bold">
                        <span>{language === 'te' ? 'చెల్లించినది: ' : 'Settled: '}</span>
                        <span className="font-mono text-emerald-700 font-extrabold">{formatCurrency(item.settled)}</span>
                      </div>
                      <span className="text-slate-400 font-extrabold flex items-center gap-0.5">
                        <span>{item.txCount} {language === 'te' ? 'లావాదేవీలు' : 'entries'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </motion.div>
  );
}
