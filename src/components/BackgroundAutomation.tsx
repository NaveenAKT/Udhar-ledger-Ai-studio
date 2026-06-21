/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, MonthlyLog, Customer, Shop } from '../types';
import { useLanguage } from '../lib/translations';
import { 
  Clock, 
  CheckCircle, 
  Send,
  Loader2,
  Terminal,
  ShieldCheck,
  Play,
  Phone,
  MessageSquare
} from 'lucide-react';

interface BackgroundAutomationProps {
  transactions: Transaction[];
  customers: Customer[];
  shops: Shop[];
  monthlyLogs: MonthlyLog[];
  onAddMonthlyLog: (compiledLogs: string[]) => Promise<MonthlyLog>;
  isFirebaseActive: boolean;
}

export default function BackgroundAutomation({
  transactions,
  customers,
  shops,
  monthlyLogs,
  onAddMonthlyLog,
}: BackgroundAutomationProps) {
  const { t, language } = useLanguage();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<string>('');
  const [triggerMode, setTriggerMode] = useState<'merchant' | 'cron'>('merchant');

  // Custom Test SMS Form States
  const [testPhone, setTestPhone] = useState('9848012345');
  const [testMessage, setTestMessage] = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  // Initialize test message once or when language changes
  React.useEffect(() => {
    setTestMessage(language === 'te' 
      ? 'ఉధార్ హెచ్చరిక: రమేష్ గారు, మీ కిరాణా దుకాణం బకాయి రూ. 1,500 ఇంకా చెల్లించలేదు. దయచేసి త్వరగా చెల్లించండి.' 
      : 'Udhar Alert: Dear Ramesh, your outstanding balance of Rs 1,500 at Kirana Store is still unpaid. Please settle soon.'
    );
  }, [language]);

  // Simulated queue states
  const [simulatedDeliveries, setSimulatedDeliveries] = useState<
    { id: string; customerName: string; mobileNumber: string; text: string; status: 'queued' | 'sending' | 'delivered' }[]
  >([]);

  const handleSendCustomTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSimulating) return;
    
    setIsSimulating(true);
    setSimulationStep(language === 'te' ? 'టెస్ట్ ఎస్ఎమ్ఎస్ గేట్‌వే అటాచ్ అవుతోంది...' : 'Attaching test SMS gateway...');
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    await delay(600);
    
    const newItem = {
      id: `test-sms-${Date.now()}`,
      customerName: language === 'te' ? "టెస్ట్ కస్టమర్ (Custom Test)" : "Test Customer (Custom Test)",
      mobileNumber: testPhone.trim(),
      text: testMessage.trim(),
      status: 'queued' as const
    };

    setSimulatedDeliveries(prev => [newItem, ...prev]);
    
    await delay(600);
    setSimulationStep(language === 'te' 
      ? `SMS Gateway: టెస్ట్ మెసేజ్ ${newItem.mobileNumber} నంబరుకు పంపబడుతోంది...` 
      : `SMS Gateway: Sending test message to ${newItem.mobileNumber}...`
    );
    setSimulatedDeliveries(prev => prev.map(item => item.id === newItem.id ? { ...item, status: 'sending' } : item));
    
    await delay(1200);
    setSimulatedDeliveries(prev => prev.map(item => item.id === newItem.id ? { ...item, status: 'delivered' } : item));
    
    // Log to audit log
    await onAddMonthlyLog([
      `RUN_TYPE: CUSTOM_TEST_SMS_TRIGGER`,
      `TARGET: ${newItem.mobileNumber}`,
      `[SMS Test] ${newItem.text}`
    ]).catch(err => console.error("Logged audit error:", err));

    setTestSuccess(true);
    setSimulationStep('');
    setIsSimulating(false);
    
    setTimeout(() => setTestSuccess(false), 3000);
  };

  const handleTriggerSimulationNow = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationStep(language === 'te' ? 'ఉధార్ లెడ్జర్ డేటాబేస్‌కు అనుసంధానించబడుతోంది...' : 'Connecting to Udhar Ledger Database...');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      await delay(700);
      setSimulationStep(language === 'te' ? 'క్రియాశీల చెల్లించని క్రెడిట్ లెడ్జర్ బ్యాలెన్స్‌లను శోధిస్తోంది...' : 'Scanning for active outstanding credit ledger balances...');
      
      // Find all unpaid transactions
      const unpaidTxs = transactions.filter(t => t.status === 'Unpaid');

      await delay(650);

      let filteredTxs = unpaidTxs;
      if (triggerMode === 'merchant') {
        setSimulationStep(language === 'te' ? 'లెడ్జర్‌ను నా యాక్టివ్ దుకాణాల లావాదేవీలకే పరిమితం చేస్తోంది...' : 'Filtering ledger for active merchant shops...');
        const myShopIds = new Set(shops.map(s => s.id));
        filteredTxs = unpaidTxs.filter(t => myShopIds.has(t.shopId));
      } else {
        setSimulationStep(language === 'te' ? 'అన్ని యాక్టివ్ దుకాణాల వ్యాప్తంగా సిస్టమ్ క్రోన్ రన్ అమలు చేస్తోంది...' : 'Executing system cron run across all registered shops...');
      }

      await delay(700);
      setSimulationStep(language === 'te' ? 'బాకీ మొత్తాలను ఒకచోట చేర్చి కస్టమర్ మొబైల్ నంబర్లకు మ్యాప్ చేస్తోంది...' : 'Consolidating due amounts and mapping to customer mobile contacts...');

      // Group by customer name or ID
      const customerGroups: Record<string, { total: number; shopDetails: string[]; phone: string }> = {};

      filteredTxs.forEach(tx => {
        const matchingCustomer = customers.find(c => c.id === tx.customerId || c.name === tx.customerName);
        const phone = matchingCustomer ? matchingCustomer.phone : '9848012345';
        
        const name = tx.customerName || (matchingCustomer ? matchingCustomer.name : (language === 'te' ? 'బాకీదారుడు' : 'Debtor'));
        if (!customerGroups[name]) {
          customerGroups[name] = { total: 0, shopDetails: [], phone };
        }
        const amountVal = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount as any) || 0;
        customerGroups[name].total += amountVal;
        const shopDisplay = tx.shopName || (language === 'te' ? 'జనరల్ స్టోర్' : 'General Store');
        customerGroups[name].shopDetails.push(`${shopDisplay} (₹${amountVal.toFixed(2)})`);
      });

      // Elegant Fallback: If no unpaid transactions exist, create gorgeous mock borrower groups so they always see the queue!
      const groupKeys = Object.keys(customerGroups);
      if (groupKeys.length === 0) {
        setSimulationStep(language === 'te' ? 'డేటాబేస్ ఖాళీగా ఉంది! డెమో కోసం శాంపిల్ బాకీదారులను సృష్టిస్తోంది...' : 'Database empty! Creating demo borrowers for simulation...');
        await delay(900);
        
        customerGroups[language === 'te' ? "రమేష్ కుమార్" : "Ramesh Kumar"] = {
          total: 1250,
          shopDetails: [language === 'te' ? "సాయి సూపర్ కిరాణా (₹750)" : "Sai Super Kirana (₹750)", language === 'te' ? "లక్ష్మి ఫ్యాన్సీ స్టోర్ (₹500)" : "Lakshmi Fancy Store (₹500)"],
          phone: "9848011223"
        };
        customerGroups[language === 'te' ? "వెంకటేశ్వర్లు" : "Venkateswarlu"] = {
          total: 2800,
          shopDetails: [language === 'te' ? "సాయి సూపర్ కిరాణా (₹2100)" : "Sai Super Kirana (₹2100)", language === 'te' ? "శ్రీను హార్డ్‌వేర్ (₹700)" : "Srinu Hardware (₹700)"],
          phone: "9959088776"
        };
        customerGroups[language === 'te' ? "అంజలి దేవి" : "Anjali Devi"] = {
          total: 450,
          shopDetails: [language === 'te' ? "లక్ష్మి ఫ్యాన్సీ స్టోర్ (₹450)" : "Lakshmi Fancy Store (₹450)"],
          phone: "9123456780"
        };
      }

      await delay(800);
      setSimulationStep(language === 'te' ? 'అధికారిక ఎస్ఎమ్ఎస్ Rem Reminders డ్రాష్ట్ టెక్స్ట్‌లను సిద్ధం చేస్తోంది...' : 'Drafting official SMS Rem Reminders texts...');

      const compiled: string[] = [];
      const queueList: any[] = [];

      Object.keys(customerGroups).forEach((name, idx) => {
        const group = customerGroups[name];
        const shopDetailsStr = group.shopDetails.join(', ');
        
        const text = language === 'te'
          ? `నెలవారీ బకాయి సమాచారం: నమస్కారం ${name} గారు, మీ మొత్తం బకాయి రూ. ${group.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${shopDetailsStr}). ఏదైనా సవరణ ఉంటే ఈ నెల 10వ తేదీలోపు దుకాణాన్ని సంప్రదించండి. ఫోన్: ${group.phone}`
          : `Monthly Balance Info: Dear ${name}, your total outstanding balance of Rs. ${group.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${shopDetailsStr}) is due. For corrections, verify with shop before 10th of this month. Phone: ${group.phone}`;
        
        compiled.push(`[SMS on ${group.phone}] ${text}`);
        queueList.push({
          id: `sms-${idx}-${Date.now()}`,
          customerName: name,
          mobileNumber: group.phone,
          text,
          status: 'queued'
        });
      });

      // Put campaign messages prepended, clean out previous campaign sms
      setSimulatedDeliveries(prev => [...queueList, ...prev.filter(x => !x.id.startsWith('sms-'))]);

      await delay(800);
      setSimulationStep(language === 'te' ? 'పంపిన ప్రచార రికార్డులను మరియు ఆడిట్ లాగ్‌లను డేటాబేస్‌లో సేవ్ చేస్తోంది...' : 'Saving campaign dispatch records and audit logs to the database...');
      
      // Log history (non-blocking)
      onAddMonthlyLog([
        `RUN_TYPE: ${triggerMode === 'merchant' ? 'MERCHANT_TRIGGER' : 'SYSTEM_MONTHLY_CRON'}`,
        `TARGET: ${triggerMode === 'merchant' ? (language === 'te' ? 'మా స్వంత దుకాణాలు మాత్రమే' : 'Only Active Shops owned by Merchant') : (language === 'te' ? 'మొత్తం గ్లోబల్ డైరెక్టరీ స్కాన్' : 'Global directory scan across all registered shops')}`,
        `STATUS: SUCCESSFUL_CAMPAIGN_DISPATCH`,
        ...compiled
      ]).catch(err => console.error("Logged audit error:", err));

      // Sequentially process delivery steps targeting specific message IDs
      for (let i = 0; i < queueList.length; i++) {
        const targetId = queueList[i].id;
        const targetName = queueList[i].customerName;

        setSimulationStep(language === 'te' 
          ? `SMS Gateway: ${targetName} గారికి సందేశాన్ని (${i + 1}/${queueList.length}) డెలివరీ చేస్తోంది...`
          : `SMS Gateway: Delivering message to ${targetName} (${i + 1}/${queueList.length})...`
        );

        setSimulatedDeliveries(prev => prev.map(item => item.id === targetId ? { ...item, status: 'sending' } : item));
        await delay(1000);
        setSimulatedDeliveries(prev => prev.map(item => item.id === targetId ? { ...item, status: 'delivered' } : item));
      }

      setSimulationStep('');
    } catch (err) {
      console.error("Simulation failed:", err);
      setSimulationStep(language === 'te' 
        ? `సిమ్యులేషన్ సిస్టమ్ లోపం సంభవించింది: ${err instanceof Error ? err.message : String(err)}`
        : `Simulation system error occurred: ${err instanceof Error ? err.message : String(err)}`
      );
      await delay(2000);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div id="background-automation-view" className="space-y-6 animate-in fade-in duration-200 text-slate-800 max-w-4xl mx-auto">
      <div className="space-y-6">
        
        {/* Main Controls Panel */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-2">
                  {t.autoHeader}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed">
                  {t.autoSub}
                </p>
              </div>
            </div>

            {/* Selector for trigger types */}
            <div className="bg-slate-50 border border-gray-150 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
                {t.campaignDispatchMode}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => !isSimulating && setTriggerMode('merchant')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    triggerMode === 'merchant'
                      ? 'bg-white border-emerald-600 ring-1 ring-emerald-600 shadow-xs font-bold'
                      : 'bg-transparent border-gray-200 hover:bg-white/50'
                  } ${isSimulating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{t.merchantTriggerTag}</span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {t.merchantTriggerDesc} ({shops.length})
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => !isSimulating && setTriggerMode('cron')}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    triggerMode === 'cron'
                      ? 'bg-white border-emerald-600 ring-1 ring-emerald-600 shadow-xs font-bold'
                      : 'bg-transparent border-gray-200 hover:bg-white/50'
                  } ${isSimulating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{t.scheduledCronTag}</span>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      {t.scheduledCronDesc}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] font-mono font-bold text-slate-500 bg-gray-55/40 border border-gray-200 px-3 py-2 rounded-lg">
                {language === 'te' ? 'మాస క్రోన్ షెడ్యూల్:' : 'Monthly Cron Schedule:'} <span className="text-emerald-700 font-bold">0 9 1 * *</span> {language === 'te' ? '(ప్రతి నెల 1 న రన్ అవుతుంది)' : '(Runs on the 1st of every month)'}
              </div>

              <button
                id="trigger-job-simulator-btn"
                onClick={handleTriggerSimulationNow}
                disabled={isSimulating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap self-stretch sm:self-auto justify-center"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    {t.executingCampaign}
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-white animate-pulse" />
                    {t.runActiveCampaignNowBtn}
                  </>
                )}
              </button>
            </div>

            {isSimulating && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-xl space-y-2 animate-pulse">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">{t.simulationOnline}</span>
                <p className="text-xs font-mono text-emerald-900 font-bold leading-normal">{simulationStep}</p>
              </div>
            )}
          </div>

          {/* Telugu SMS Provider Queue Tracker */}
          <div className="bg-white border border-gray-150 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-warm-gray/20 border-b border-gray-150 flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                {t.smsGatewayQueueHeader}
              </h4>
              <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200">
                {language === 'te' ? 'లైవ్ ప్రసార క్యూ (Interactive)' : 'Live Dispatch Queue (Interactive)'}
              </span>
            </div>

            {simulatedDeliveries.length === 0 ? (
              <div className="text-center py-10 p-6 bg-white text-slate-500">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h5 className="font-bold text-slate-700 text-sm">{t.smsQueueNoPending}</h5>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {t.smsQueueDesc}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-55 max-h-80 overflow-y-auto">
                {simulatedDeliveries.map(item => (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-gray-950 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{item.customerName}</span>
                        <span className="text-slate-400 font-medium font-mono text-[11px] flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/50">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {item.mobileNumber}
                        </span>
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed bg-emerald-50/20 shadow-inner p-3 rounded-xl border border-emerald-100/40 whitespace-normal break-words font-medium">
                        {item.text}
                      </p>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {item.status === 'queued' && (
                        <span className="text-[10px] font-mono font-bold uppercase bg-gray-100 text-slate-500 px-2 py-0.5 rounded-full border border-gray-150">
                          {language === 'te' ? 'క్యూలో ఉంది' : 'Queued'}
                        </span>
                      )}
                      {item.status === 'sending' && (
                        <span className="text-[10px] font-mono font-bold uppercase bg-blue-50 text-blue-600 border border-blue-150 px-2 py-0.5 rounded-full animate-pulse">
                          {language === 'te' ? 'పంపుతోంది...' : 'Sending...'}
                        </span>
                      )}
                      {item.status === 'delivered' && (
                        <span className="text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-250 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-bold shadow-2xs">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          {language === 'te' ? 'పంపబడింది' : 'Delivered'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Custom Test SMS Gateway Form */}
          <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b pb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-650" />
              {t.orTestCustomSmsHeader}
            </h4>
            
            <form onSubmit={handleSendCustomTestSms} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.testPhoneLabel}</label>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-slate-800 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.testMessageLabel}</label>
                  <input
                    type="text"
                    required
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                {testSuccess ? (
                  <span className="text-xs font-bold text-emerald-650 animate-bounce flex items-center gap-1 text-[11px]">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t.testSmsSuccess}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 leading-normal">
                    {language === 'te' 
                      ? 'ఒక కస్టమ్ REM REMINDER ఎస్ఎమ్ఎస్ అలర్ట్‌ను సిమ్యులేట్ చేయడానికి నంబరుని టైప్ చేసి బటన్ నొక్కండి.' 
                      : 'Type a phone number and click the button to simulate a custom SMS reminder alerts dispatch.'}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="bg-slate-900 border border-slate-950 hover:bg-slate-800 text-white font-extrabold text-[11px] py-2 px-4 rounded-lg shadow-xs cursor-pointer transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                  {t.sendTestSmsBtn}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
