// AificoApp methods: sms (23 methods). Part of the AificoApp prototype chain.
        class AificoAppSms extends AificoAppShared {
            /**
             * Returns or checks is sms tx.
             * Parameters: t. Side effects, if any, are described by the statements below.
             */
            isSmsTx(t){ return String(t?.source||'').toLowerCase()==='sms'; }
            // Balance effect the SMS importers apply: credit adds, Transfer/Investment leave it, everything else subtracts.
            /**
             * Handles the sms balance effect workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: t. Side effects, if any, are described by the statements below.
             */
            smsBalanceEffect(t){ const amt=Number(t?.amount)||0; if(t?.type==='Income')return amt; if(t?.type==='Transfer'||t?.type==='Investment')return 0; return -amt; }
            /**
             * Handles the apply balance effect workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: t,sign. Side effects, if any, are described by the statements below.
             */
            applyBalanceEffect(t,sign){ const acc=(this.data.accounts||[]).find(a=>a.name===t.account); const delta=this.smsBalanceEffect(t)*sign; if(acc&&delta)acc.balance=(Number(acc.balance)||0)+delta; }
            // An SMS entry is a duplicate when another counted transaction has the same account, amount and direction, and
            // either the same reference ID, or (when either side has no reference ID) a date within one day.
            // Non-SMS entries (manual, Money Manager, statement, scheduled) are always the actual record; among SMS entries the first one imported wins.
            /**
             * Handles the detect sms duplicates workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            detectSmsDuplicates(){
                const all=(this.data?.tx||[]).filter(Boolean);
                const ref=t=>String(t.reference||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
                const hasRef=t=>ref(t).length>=6;
                const paise=t=>Math.round((Number(String(t.amount??'').replace(/[₹,\s]/g,''))||0)*100);
                const acct=t=>String(t.account||'').trim().toLowerCase();
                const key=t=>`${acct(t)}|${paise(t)}|${t.type==='Income'?'in':'out'}`;
                const day=t=>{const iso=this.normalizeLedgerDate(t.date);const ms=iso?Date.parse(iso.slice(0,10)+'T00:00:00Z'):NaN;return Number.isFinite(ms)?Math.round(ms/86400000):null;};
                // Entries already marked as duplicate keep their actual claimed and lend it their reference ID,
                // so re-running the check gives the same result and a third SMS with that reference also matches.
                const prior=new Map();
                all.filter(t=>t.duplicateOf&&t.excludedFromLedger).forEach(t=>{const k=String(t.duplicateOf);if(!prior.has(k))prior.set(k,[]);prior.get(k).push(ref(t));});
                const pool=new Map();
                const add=t=>{const k=key(t);if(!pool.has(k))pool.set(k,[]);const p=prior.get(String(t.id));pool.get(k).push({t,claimed:!!p,refs:new Set([ref(t),...(p||[])].filter(r=>r.length>=6))});};
                all.filter(t=>!t.excludedFromLedger&&!this.isSmsTx(t)).forEach(add);
                const found=[];
                // Imports put new rows at the top, so reversing walks SMS entries in import order.
                for(const t of all.filter(t=>this.isSmsTx(t)&&!t.excludedFromLedger).reverse()){
                    if(t.duplicateOverride||paise(t)<=0||!acct(t)){add(t);continue;}
                    const cands=pool.get(key(t))||[];
                    let hit=null,reason='';
                    if(hasRef(t)){hit=cands.find(c=>c.refs.has(ref(t)));if(hit)reason='Same reference ID, account and amount';}
                    if(!hit){
                        const d=day(t);
                        if(d!==null){
                            const near=cands.filter(c=>!c.claimed&&!(hasRef(t)&&hasRef(c.t))&&day(c.t)!==null&&Math.abs(day(c.t)-d)<=1).sort((a,b)=>Math.abs(day(a.t)-d)-Math.abs(day(b.t)-d));
                            if(near.length){hit=near[0];reason='Same account and amount within a day (no reference ID to compare)';}
                        }
                    }
                    if(hit){hit.claimed=true;if(hasRef(t))hit.refs.add(ref(t));found.push({tx:t,actual:hit.t,reason});}
                    else add(t);
                }
                return found;
            }
            /**
             * Handles the mark sms duplicates workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: found. Side effects, if any, are described by the statements below.
             */
            markSmsDuplicates(found){
                const now=new Date().toISOString();
                (found||[]).forEach(({tx,actual,reason})=>{
                    tx.excludedFromLedger=true; tx.duplicateOf=String(actual.id); tx.duplicateReason=reason; tx.duplicateMarkedAt=now; delete tx.duplicateOverride;
                    if(!tx.balanceEffectRemoved){this.applyBalanceEffect(tx,-1);tx.balanceEffectRemoved=true;}
                });
                return (found||[]).length;
            }
            /**
             * Handles the auto flag sms duplicates workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            autoFlagSmsDuplicates(){ return this.markSmsDuplicates(this.detectSmsDuplicates()); }
            /**
             * Handles the sms duplicate notice workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: n. Side effects, if any, are described by the statements below.
             */
            smsDuplicateNotice(n){ return n?`${n} SMS entr${n===1?'y was':'ies were'} marked as duplicate and excluded because ${n===1?'it matches':'they match'} a transaction already in the ledger. Their balance effect was removed. Review them in Core Ledger → SMS duplicates.`:''; }
            /**
             * Handles the refresh sms entry count workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            refreshSmsEntryCount() {
                const count=this.data.tx.filter(t=>String(t.source||'').toLowerCase()==='sms').length;
                const el=document.getElementById('sms-entry-count');
                const dups=this.data.tx.filter(t=>this.isSmsTx(t)&&t.duplicateOf).length;
                if(el) el.textContent=`${count.toLocaleString('en-IN')} SMS-imported transaction(s) in Core Ledger, ${dups.toLocaleString('en-IN')} marked as duplicate.`;
                return count;
            }

            /**
             * Removes all sms entries, including associated cleanup where applicable.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async removeAllSmsEntries() {
                const smsRows=this.data.tx.filter(t=>String(t.source||'').toLowerCase()==='sms');
                if(!smsRows.length) { alert('No SMS-imported transactions were found. No data was changed.'); this.refreshSmsEntryCount(); return; }
                const typed=await this.uiInput('Remove SMS transactions', `This will permanently remove ${smsRows.length} SMS-imported transaction(s) from Core Ledger.

It will also attempt to reverse their original account-balance impact. Manual and bank-statement entries will be kept.

Type REMOVE SMS to continue:`);
                if(typed===null) return; const normalizedTyped=String(typed).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g,' ').replace(/\s+/g,'').toUpperCase(); if(normalizedTyped!=='REMOVESMS') { alert('Confirmation did not match. Please enter REMOVE SMS. No data was changed.'); return; }
                const finalConfirm=await this.uiConfirm(`Final confirmation: remove all ${smsRows.length} SMS-imported transactions? Export an encrypted vault backup first if you have not already done so.`);
                if(!finalConfirm) return;
                const balanceDelta=new Map();
                smsRows.forEach(t=>{
                    if(t.balanceEffectRemoved) return;
                    const accountName=t.account;
                    if(!accountName) return;
                    const amount=Number(t.amount)||0;
                    // SMS import applies +amount for Income and -amount for non-Transfer/non-Investment entries.
                    let applied=0;
                    if(t.type==='Income') applied=amount;
                    else if(t.type!=='Transfer' && t.type!=='Investment') applied=-amount;
                    balanceDelta.set(accountName,(balanceDelta.get(accountName)||0)-applied);
                });
                const ids=new Set(smsRows.map(t=>t.id));
                this.data.tx=this.data.tx.filter(t=>!ids.has(t.id));
                let adjusted=0;
                balanceDelta.forEach((delta,name)=>{
                    const account=this.data.accounts.find(a=>a.name===name);
                    if(account && Number.isFinite(Number(account.balance))) { account.balance=Number(account.balance)+delta; adjusted++; }
                });
                this.saveVault();
                if(typeof this.renderAll==='function') this.renderAll();
                this.refreshSmsEntryCount();
                alert(`Removed ${smsRows.length} SMS-imported transaction(s). Account balances were adjusted for ${adjusted} matching account(s). Manual and bank-statement transactions were preserved. Please verify balances against your bank records.`);
            }





            /**
             * Parses or imports sms input and validates it before use.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            parseSmsInput() {
                const text = document.getElementById('sms-raw-input').value;
                if (!text.trim()) return alert('Please enter SMS text or upload an SMS backup XML file.');
                const messages = text.split(/\r?\n/).filter(line => line.trim()).map(line => ({body:line, date:''}));
                this.importSmsMessages(messages, 'pasted SMS');
            }

            /**
             * Handles the handle sms xml file workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            async handleSmsXmlFile(event) {
                const file = event.target.files?.[0];
                if (!file) return;
                const status = document.getElementById('sms-import-status');
                try {
                    const raw = await file.text();
                    const doc = new DOMParser().parseFromString(raw, 'application/xml');
                    if (doc.querySelector('parsererror')) throw new Error('The XML file is malformed or incomplete.');
                    // SMS Backup & Restore commonly stores messages as <sms ... body="..." date="..." type="..."/>.
                    const nodes = [...doc.getElementsByTagName('*')].filter(n => ['sms','mms'].includes((n.localName || n.tagName).toLowerCase()));
                    if (!nodes.length) throw new Error('No <sms> or <mms> message records were found. Please select an SMS Backup & Restore XML file.');
                    const messages = nodes.map(n => ({
                        body: n.getAttribute('body') || n.getAttribute('text') || n.getElementsByTagName('body')[0]?.textContent || '',
                        date: n.getAttribute('date') || n.getAttribute('date_sent') || '',
                        type: n.getAttribute('type') || '',
                        address: n.getAttribute('address') || ''
                    })).filter(m => m.body.trim());
                    if (!messages.length) throw new Error('Message records were found, but none contained readable message text.');
                    this.importSmsMessages(messages, file.name);
                    if (status) { status.textContent = `Read ${messages.length} message(s) from ${file.name}.`; status.classList.remove('hidden'); status.classList.add('text-emerald-600'); }
                } catch (e) {
                    alert('Could not read SMS backup XML: ' + (e.message || e));
                    if (status) { status.textContent = e.message || String(e); status.classList.remove('hidden'); status.classList.add('text-rose-600'); }
                } finally { event.target.value = ''; }
            }

            /**
             * Handles the classify sms transaction workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: line, baseType, payee=''. Side effects, if any, are described by the statements below.
             */
            classifySmsTransaction(line, baseType, payee='') {
                const text=`${line||''} ${payee||''}`.toLowerCase();
                // Explicit money movement takes priority over merchant/category matching.
                if (/\b(own account|between own accounts|self transfer|transfer to|transferred to|imps|neft|rtgs|fund transfer|upi transfer|a\/c transfer|account transfer|sweep to|sweep transfer)\b/i.test(text)) {
                    return {type:'Transfer',category:'Transfer',subcategory:'Own Account Transfer'};
                }
                if (/\b(mutual fund|sip\b|nps\b|ppf\b|public provident|ssa\b|sukanya|recurring deposit|\brd\b|fixed deposit|\bfd\b|investment|zerodha|groww|stocks?|equity|demat|smallcase|kuvera|coin by zerodha)\b/i.test(text)) {
                    return {type:'Investment',category:'Investments',subcategory:/mutual fund|sip\b|groww|zerodha|kuvera|smallcase|coin by zerodha/i.test(text)?'Mutual Funds / SIP':/\bnps\b/i.test(text)?'NPS':/\bppf\b|public provident/i.test(text)?'PPF':/recurring deposit|\brd\b/i.test(text)?'Recurring Deposit':/fixed deposit|\bfd\b/i.test(text)?'Fixed Deposit':/stocks?|equity|demat/i.test(text)?'Stocks & Shares':'Investment'};
                }
                if (/\b(insurance|premium|lic\b|life cover|health cover|policy renewal|term plan|scooter insurance|car insurance|hdfc ergo|icici lombard|star health|care health|acko)\b/i.test(text)) {
                    return {type:'Expense',category:'Insurance',subcategory:/vehicle|car|scooter|motor|two.?wheeler/i.test(text)?'Vehicle Insurance':/health|medical|star health|care health/i.test(text)?'Health Insurance':/lic\b|life cover|term plan/i.test(text)?'Life Insurance':'Insurance Premium'};
                }
                if (/\b(auto[ -]?debit|autodebit|nach|e-?mandate|ecs debit|standing instruction|si debit|mandate debit|recurring payment|subscription renewal)\b/i.test(text)) {
                    if (/\b(insurance|premium|lic\b|policy|health cover|term plan)\b/i.test(text)) return {type:'Expense',category:'Insurance',subcategory:/health/i.test(text)?'Health Insurance':/lic\b|life|term/i.test(text)?'Life Insurance':'Insurance Premium'};
                    if (/\b(sip|mutual fund|investment|nps|ppf|fixed deposit|recurring deposit|\bfd\b|\brd\b)\b/i.test(text)) return {type:'Investment',category:'Investments',subcategory:/sip|mutual fund/i.test(text)?'Mutual Funds / SIP':/\bppf\b/i.test(text)?'PPF':/\bnps\b/i.test(text)?'NPS':/fixed deposit|\bfd\b/i.test(text)?'Fixed Deposit':'Recurring Deposit'};
                    if (/\b(loan|emi|installment|instalment|mortgage)\b/i.test(text)) return {type:'EMI',category:'Loan',subcategory:'EMI / Auto Debit'};
                    if (/\b(rent|house rent|pg rent)\b/i.test(text)) return {type:'Expense',category:'Rent',subcategory:/pg/i.test(text)?'PG':'HouseRent'};
                    if (/\b(electricity|bescom|utility|broadband|internet|mobile|telephone|water bill)\b/i.test(text)) return {type:'Expense',category:'Bills',subcategory:/electricity|bescom/i.test(text)?'Electric':/broadband|internet/i.test(text)?'Broadband':/mobile|telephone/i.test(text)?'Mobile':'Utilities'};
                    return {type:'Expense',category:'Subscriptions & Auto Debit',subcategory:/subscription|renewal/i.test(text)?'Subscription':'Auto Debit'};
                }
                if (/\b(emi|installment|instalment|loan repayment|loan emi)\b/i.test(text)) {
                    return {type:'EMI',category:/car|vehicle/i.test(text)?'Car -EMI':'Loan',subcategory:'EMI'};
                }
                if (/\b(salary|payroll|wages)\b/i.test(text)) return {type:'Income',category:'Salary',subcategory:'Salary'};
                if (/\b(refund|cashback|reversal)\b/i.test(text) && baseType==='Income') return {type:'Income',category:'Refunds & Cashback',subcategory:'Refund/Cashback'};
                const rules=[
                    [/zomato|swiggy|restaurant|cafe|food delivery|eating out|dining/i,'Outing-EatingOut','EatingOut'],
                    [/bigbasket|blinkit|zepto|grocery|groceries|supermarket|ration/i,'Groceries','Ration'],
                    [/uber|ola|rapido|metro|bus ticket|namma metro|irctc|train ticket/i,'PublicTransport','Public'],
                    [/petrol|fuel|diesel|shell|indian oil|bharat petroleum|hpcl/i,'Vehicle','Fuel'],
                    [/electricity|bescom|power bill/i,'Bills','Electric'],
                    [/broadband|internet bill|airtel xstream|jiofiber/i,'Bills','Broadband'],
                    [/mobile recharge|prepaid recharge|postpaid|airtel bill|jio bill|vi recharge/i,'Bills','Mobile'],
                    [/hospital|clinic|pharmacy|medical store|medicine|apollo pharmacy/i,'Health','Medicine'],
                    [/rent|house rent|pg rent/i,'Rent',/pg/i.test(text)?'PG':'HouseRent'],
                    [/amazon|flipkart|lenovo|computer|laptop|keyboard|mouse|headphone|electronics/i,'Devices','Computer'],
                    [/school fee|tuition|academy|textbook|stationery/i,'School','Academy'],
                    [/netflix|spotify|prime video|hotstar|ott subscription/i,'Outing-EatingOut','OTT'],
                    [/society maintenance|maintenance charge/i,'Maintenance','Society Maintenance'],
                    [/gift|birthday|present/i,'Social Life','Gift']
                ];
                for(const [re,category,subcategory] of rules) if(re.test(text)) return {type:baseType||'Expense',category,subcategory};
                return {type:baseType||'Expense',category:baseType==='Income'?'Salary':'Uncategorized',subcategory:''};
            }


            /**
             * Parses or imports sms messages and validates it before use.
             * Parameters: messages, sourceName. Side effects, if any, are described by the statements below.
             */
            importSmsMessages(messages, sourceName) {
                const inbox=Array.isArray(this.data.smsInbox)?this.data.smsInbox:(this.data.smsInbox=[]);
                const existing=new Set(inbox.map(t=>String(t.messageKey||`${t.date}|${t.amount}|${t.type}|${t.description||''}`)));
                let added=0,ignored=0;
                for(const msg of messages){
                    const line=String(msg.body||'').trim(); if(!line)continue;
                    const amountMatch=line.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i)||line.match(/(?:debited|credited|spent|received|paid|purchase of)\D{0,12}([0-9,]+(?:\.\d{1,2})?)/i);
                    const baseType=/\b(credited|received|deposited|salary|refund|cashback)\b/i.test(line)?'Income':(/\b(debited|debit|auto[ -]?debit|autodebit|spent|withdrawn|paid|purchase|sent|payment of|transferred|nach|ecs debit|mandate debit|standing instruction)\b/i.test(line)?'Expense':null);
                    const typeMatch=baseType||(/\b(transfer|neft|imps|rtgs|sip|investment|premium|insurance|emi|installment|instalment|mandate|subscription renewal)\b/i.test(line)?'Expense':null);
                    if(!amountMatch||!typeMatch){ignored++;continue;}
                    const amount=Number(amountMatch[1].replace(/,/g,''));if(!Number.isFinite(amount)||amount<=0){ignored++;continue;}
                    let date='';if(msg.date&&/^\d{10,13}$/.test(String(msg.date))){const stamp=Number(msg.date),d=new Date(stamp<1e12?stamp*1000:stamp);if(!Number.isNaN(d.getTime()))date=d.toISOString().slice(0,10);}
                    if(!date){const d=line.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})\b/),numeric=line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/),
                        // Indian bank SMS write numeric dates day-first: 15-10-26, 15/10/2026, 15.10.26
                        dmy=line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
                        const validDmy=dmy&&+dmy[1]>=1&&+dmy[1]<=31&&+dmy[2]>=1&&+dmy[2]<=12;
                        if(numeric)date=`${numeric[1]}-${numeric[2]}-${numeric[3]}`;else if(d){const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};let y=Number(d[3]);if(y<100)y+=2000;date=`${y}-${String(months[d[2].toLowerCase()]||1).padStart(2,'0')}-${d[1].padStart(2,'0')}`;}else if(validDmy){let y=Number(dmy[3]);if(y<100)y+=2000;date=`${y}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;}else date=new Date().toISOString().slice(0,10);}
                    const payeeMatch=line.match(/\b(?:to|at|from|towards|for)\s+([A-Za-z][A-Za-z0-9 .&@_-]{1,35}?)(?=\s+(?:on|ref|upi|txn|transaction|avl|available|bal|a\/c|ac\s|ending)\b|[.;,]|$)/i);
                    const payee=payeeMatch?payeeMatch[1].trim().replace(/\s+/g,' '):(typeMatch==='Income'?'Bank Credit':'Bank Payment');
                    const accountMatch=line.match(/(?:A\/C|account|ac)\s*(?:no\.?\s*)?(?:ending\s*)?(?:XX|\*+)?(\d{3,6})/i);
                    const mapped=this.classifySmsTransaction(line,typeMatch,payee);const reference=(line.match(/\b(?:UTR|RRN|Ref(?:erence)?|Txn(?:\s*ID)?)\s*[:#-]?\s*([A-Z0-9-]{6,})/i)||[])[1]||'';
                    const messageKey=`${date}|${amount.toFixed(2)}|${mapped.type}|${reference||line.replace(/\s+/g,' ').toLowerCase()}`;
                    if(existing.has(messageKey)){ignored++;continue;} existing.add(messageKey);
                    inbox.unshift({id:'sms_inbox_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),messageKey,date,type:mapped.type,amount,accountHint:accountMatch?accountMatch[1]:'',account:'SMS (Unreconciled)',category:mapped.category,subcategory:mapped.subcategory,payee,notes:`${payee}${mapped.subcategory?' — '+mapped.subcategory:''}`.slice(0,160),description:line,reference,originalSmsDate:msg.date||'',sender:msg.address||'',sourceFile:sourceName,status:'pending',importedAt:new Date().toISOString()});added++;
                }
                if(!added){alert(`No new SMS records were staged. ${ignored} message(s) were unsupported or already present in the SMS Ledger.`);return;}
                this.saveVault();this.renderAll();this.renderSmsReconciliation();
                const status=document.getElementById('sms-import-status');if(status){status.textContent=`Staged ${added} SMS record(s) in Core SMS Ledger. ${ignored} unsupported or repeated message(s) skipped. No account balances or Core Ledger records were changed.`;status.classList.remove('hidden','text-rose-600');status.classList.add('text-emerald-600');}
                alert(`Added ${added} record(s) to Core SMS Ledger. They have not been added to Core Ledger and have not changed account balances. Review suggested matches before merging unmatched records.${ignored?`\n${ignored} unsupported/repeated message(s) skipped.`:''}`);
            }

            /**
             * Handles the sms date day workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            smsDateDay(value){const iso=this.normalizeLedgerDate(value);return iso?Math.floor(Date.parse(iso.slice(0,10)+'T00:00:00Z')/86400000):null;}
            /**
             * Handles the extract reconciliation reference workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: item. Side effects, if any, are described by the statements below.
             */
            extractReconciliationReference(item){
                const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
                const explicit=norm(item.reference);if(explicit.length>=6)return explicit;
                const text=String(item.description||'')+' '+String(item.notes||'')+' '+String(item.payee||'');
                const patterns=[/(?:UTR|IMPS\s*(?:REF(?:ERENCE)?|NO)?|NEFT\s*(?:REF(?:ERENCE)?|NO)?|RRN|TRANSACTION\s*ID|REF(?:ERENCE)?\s*(?:NO|NUMBER|ID)?)[\s.:#-]*([A-Z0-9]{6,30})/ig, /([A-Z]{2,5}[0-9]{8,25})/g];
                for(const re of patterns){let m;while((m=re.exec(text))!==null){const candidate=norm(m[1]);if(candidate.length>=6)return candidate;}}
                return '';
            }
            /**
             * Returns or checks find sms matches.
             * Parameters: item. Side effects, if any, are described by the statements below.
             */
            findSmsMatches(item){
                const txs=(this.data.tx||[]).filter(t=>t&&!this.isSmsTx(t)&&!t.excludedFromLedger);
                const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
                const ref=this.extractReconciliationReference(item),day=this.smsDateDay(item.date),want=Math.round((Number(item.amount)||0)*100);
                return txs.map(t=>{
                    if(Math.round((Number(t.amount)||0)*100)!==want)return null;
                    const sameType=(item.type==='Income')===(t.type==='Income');if(!sameType)return null;
                    const txRef=norm(t.reference||t.transactionId||t.utr),td=this.smsDateDay(t.date),dateDiff=day!==null&&td!==null?Math.abs(day-td):99;
                    const hint=norm(item.accountHint),account=norm(t.account);if(hint&&!account.includes(hint))return null;
                    const exactRef=ref.length>=6&&txRef===ref;
                    if(exactRef)return {t,score:1000,reason:'Exact UTR/IMPS/reference + amount + direction',exactRef:true,dateDiff};
                    if(dateDiff<=7)return {t,score:100-dateDiff,reason:`Same amount and direction; date difference ${dateDiff} day(s)${item.accountHint?' + account hint':''}`,exactRef:false,dateDiff};
                    return null;
                }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,5);
            }
            /**
             * Handles the auto reconcile exact matches workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async autoReconcileExactMatches(){
                const inbox=(this.data.smsInbox||[]).filter(x=>(x.status||'pending')==='pending');
                if(!inbox.length){alert('There are no pending SMS records to reconcile.');return;}
                const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
                const dayOf=v=>{const d=this.smsDateDay(v);return Number.isFinite(d)?d:null;};
                const ledger=(this.data.tx||[]).filter(t=>t&&!this.isSmsTx(t)&&!t.excludedFromLedger);
                const usedTx=new Set((this.data.smsInbox||[]).filter(x=>x.status==='matched'&&x.matchedTransactionId).map(x=>String(x.matchedTransactionId)));
                let matched=0,ambiguous=0,unmatched=0,refMatches=0,detailMatches=0;
                const decisions=[];
                for(const item of inbox){
                    const ref=norm(item.reference);
                    const amount=Math.round((Number(item.amount)||0)*100);
                    const smsDay=dayOf(item.date);
                    const candidates=ledger.filter(t=>{
                        if(usedTx.has(String(t.id)))return false;
                        const txAmount=Math.round((Number(t.amount)||0)*100);
                        if(!amount||txAmount!==amount)return false;
                        const sameDirection=(item.type==='Income')===(t.type==='Income');
                        if(!sameDirection)return false;
                        const hint=norm(item.accountHint);
                        const account=norm(t.account);
                        if(hint && !account.includes(hint))return false;
                        const txRef=norm(t.reference||t.transactionId||t.utr);
                        const exactRef=ref.length>=6 && txRef===ref;
                        const txDay=dayOf(t.date);
                        const dateClose=smsDay!==null&&txDay!==null&&Math.abs(smsDay-txDay)<=1;
                        // Fallback is intentionally conservative: amount + direction + date window,
                        // plus account hint when present. It must identify exactly one unused ledger row.
                        return exactRef || dateClose;
                    }).map(t=>{
                        const txRef=norm(t.reference||t.transactionId||t.utr);
                        const exactRef=ref.length>=6 && txRef===ref;
                        const txDay=dayOf(t.date);
                        const dateDiff=smsDay!==null&&txDay!==null?Math.abs(smsDay-txDay):99;
                        return {t,exactRef,dateDiff};
                    });
                    // Prefer exact references. If no exact-reference candidate exists, use the conservative date/amount fallback.
                    const exact=candidates.filter(c=>c.exactRef);
                    const eligible=exact.length?exact:candidates.filter(c=>c.dateDiff<=1);
                    if(eligible.length===1){
                        const {t,exactRef,dateDiff}=eligible[0];
                        item.status='matched';item.matchedTransactionId=String(t.id);
                        item.matchReason=exactRef?'Auto-matched: unique exact reference + amount + direction':'Auto-matched: unique amount + direction + date within 1 day'+(item.accountHint?' + account hint':'');
                        item.reviewedAt=new Date().toISOString();usedTx.add(String(t.id));matched++;
                        if(exactRef)refMatches++;else detailMatches++;
                        decisions.push({sms:item.id,tx:String(t.id)});
                    }else if(eligible.length>1){ambiguous++;}
                    else {unmatched++;}
                }
                if(!matched){
                    alert(`Auto-reconciliation complete.\nMatched automatically: 0\nAmbiguous: ${ambiguous}\nUnmatched or not eligible: ${unmatched}\n\nNo records were changed. For automatic matching, a unique exact reference is preferred; otherwise the amount, direction and date (within 1 day) must identify exactly one unused Core Ledger transaction.`);
                    return;
                }
                const saved=await this.saveVault();
                if(saved===false){
                    for(const d of decisions){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(d.sms));if(item&&item.matchedTransactionId===d.tx){item.status='pending';delete item.matchedTransactionId;delete item.matchReason;delete item.reviewedAt;}}
                    this.renderSmsReconciliation();return;
                }
                this.renderSmsReconciliation();
                alert(`Auto-reconciliation complete.\nMatched automatically: ${matched}\n• Exact reference matches: ${refMatches}\n• Unique amount/date matches: ${detailMatches}\nAmbiguous: ${ambiguous}\nUnmatched or not eligible: ${unmatched}\n\nNo Core Ledger transactions were created or deleted, and no account balances were changed. Ambiguous records remain pending for review.`);
            }

            /**
             * Renders the  sms reconciliation UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderSmsReconciliation(){
                const body=document.getElementById('sms-reconcile-tbody'); if(!body)return;
                const inbox=this.data.smsInbox||(this.data.smsInbox=[]);
                const counts={pending:0,matched:0,merged:0,ignored:0,duplicate:0,error:0};
                inbox.forEach(x=>{const st=x.status||'pending';counts[st]=(counts[st]||0)+1;});
                const summary=document.getElementById('sms-reconcile-summary');
                if(summary) summary.innerHTML=[['Pending review',counts.pending||0],['Matched to bank',counts.matched||0],['Merged to ledger',counts.merged||0],['Ignored',counts.ignored||0],['Duplicates',counts.duplicate||0],['Errors',counts.error||0]].map(([label,n])=>`<div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-500">${label}</div><div class="text-xl font-bold">${n}</div></div>`).join('');
                const filter=document.getElementById('sms-reconcile-filter')?.value||'all';
                const visible=inbox.filter(x=>filter==='all'||(x.status||'pending')===filter);
                if(!visible.length){body.innerHTML=`<tr><td colspan="7" class="p-6 text-center text-slate-500">${inbox.length?'No SMS records for this status filter.':'No SMS records staged yet. Paste SMS text or upload an SMS backup above.'}</td></tr>`;return;}
                body.innerHTML=visible.map(item=>{
                    const status=item.status||'pending';
                    const matches=status==='pending'?this.findSmsMatches(item):[];
                    const matchHtml=matches.length?`<div class="space-y-2"><div class="text-xs font-semibold text-slate-600">${matches.length} candidate(s) — compare before confirming</div>${matches.map((candidate,i)=>`<div class="rounded-lg border ${candidate.exactRef?'border-emerald-300 bg-emerald-50/50':'border-slate-200 dark:border-slate-700'} p-2 space-y-1"><div class="font-medium">${this.escapeHtml(candidate.t.date||'')} · ${this.escapeHtml(candidate.t.account||'')} · ${CUR()}${(Number(candidate.t.amount)||0).toLocaleString('en-IN')}</div><div class="text-slate-500">${this.escapeHtml(candidate.reason)}</div><div class="text-slate-500">Type: ${this.escapeHtml(candidate.t.type||'Unknown')} · Reference: ${this.escapeHtml(candidate.t.reference||candidate.t.transactionId||candidate.t.utr||'—')}</div><button class="px-2 py-1 rounded ${candidate.exactRef?'bg-emerald-600':'bg-slate-700'} text-white" onclick="app.confirmSmsMatch('${String(item.id).replace(/'/g,"\\'")}','${String(candidate.t.id).replace(/'/g,"\\'")}')">${candidate.exactRef?'Confirm reference match':'Confirm candidate '+(i+1)}</button></div>`).join('')}${matches.length>1?'<div class="text-amber-700">Multiple candidates found. Confirm only after comparing the reference and transaction details.</div>':''}</div>`:'<span class="text-slate-500">No likely match found</span>';
                    let actions='';
                    if(status==='pending') actions=`<button class="px-2 py-1 rounded border" onclick="app.mergeSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Merge to Core Ledger</button> <button class="px-2 py-1 rounded border" onclick="app.ignoreSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Ignore</button>`;
                    else if(status==='ignored'||status==='duplicate'||status==='error') actions=`<button class="px-2 py-1 rounded border" onclick="app.reopenSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Return to pending</button>`;
                    else actions=`<span class="text-slate-500">${this.escapeHtml(status)}</span>`;
                    return `<tr class="border-b border-slate-100 dark:border-slate-800 align-top"><td class="p-2 whitespace-nowrap">${this.escapeHtml(item.date||'')}</td><td class="p-2 min-w-56"><div class="font-medium">${this.escapeHtml(item.payee||item.description||'SMS')}</div><div class="text-slate-500 whitespace-normal">${this.escapeHtml(item.description||'')}</div><div class="text-slate-400">${this.escapeHtml(item.sourceFile||'')}</div></td><td class="p-2 whitespace-nowrap">${item.type==='Income'?'+':'−'}${CUR()}${(Number(item.amount)||0).toLocaleString('en-IN')}</td><td class="p-2">${this.escapeHtml(item.reference||'—')}</td><td class="p-2 min-w-64">${status==='pending'?matchHtml:this.escapeHtml(item.matchedTransactionId||item.matchReason||'—')}</td><td class="p-2">${this.escapeHtml(status)}</td><td class="p-2 min-w-40">${actions}</td></tr>`;
                }).join('');
            }
            /**
             * Handles the refresh sms matches workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            refreshSmsMatches(){
                this.renderSmsReconciliation();
                const pending=(this.data.smsInbox||[]).filter(x=>(x.status||'pending')==='pending');
                const withMatch=pending.filter(x=>this.findSmsMatches(x).length).length;
                const time=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
                const msg=pending.length?`Checked ${pending.length} pending SMS against Core Ledger at ${time}: ${withMatch} with possible matches, ${pending.length-withMatch} with none.`:`No pending SMS to check (${time}).`;
                const el=document.getElementById('sms-refresh-status');
                if(el){el.textContent=msg;el.classList.remove('hidden');}else alert(msg);
            }
            /**
             * Handles the reopen sms inbox workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId. Side effects, if any, are described by the statements below.
             */
            reopenSmsInbox(inboxId){
                const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));
                if(!item||!['ignored','duplicate','error'].includes(item.status))return;
                item.status='pending'; item.reviewedAt=null; item.matchReason='Returned to pending by user';
                this.saveVault(); this.renderSmsReconciliation();
            }
            /**
             * Handles the confirm sms match workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId,txId. Side effects, if any, are described by the statements below.
             */
            async confirmSmsMatch(inboxId,txId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));const tx=(this.data.tx||[]).find(x=>String(x.id)===String(txId)&&!this.isSmsTx(x));if(!item||!tx)return alert('The SMS or bank transaction could not be found. Refresh and review again.');if(!await this.uiConfirm(`Mark this SMS as already present in Core Ledger?\n\nSMS: ${item.date} ${CUR()}${item.amount} ${item.payee}\nBank transaction: ${tx.date} ${CUR()}${tx.amount} ${tx.payee||tx.description||''}\n\nNo new transaction will be created.`))return;item.status='matched';item.matchedTransactionId=String(tx.id);item.matchReason='Human confirmed';item.reviewedAt=new Date().toISOString();this.saveVault();this.renderSmsReconciliation();}
            /**
             * Handles the merge sms inbox workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId. Side effects, if any, are described by the statements below.
             */
            async mergeSmsInbox(inboxId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));if(!item||item.status!=='pending')return;if(this.findSmsMatches(item).length&&!await this.uiConfirm('A possible bank match exists. Merge anyway and create a new Core Ledger transaction?'))return;if(!await this.uiConfirm(`Merge this SMS into Core Ledger?\n${item.date} · ${CUR()}${item.amount} · ${item.payee}\nThis will create one ledger transaction and affect the selected account balance if that account exists.`))return;const accountHint=item.accountHint;let account=accountHint?(this.data.accounts||[]).find(a=>String(a.name||'').includes(accountHint)):null;if(!account)account=this.getGlobalDefaultAccount();if(!account)return alert('Create or select an account in Accounts & Wallets before merging.');const tx={id:'sms_merge_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),date:item.date,type:item.type,amount:Number(item.amount)||0,account:account.name,category:item.category||'Uncategorized',subcategory:item.subcategory||'',payee:item.payee||'',notes:item.notes||'',description:item.description||'',reference:item.reference||'',originalSmsDate:item.originalSmsDate||item.date,source:'sms-reconciled',smsInboxId:item.id};if(!await this.uiConfirm('Final check: add this transaction to the master ledger and apply its balance impact?'))return;this.ensureCategoryAndSubcategory(tx.category,tx.subcategory);this.data.tx.unshift(tx);const delta=tx.type==='Income'?tx.amount:(['Transfer','Investment'].includes(tx.type)?0:-tx.amount);account.balance=(Number(account.balance)||0)+delta;item.status='merged';item.mergedTransactionId=tx.id;item.mergedAt=new Date().toISOString();item.mergedAccount=account.name;this.saveVault();this.renderAll();this.renderSmsReconciliation();}
            /**
             * Handles the ignore sms inbox workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId. Side effects, if any, are described by the statements below.
             */
            async ignoreSmsInbox(inboxId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));if(!item||item.status!=='pending')return;if(!await this.uiConfirm('Mark this SMS as ignored? The original message will remain in the SMS Ledger and no financial records will change.'))return;item.status='ignored';item.reviewedAt=new Date().toISOString();this.saveVault();this.renderSmsReconciliation();}

        }
