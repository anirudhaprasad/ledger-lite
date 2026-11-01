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
            // Non-SMS entries (manual, aifico ledger spreadsheet, statement, scheduled) are always the actual record; among SMS entries the first one imported wins.
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
                        // Some backup apps write each field as a child element (<address>…</address>) instead of an attribute
                        date: n.getAttribute('date') || n.getAttribute('date_sent') || n.getElementsByTagName('date')[0]?.textContent || '',
                        type: n.getAttribute('type') || n.getElementsByTagName('type')[0]?.textContent || '',
                        address: n.getAttribute('address') || n.getElementsByTagName('address')[0]?.textContent || ''
                    })).filter(m => m.body.trim() && String(m.type) !== '2');   // type 2 = messages you sent
                    if (!messages.length) throw new Error('Message records were found, but none contained readable message text.');
                    this.importSmsMessages(messages, file.name);
                    if (status) { status.textContent = `Read ${messages.length} message(s) from ${file.name}.`; status.classList.remove('hidden'); status.classList.add('text-emerald-600'); }
                } catch (e) {
                    alert('Could not read SMS backup XML: ' + (e.message || e));
                    if (status) { status.textContent = e.message || String(e); status.classList.remove('hidden'); status.classList.add('text-rose-600'); }
                } finally { event.target.value = ''; }
            }

            /**
             * Who the money went to (or came from) in a bank SMS. "UPI/Ola" and "to VPA swiggy@icici" give Ola and swiggy@icici;
             * words like Rs, A/c, NEFT or UPI are never a payee. Spending prefers "to/at/towards", income prefers "from/by".
             */
            smsPayee(line,type){
                const text=String(line||''); const skip=/^(rs\.?|inr|your|you|a\/?c|ac|acct|account|card|the|upi|vpa|bank|neft|imps|rtgs|cheque|cash|ref|txn|a)$/i;
                // Axis style: "MOB/TPFT/RAVI KUMAR/TP …", "IMPS/628200001234/ACME PVT Not you?", "SAK/NETFLIX/…"
                const slash=text.match(/\b(?:MOB|IMPS|NEFT|RTGS|SAK|INB|BIL)\/(?:[A-Z]{2,6}\/|\d{6,}\/)?([A-Za-z][A-Za-z0-9 .&_-]{1,30}?)(?=\/|\s+(?:Not you|WhatsApp|BAL|Avl|Ref)\b|$)/i);
                if(slash&&!skip.test(slash[1].trim())&&!/^(tpft|p2[pm]|ref)$/i.test(slash[1].trim()))return slash[1].trim();
                const upi=text.match(/\bUPI[\/-]([A-Za-z][A-Za-z0-9 .&_-]{1,30}?)(?=[\/\s.;,]|$)/i); if(upi&&!skip.test(upi[1])&&!/^(p2[pm]|ref|txn|cr|dr)$/i.test(upi[1]))return upi[1].trim();
                const re=/\b(to|at|from|towards|for|by)\s+(?:VPA\s+)?([A-Za-z][A-Za-z0-9 .&@_-]{1,35}?)(?=\s+(?:on|ref|upi|txn|transaction|avl|available|bal|a\/c|ac\s|ending|via|using|to|from|by|at|towards|for)\b|\s*[(.;,\/]|$)/gi;
                const found=[]; let m; while((m=re.exec(text))){ const name=m[2].trim().replace(/\s+/g,' '); if(name.length<2||skip.test(name.split(' ')[0]))continue; found.push({prep:m[1].toLowerCase(),name}); }
                // Spending: "from" is your own account or bank, so it is never the payee. Income: "to" is your account.
                const order=type==='Income'?['from','by','at','towards','for']:['to','at','towards','for','by'];
                for(const prep of order){ const hit=found.find(f=>f.prep===prep); if(hit)return hit.name; }
                // "…debited for Rs 199; Spotify credited": the other side is named before "credited"
                if(type!=='Income'){ const cr=text.match(/[;.]\s*([A-Za-z][A-Za-z0-9 .&@_-]{1,30}?)\s+credited\b/i); if(cr&&!skip.test(cr[1].split(' ')[0]))return cr[1].trim(); }
                // "Info: NEFT-RENT OCT-RAMESH K": the bank's own description
                const info=text.match(/\binfo\s*:\s*(?:(?:neft|imps|rtgs|upi|ach|nach)[\s\/-]*)?([A-Za-z][^.;]{1,40})/i); if(info)return info[1].replace(/[-_\/]+/g,' ').replace(/\s+/g,' ').trim().slice(0,30);
                return '';
            }
            /**
             * Account and card digits an SMS names, in order: "a/c ending XX861", "Acct XX861", "A/C XX123456", "Ac XX1234",
             * "a/c no. XX1234", "Credit Card 4321", "credit card ending 21". A transfer SMS names two (debited first).
             * Returns [{digits, card}].
             */
            smsAccountRefs(line){
                const re=/\b(?:(credit\s+card|debit\s+card|card)|a\/c|acct?|acc|account|ac)\b\.?\s*(?:no\.?\s*)?(?:ending\s*(?:with\s*)?)?(?:XX+|X+|\*+)?\s?(\d{2,6})\b/gi;
                const out=[]; let m; while((m=re.exec(String(line||'')))){ if(!out.some(r=>r.digits===m[2]))out.push({digits:m[2],card:!!m[1]}); } return out;
            }
            /**
             * Did money move? An amount plus a debit/credit word in any bank's wording ("debited", "Debit INR", "has a debit by
             * transfer", "Credit INR", "Thank you for payment of INR … towards your card"). Not: OTPs, declined or failed
             * transactions, statements, bills and reminders, mandates being set up, EMI conversions, "will be debited".
             */
            smsIsTransaction(body){ return !this.smsSkipReason(body); }
            /** Why an SMS is not a transaction ('' when it is): the reason shown in the Skipped SMS list */
            smsSkipReason(body){
                const s=String(body||''); const R=this.smsRules();
                const ignore=R.ignoreWords.find(w=>this.smsWordAt(s,w)>=0); if(ignore)return `Has your ignore word "${ignore}"`;
                if(!/(?:INR|Rs\.?|₹)\s*[0-9]/i.test(s))return 'No amount found';
                const own=[...R.outWords,...R.inWords].some(w=>this.smsWordAt(s,w)>=0);
                const moved=own||/\b(debit(?:ed)?|credit(?:ed)?|spent|withdrawn|received|deposited|paid|sent|transferred|purchase|refund(?:ed)?|reversed|payment of)\b/i.test(s);
                if(!moved)return 'No debit or credit word';
                if(/\b(OTP|one[- ]time password|verification code)\b/i.test(s)&&!/\b(debited|credited|withdrawn|spent)\b/i.test(s))return 'Looks like an OTP';
                const m=s.match(/\b(declined|failed|unsuccessful|will be (?:debited|executed|charged)|is due|due (?:on|by|date)|bill (?:of|for|is|dated)|ignore if already paid|e-?statement|statement (?:is|for)|mandate[^.]{0,40}\b(?:is now active|registered)|converted to EMIs?|credit balance of|reported to)\b/i);
                return m?`Says "${m[1].trim().slice(0,30)}": no money moved`:'';
            }

            // ── SMS rules (Settings → SMS rules) ─────────────────────────────────────────────────────────────────────────
            // data.smsRules = { senders: {AXISBK: {mode:'always'|'never'|'', account, outWords, inWords, payeePrefix}},
            //   outWords, inWords, ignoreWords: [], payeeCats: [{match, category, subcategory}] }
            // data.smsSkipped = [{id, sender, body, date, reason, source, at}] (newest first, at most 300)
            smsRules(){ const r=(this.data.smsRules&&typeof this.data.smsRules==='object')?this.data.smsRules:(this.data.smsRules={});
                r.senders=r.senders&&typeof r.senders==='object'?r.senders:{}; ['outWords','inWords','ignoreWords','payeeCats'].forEach(k=>{ if(!Array.isArray(r[k]))r[k]=[]; }); return r; }
            smsSenderKey(address){ return String(address||'').trim().toUpperCase().replace(/^[A-Z]{2}-/,'').replace(/-[A-Z]$/,''); }
            /** Where a word (or phrase) of yours starts in the SMS, as a whole word, ignoring case; -1 if absent */
            smsWordAt(text,word){ const w=String(word||'').trim(); if(!w)return -1; const m=String(text||'').match(new RegExp('(^|[^A-Za-z0-9])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z0-9])','i')); return m?m.index+m[1].length:-1; }
            /** A payee position taught for this sender: the text after the taught prefix, up to "/", a line break or " Not you" */
            smsTaughtPayee(line,srule){ const pre=srule&&srule.payeePrefix; if(!pre)return ''; const i=String(line).toUpperCase().indexOf(pre.toUpperCase()); if(i<0)return '';
                const rest=String(line).slice(i+pre.length); const suf=srule.payeeSuffix?srule.payeeSuffix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):'';
                // Up to the word that followed the payee when it was taught ("… SHARMA STORES towards bill"), else a separator
                const m=rest.match(new RegExp('^\\s*([^\\/\\n\\r]{2,40}?)(?='+(suf?'\\s+'+suf+'(?![A-Za-z0-9])|':'')+'\\/|\\n|\\r|\\s+(?:not you|on \\d|ref|avl|bal|info)\\b|[.;]|$)','i')); return m?m[1].trim():''; }
            smsSkipped(){ return Array.isArray(this.data.smsSkipped)?this.data.smsSkipped:(this.data.smsSkipped=[]); }
            /** Keep a skipped SMS with its reason, when it could matter: from a bank-style sender, or with an amount in it */
            logSkippedSms(msg,line,reason,source){
                const sender=this.smsSenderKey(msg&&msg.address); const bankish=/^[A-Z0-9]{3,9}$/.test(sender)&&/[A-Z]/.test(sender);
                if(!bankish&&!/(?:INR|Rs\.?|₹)\s*[0-9]/i.test(line))return;
                const list=this.smsSkipped(); const key=sender+'|'+String(line).replace(/\s+/g,' ').trim();
                const old=list.findIndex(x=>(x.sender+'|'+String(x.body).replace(/\s+/g,' ').trim())===key); if(old>=0){ list[old].reason=reason; return; }
                list.unshift({id:'skip_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),sender,address:String(msg&&msg.address||''),body:String(line).slice(0,600),date:String(msg&&msg.date||''),reason,source:String(source||''),at:new Date().toISOString()});
                if(list.length>300)list.length=300;
            }
            /** Settings card: counts and the buttons for the SMS rules screens */
            renderSmsRulesCard(){
                const R=this.smsRules(), n=this.smsSkipped().length, el=document.getElementById('sms-rules-summary'); if(!el)return;
                const senders=Object.entries(R.senders).filter(([,v])=>v&&(v.mode||v.account||(v.outWords||[]).length||(v.inWords||[]).length||v.payeePrefix)).length;
                el.textContent=`${n} skipped SMS · ${senders} sender setting${senders===1?'':'s'} · ${R.outWords.length+R.inWords.length+R.ignoreWords.length} word${R.outWords.length+R.inWords.length+R.ignoreWords.length===1?'':'s'} · ${R.payeeCats.length} payee rule${R.payeeCats.length===1?'':'s'}`;
                const b=document.getElementById('sms-skipped-link'); if(b){ b.hidden=!n; b.textContent=`${n} skipped bank SMS: review`; }
            }
            smsRulesModal(title,inner){ const box=document.getElementById('modal-box'); box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-lg">${this.escapeHtml(title)}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>${inner}`; document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.(); }

            /** 1. Skipped SMS: every message the reader passed over, with the reason; Add anyway, Teach, or Remove */
            openSkippedSms(){
                const esc=v=>this.escapeHtml(String(v??'')); const list=this.smsSkipped();
                const rows=list.slice(0,150).map(x=>{ const id=esc(x.id); const when=x.date&&/^\d{10,13}$/.test(x.date)?new Date(Number(x.date)).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
                    return `<li class="sk-row"><div class="sk-head"><b>${esc(x.sender||'Unknown sender')}</b><span>${esc(when)}</span></div><div class="sk-reason">${esc(x.reason)}</div><div class="sk-body">${esc(x.body)}</div>
                    <div class="sk-actions"><button type="button" class="s-btn s-primary" onclick="app.addSkippedSms('${id}')">Add anyway</button><button type="button" class="s-btn s-secondary" onclick="app.openSmsTeach({skippedId:'${id}'})">Teach</button><button type="button" class="s-btn s-secondary" onclick="app.dismissSkippedSms('${id}')">Remove</button></div></li>`; }).join('');
                this.smsRulesModal('Skipped SMS',`<p class="text-sm text-slate-500 mb-2">Messages from banks that were not added, and why. <b>Add anyway</b> puts one in the review list; <b>Teach</b> lets you correct it and remember how to read that sender.</p>
                    ${list.length?`<ul class="sk-list">${rows}</ul>${list.length>150?`<p class="text-xs text-slate-500">Showing the newest 150 of ${list.length}.</p>`:''}<div class="flex justify-end pt-2"><button type="button" class="s-btn s-secondary" onclick="app.clearSkippedSms()">Clear the list</button></div>`:'<p class="text-sm">Nothing skipped.</p>'}`);
            }
            addSkippedSms(id){
                const x=this.smsSkipped().find(s=>s.id===id); if(!x)return;
                const res=this.importSmsMessages([{body:x.body,date:x.date,address:x.address||x.sender}],x.source||'Skipped SMS',{quiet:true,force:true,noSkipLog:true});
                if(!res.added){ return this.openSmsTeach({skippedId:id,note:'The amount or direction could not be read. Fill them in below.'}); }
                this.data.smsSkipped=this.smsSkipped().filter(s=>s.id!==id); this.saveVault(); this.renderSmsRulesCard(); this.renderSmsReconciliation(); this.openSkippedSms(); this.showToast('Added to the SMS review list.');
            }
            dismissSkippedSms(id){ this.data.smsSkipped=this.smsSkipped().filter(s=>s.id!==id); this.saveVault(); this.renderSmsRulesCard(); this.openSkippedSms(); }
            async clearSkippedSms(){ if(!await this.uiConfirm('Clear the skipped SMS list? Your SMS rules stay.'))return; this.data.smsSkipped=[]; this.saveVault(); this.renderSmsRulesCard(); this.openSkippedSms(); }

            /** 2. Senders: Always / Never read, and the account to use when the SMS has no digits */
            openSmsSenders(){
                const esc=v=>this.escapeHtml(String(v??'')); const R=this.smsRules();
                const seen=new Set([...Object.keys(R.senders),...(this.data.smsInbox||[]).map(x=>this.smsSenderKey(x.sender)),...this.smsSkipped().map(x=>x.sender)].filter(s=>/^[A-Z0-9]{3,9}$/.test(s)&&/[A-Z]/.test(s)));
                const accounts=this.data.accounts||[]; const list=[...seen].sort();
                const rows=list.map(s=>{ const r=R.senders[s]||{}; const sj=esc(s);
                    return `<li class="sr-row"><div class="sr-name"><b>${sj}</b><span>${esc(this.smsBankKey(s)||'')}</span></div>
                    <label class="mf-compact"><span>Read</span><select onchange="app.setSmsSender('${sj}','mode',this.value)"><option value="">Automatic</option><option value="always" ${r.mode==='always'?'selected':''}>Always</option><option value="never" ${r.mode==='never'?'selected':''}>Never</option></select></label>
                    <label class="mf-compact"><span>Account when no digits</span><select onchange="app.setSmsSender('${sj}','account',this.value)"><option value="">Automatic</option>${accounts.map(a=>`<option ${a.name===r.account?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
                    ${(r.outWords||[]).length||(r.inWords||[]).length||r.payeePrefix?`<div class="text-xs text-slate-500">Taught: ${[(r.outWords||[]).length?'out "'+r.outWords.join('", "')+'"':'',(r.inWords||[]).length?'in "'+r.inWords.join('", "')+'"':'',r.payeePrefix?'payee after "'+r.payeePrefix+'"':''].filter(Boolean).map(esc).join(' · ')} <button type="button" class="underline" onclick="app.forgetSmsSender('${sj}')">Forget</button></div>`:''}</li>`; }).join('');
                this.smsRulesModal('SMS senders',`<p class="text-sm text-slate-500 mb-2"><b>Always</b> reads every SMS with an amount from that sender, <b>Never</b> ignores the sender. The account is used when an SMS has no account digits.</p>${list.length?`<ul class="sr-list">${rows}</ul>`:'<p class="text-sm">No bank senders yet. Import or read some SMS first.</p>'}
                    <form class="flex gap-2 items-end pt-3" onsubmit="event.preventDefault();app.setSmsSender(this.s.value,'mode','');app.openSmsSenders()"><label class="mf-compact flex-1"><span>Add a sender (e.g. AXISBK)</span><input name="s" maxlength="12" required pattern="[A-Za-z0-9-]{3,14}"></label><button class="s-btn s-secondary">Add</button></form>`);
            }
            setSmsSender(sender,key,value){ const s=this.smsSenderKey(sender); if(!s)return; const R=this.smsRules(); const r=R.senders[s]||(R.senders[s]={}); if(value)r[key]=value; else delete r[key]; this.saveVault(); this.renderSmsRulesCard(); }
            forgetSmsSender(sender){ const r=this.smsRules().senders[sender]; if(r){ delete r.outWords; delete r.inWords; delete r.payeePrefix; } this.saveVault(); this.openSmsSenders(); }

            /** 4. Your own words: money out, money in, and ignore */
            openSmsWords(){
                const R=this.smsRules(); const v=a=>this.escapeHtml(a.join(', '));
                this.smsRulesModal('SMS words',`<p class="text-sm text-slate-500 mb-2">Extra words your banks use, separated by commas. They work with the built-in ones.</p>
                    <form id="sms-words-form" class="space-y-3"><label class="block text-sm">Money out<input id="sw-out" maxlength="300" placeholder="e.g. Dr, withdrawal, debit by transfer" value="${v(R.outWords)}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                    <label class="block text-sm">Money in<input id="sw-in" maxlength="300" placeholder="e.g. Cr, deposit, received from" value="${v(R.inWords)}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                    <label class="block text-sm">Ignore SMS with<input id="sw-ignore" maxlength="300" placeholder="e.g. pre-approved, EMI offer, cashback up to" value="${v(R.ignoreWords)}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                    <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="s-btn s-secondary">Cancel</button><button class="s-btn s-primary">Save</button></div></form>`);
                document.getElementById('sms-words-form').onsubmit=e=>{ e.preventDefault(); const list=id=>[...new Set(document.getElementById(id).value.split(',').map(x=>x.trim()).filter(x=>x.length>=2))].slice(0,40);
                    Object.assign(R,{outWords:list('sw-out'),inWords:list('sw-in'),ignoreWords:list('sw-ignore')}); this.saveVault(); this.renderSmsRulesCard(); this.closeModal(); this.showToast('SMS words saved. They apply to SMS read or imported from now on.'); };
            }

            /** 5. Payee → category: an SMS whose payee or text contains the words gets that category */
            openSmsPayeeCats(){
                const esc=v=>this.escapeHtml(String(v??'')); const R=this.smsRules(); const cats=this.data.categories||[];
                const rows=R.payeeCats.map((r,i)=>`<li class="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700"><span><b>${esc(r.match)}</b> → ${esc(r.category)}${r.subcategory?' / '+esc(r.subcategory):''}</span><button type="button" class="s-btn s-secondary" onclick="app.removeSmsPayeeCat(${i})">Remove</button></li>`).join('');
                this.smsRulesModal('Payee → category',`<p class="text-sm text-slate-500 mb-2">When an SMS's payee or text contains these words, it gets this category. Applies to SMS added from now on, and to pending ones with <b>Apply to pending</b>.</p>
                    <ul class="space-y-2">${rows||'<li class="text-sm">No rules yet.</li>'}</ul>
                    <form id="sms-pc-form" class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end pt-3"><label class="mf-compact"><span>Payee or text contains</span><input id="spc-match" required maxlength="40" placeholder="e.g. Swiggy"></label>
                    <label class="mf-compact"><span>Category</span><select id="spc-cat">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label class="mf-compact"><span>Subcategory</span><input id="spc-sub" maxlength="40" placeholder="Optional"></label><button class="s-btn s-primary">Add rule</button></form>
                    <div class="flex justify-end pt-3"><button type="button" class="s-btn s-secondary" onclick="app.applySmsPayeeCats()">Apply to pending SMS</button></div>`);
                document.getElementById('sms-pc-form').onsubmit=e=>{ e.preventDefault(); const match=document.getElementById('spc-match').value.trim(); if(!match)return;
                    R.payeeCats=R.payeeCats.filter(r=>r.match.toLowerCase()!==match.toLowerCase()); R.payeeCats.push({match,category:document.getElementById('spc-cat').value,subcategory:document.getElementById('spc-sub').value.trim()}); this.saveVault(); this.renderSmsRulesCard(); this.openSmsPayeeCats(); };
            }
            removeSmsPayeeCat(i){ const R=this.smsRules(); R.payeeCats.splice(i,1); this.saveVault(); this.renderSmsRulesCard(); this.openSmsPayeeCats(); }
            applySmsPayeeCats(){ const R=this.smsRules(); let n=0; (this.data.smsInbox||[]).filter(x=>(x.status||'pending')==='pending'&&x.type!=='Transfer').forEach(x=>{ const r=R.payeeCats.find(r=>String(x.payee||'').toLowerCase().includes(r.match.toLowerCase())||String(x.description||'').toLowerCase().includes(r.match.toLowerCase())); if(r&&(x.category!==r.category||(x.subcategory||'')!==(r.subcategory||''))){ x.category=r.category; x.subcategory=r.subcategory||''; n++; } });
                this.saveVault(); this.renderSmsReconciliation(); this.showToast(`${n} pending SMS updated.`); }

            /** 3. Teach from an SMS: correct what was read, add it, and remember how to read that sender next time */
            openSmsTeach(src={}){
                const esc=v=>this.escapeHtml(String(v??'')); const sk=src.skippedId?this.smsSkipped().find(x=>x.id===src.skippedId):null;
                // A pending SMS that was read wrongly: teaching replaces it
                const pend=src.inboxId?(this.data.smsInbox||[]).find(x=>String(x.id)===String(src.inboxId)&&(x.status||'pending')==='pending'):null;
                if(pend)src={...src,body:pend.description,sender:pend.sender,date:pend.originalSmsDate||''};
                const body=sk?sk.body:String(src.body||''), address=sk?(sk.address||sk.sender):String(src.sender||''); const sender=this.smsSenderKey(address);
                const amount=(body.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i)||[])[1]||'';
                const outW=body.match(/\b(debit(?:ed)?|dr|withdrawn|withdrawal|spent|paid|sent|purchase|transferred)\b/i), inW=body.match(/\b(credit(?:ed)?(?!\s*card)|cr|received|deposited|refund(?:ed)?|reversed)\b/i);
                const dir=outW&&(!inW||outW.index<inW.index)?'Expense':(inW?'Income':'Expense'); const word=((dir==='Expense'?outW:inW)||[])[1]||'';
                const payee=this.smsTaughtPayee(body,this.smsRules().senders[sender])||this.smsPayee(body,dir)||'';
                const own=this.smsResolveAccount({accountRefs:this.smsAccountRefs(body),sender:address}); const accounts=this.data.accounts||[];
                this.smsRulesModal('Teach from this SMS',`${src.note?`<p class="text-sm text-amber-700 dark:text-amber-300 mb-2">${esc(src.note)}</p>`:''}<div class="sk-body mb-3">${esc(body)}</div>
                    <form id="sms-teach-form" class="space-y-3"><div class="grid grid-cols-2 gap-2"><label class="mf-compact"><span>Money</span><select id="st-dir"><option value="Expense" ${dir==='Expense'?'selected':''}>Out (debit)</option><option value="Income" ${dir==='Income'?'selected':''}>In (credit)</option></select></label>
                    <label class="mf-compact"><span>Amount${CURL()}</span><input id="st-amount" type="number" step="0.01" min="0.01" required value="${esc(String(amount).replace(/,/g,''))}"></label></div>
                    <div class="grid grid-cols-2 gap-2"><label class="mf-compact"><span>Payee</span><input id="st-payee" maxlength="60" value="${esc(payee)}"></label>
                    <label class="mf-compact"><span>Account</span><select id="st-account">${accounts.map(a=>`<option ${own&&a.name===own.account.name?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label></div>
                    ${sender?`<fieldset class="space-y-2 border-t pt-2"><legend class="text-sm font-semibold">Remember for ${esc(sender)}</legend>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="st-always" checked> Always read SMS from ${esc(sender)}</label>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="st-word" ${word?'checked':''}> Remember a word that means this direction</label>
                    <label class="mf-compact"><span>Word</span><input id="st-wordv" maxlength="30" value="${esc(word)}" placeholder="e.g. Dr"></label>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="st-payeepos" ${payee?'checked':''}> Read the payee from the same place next time</label>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="st-acc"> Use this account when ${esc(sender)} SMS have no account digits</label></fieldset>`:''}
                    <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="s-btn s-secondary">Cancel</button><button class="s-btn s-primary">Add to review list</button></div></form>`);
                document.getElementById('sms-teach-form').onsubmit=e=>{ e.preventDefault(); const $=id=>document.getElementById(id);
                    const direction=$('st-dir').value, amt=Number($('st-amount').value), payeeV=$('st-payee').value.trim(), account=$('st-account').value;
                    if(!(amt>0))return alert('Enter the amount.');
                    if(sender){ const R=this.smsRules(); const r=R.senders[sender]||(R.senders[sender]={});
                        if($('st-always').checked)r.mode='always';
                        const w=$('st-wordv').value.trim(); if($('st-word').checked&&w){ const k=direction==='Income'?'inWords':'outWords', other=direction==='Income'?'outWords':'inWords'; r[k]=[...new Set([...(r[k]||[]),w])]; r[other]=(r[other]||[]).filter(x=>x.toLowerCase()!==w.toLowerCase()); }
                        if($('st-payeepos').checked&&payeeV){ const i=body.toUpperCase().indexOf(payeeV.toUpperCase()); if(i>0){ const before=body.slice(Math.max(0,i-16),i); const pre=before.slice(Math.max(0,before.lastIndexOf(' ',before.length-2)+1)).trimStart(); if(pre.trim())r.payeePrefix=pre;
                            const after=(body.slice(i+payeeV.length).match(/^\s+([A-Za-z]{2,15})\b/)||[])[1]; if(after)r.payeeSuffix=after; else delete r.payeeSuffix; } }
                        if($('st-acc').checked&&account)r.account=account; }
                    if(pend)this.data.smsInbox=(this.data.smsInbox||[]).filter(x=>x!==pend);
                    const res=this.importSmsMessages([{body,date:sk?sk.date:String(src.date||''),address}],sk?(sk.source||'Skipped SMS'):(pend?.sourceFile||'Taught SMS'),{quiet:true,force:true,noSkipLog:true,direction,amount:amt,payee:payeeV||undefined,account});
                    if(pend&&res.added&&pend.custom)this.data.smsInbox[0].custom=pend.custom;   // keep My fields already filled in
                    if(sk)this.data.smsSkipped=this.smsSkipped().filter(x=>x.id!==sk.id);
                    this.saveVault(); this.closeModal(); this.renderSmsRulesCard(); this.renderSmsReconciliation();
                    this.showToast(res.added?`Added to the SMS review list${sender?`, and remembered for ${sender}`:''}.`:'It is already in the SMS review list.'); };
            }
            /** The bank behind an SMS sender or a bank name: "VA-ICICIT-S" and "ICICI Bank" both give ICICI. */
            smsBankKey(text){
                const s=String(text||'').toUpperCase().replace(/^[A-Z]{2}-/,'').replace(/-[A-Z]$/,'');
                const banks=[['HDFC',/HDFC/],['ICICI',/ICICI/],['SBI',/\bSBI|SBYONO|CBSSBI|SBIINB|SBICRD|SBIPSG|STATE BANK/],['AXIS',/AXIS/],['KOTAK',/KOTAK|KMBL/],['IDFC',/IDFC/],['IPPB',/IPB|IPPB|INDIA POST/],['PNB',/PNB|PUNJAB NATIONAL/],['BOB',/\bBOB|BARODA/],['CANARA',/CANBNK|CANARA/],['UNION',/UNIONB|UNION BANK/],['YES',/YESBNK|YES BANK/],['INDUSIND',/INDUS/],['FEDERAL',/FEDBNK|FEDERAL/],['AU',/AUBANK|\bAU SMALL/],['RBL',/RBL/],['BOI',/BOIIND|BANK OF INDIA/],['IOB',/IOBCHN|INDIAN OVERSEAS/],['INDIAN',/INDBNK|INDIAN BANK/],['AMEX',/AMEX|AMERICAN EXPRESS/],['SCB',/SCBANK|STANDARD CHARTERED/],['HSBC',/HSBC/],['PAYTM',/PAYTM|PYTM/],['AIRTEL',/AIRBNK|AIRTEL PAYMENTS/],['JUPITER',/JUPITR/],['ONECARD',/ONECRD|ONECARD/]];
                return (banks.find(([,re])=>re.test(s))||[])[0]||'';
            }
            /** The digits saved on an account (Last digits field, the full number, and digits in its name for older vaults). */
            accountDigits(a){ return [...String(a?.lastDigits||'').split(/[^0-9]+/),String(a?.accountNumber||'').replace(/\D/g,'').slice(-6),...(String(a?.name||'').match(/\d{3,6}/g)||[])].filter(d=>d&&d.length>=2); }
            /** "861" in an SMS fits a saved "0861", and a saved "1234" fits "561234": the shorter must end the longer. */
            smsDigitsFit(a,b){ a=String(a);b=String(b); const [s,l]=a.length<=b.length?[a,b]:[b,a]; return s.length>=2&&l.endsWith(s); }
            /**
             * Which account an SMS belongs to: last digits first (cards prefer credit card accounts), the sending bank to break ties,
             * then a sender learned from earlier merges. Returns {account, to, how} (to: the other own account in a transfer) or null.
             */
            smsResolveAccount(item){
                const accounts=(this.data.accounts||[]).filter(a=>a&&a.name);
                const refs=Array.isArray(item.accountRefs)?item.accountRefs:(item.accountHint?[{digits:String(item.accountHint),card:false}]:[]);
                const sender=String(item.sender||'').toUpperCase().replace(/^[A-Z]{2}-/,'').replace(/-[A-Z]$/,''), bank=this.smsBankKey(item.sender);
                const ofBank=a=>bank&&(this.smsBankKey(a.bankName)===bank||this.smsBankKey(a.name)===bank);
                const learned=a=>sender&&(a.smsSenders||[]).includes(sender);
                const pick=ref=>{ let list=accounts.filter(a=>this.accountDigits(a).some(d=>this.smsDigitsFit(d,ref.digits)));
                    if(list.length>1){ const typed=list.filter(a=>this.isCardType?.(a.type)===ref.card); if(typed.length)list=typed; }
                    if(list.length>1){ const b=list.filter(a=>ofBank(a)||learned(a)); if(b.length)list=b; }
                    // Still tied ("XX861" fits 0861 and 120861): the saved number closest in length to the SMS wins, if only one is
                    if(list.length>1){ const gap=a=>Math.min(...this.accountDigits(a).filter(d=>this.smsDigitsFit(d,ref.digits)).map(d=>Math.abs(d.length-ref.digits.length))); const best=Math.min(...list.map(gap)); const near=list.filter(a=>gap(a)===best); if(near.length===1)list=near; }
                    return list.length===1?list[0]:null; };
                const chosen=item.accountChoice&&accounts.find(a=>a.name===item.accountChoice); if(chosen)return {account:chosen,to:null,how:'Chosen when teaching this SMS'};
                const first=refs.length?pick(refs[0]):null;
                // Settings → SMS rules → senders: the account for this sender when its digits don't settle it
                const ruleAcc=!first&&(this.smsRules().senders[sender]||{}).account; const byRule=ruleAcc&&accounts.find(a=>a.name===ruleAcc);
                if(byRule)return {account:byRule,to:null,how:`Sender setting for ${sender}`};
                if(first){ const second=refs.slice(1).map(pick).find(a=>a&&a!==first); return {account:first,to:second||null,how:`Matched by ${refs[0].card?'card':'A/c'} ••${refs[0].digits}`}; }
                const bySender=accounts.filter(learned); if(bySender.length===1)return {account:bySender[0],to:null,how:`Matched by sender ${sender}`};
                const byBank=accounts.filter(a=>ofBank(a)&&!this.isCardType?.(a.type)); if(!refs.length&&byBank.length===1)return {account:byBank[0],to:null,how:`Only ${byBank[0].bankName||bank} account`};
                return null;
            }
            /** SMS search text, kept on this device (it survives closing the app) until it is changed */
            smsSearch(){ try{ return localStorage.getItem('aifico_sms_search')||''; }catch(e){ return this._smsSearch||''; } }
            setSmsSearch(v){ v=String(v||'').slice(0,80); this._smsSearch=v; try{ v?localStorage.setItem('aifico_sms_search',v):localStorage.removeItem('aifico_sms_search'); }catch(e){}
                clearTimeout(this._smsSearchT); this._smsSearchT=setTimeout(()=>this.renderSmsReconciliation(),150); }
            /** What search looks in: message, payee, amount, date, reference, sender and bank, account digits, the account it
             * belongs to (name, bank, last digits), My fields and status */
            smsSearchText(x){ const own=this.smsResolveAccount(x); const amt=Number(x.amount)||0;
                return [x.description,x.payee,x.notes,x.reference,x.date,x.sender,this.smsBankKey(x.sender),x.status||'pending',x.type,amt,amt.toFixed(2),amt.toLocaleString('en-IN'),
                    ...(x.accountRefs||[]).map(r=>r.digits),own?.account?.name,own?.account?.bankName,own?.account?.lastDigits,own?.to?.name,x.mergedAccount,
                    ...this.myFieldsSummary(x.custom).map(([n,v])=>n+': '+v)].filter(v=>v!=null&&v!=='').join(' ').toLowerCase(); }
            /** My fields on one SMS record (saved straight away; carried into the merge form) */
            setSmsField(inboxId,fieldId,value){ const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId)); if(!item)return; const v=String(value??'').trim();
                if(v)(item.custom||={})[fieldId]=v; else if(item.custom){ delete item.custom[fieldId]; if(!Object.keys(item.custom).length)delete item.custom; } this.saveVault(); }
            /** The bulk bar above the SMS list: one field, one value, every pending SMS currently shown */
            bulkSetSmsField(){ const fieldId=document.getElementById('sms-bulk-field')?.value, v=String(document.getElementById(`sms-bulk-${fieldId}`)?.value??'').trim(); if(!fieldId)return;
                const filter=document.getElementById('sms-reconcile-filter')?.value||'all'; if(filter!=='all'&&filter!=='pending')return;
                const shown=this._smsShown||null; const list=(this.data.smsInbox||[]).filter(x=>(x.status||'pending')==='pending'&&(!shown||shown.has(String(x.id)))); list.forEach(x=>this.setSmsField(x.id,fieldId,v));
                const f=this.myFields().find(x=>x.id===fieldId); this.renderSmsReconciliation(); this.showToast(v?`${f?.name}: ${this.myFieldText(f,v)} set on ${list.length} SMS.`:`${f?.name} cleared on ${list.length} SMS.`); }
            /** After a merge: remember the sender for that account, and its digits when the account has none yet and no other account has them. */
            smsLearnAccount(item,accountName){
                const a=(this.data.accounts||[]).find(x=>x.name===accountName); if(!a)return '';
                const sender=String(item.sender||'').toUpperCase().replace(/^[A-Z]{2}-/,'').replace(/-[A-Z]$/,''); let note='';
                if(sender&&/^[A-Z0-9]{3,9}$/.test(sender)){ a.smsSenders=[...new Set([...(a.smsSenders||[]),sender])].slice(-8); }
                const ref=(item.accountRefs||[])[0]||(item.accountHint?{digits:String(item.accountHint)}:null);
                if(ref&&!String(a.lastDigits||'').trim()&&!(this.data.accounts||[]).some(x=>x!==a&&this.accountDigits(x).some(d=>this.smsDigitsFit(d,ref.digits)))){ a.lastDigits=ref.digits; note=` Saved ••${ref.digits} on ${a.name} for next time.`; }
                return note;
            }
            /**
             * Handles the classify sms transaction workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: line, baseType, payee=''. Side effects, if any, are described by the statements below.
             */
            classifySmsTransaction(line, baseType, payee='') {
                const text=`${line||''} ${payee||''}`.toLowerCase();
                // Explicit money movement takes priority over merchant/category matching.
                // NEFT/IMPS/RTGS are only how the money moved: money credited to you that way is income (e.g. salary), so only
                // debits by those channels (unless they say what they paid for, like rent or an EMI) and anything marked as your own
                // account count as transfers.
                if (/\b(own account|between own accounts|self transfer|sweep to|sweep transfer)\b/i.test(text) || (baseType!=='Income'&&/\b(transfer to|transferred to|imps|neft|rtgs|fund transfer|upi transfer|a\/c transfer|account transfer)\b/i.test(text)&&!/\b(rent|emi|loan|insurance|premium|bill|fees?|maintenance)\b/i.test(text))) {
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
             * Parameters: messages, sourceName, opts.quiet (no pop-ups; used by the automatic phone SMS check). Returns {added, ignored}.
             */
            importSmsMessages(messages, sourceName, opts={}) {
                const inbox=Array.isArray(this.data.smsInbox)?this.data.smsInbox:(this.data.smsInbox=[]);
                const existing=new Set(inbox.map(t=>String(t.messageKey||`${t.date}|${t.amount}|${t.type}|${t.description||''}`)));
                let added=0,ignored=0; const R=this.smsRules();
                for(const msg of messages){
                    const line=String(msg.body||'').trim(); if(!line)continue;
                    // SMS rules (Settings → SMS rules): sender Always / Never read, your own money-in / money-out / ignore words,
                    // and what an SMS taught for its sender. Every skip is kept, with its reason, in the Skipped SMS list.
                    const sender=this.smsSenderKey(msg.address), srule=R.senders[sender]||{};
                    const skip=reason=>{ ignored++; if(!opts.noSkipLog)this.logSkippedSms(msg,line,reason,sourceName); };
                    if(srule.mode==='never'&&!opts.force){ skip(`Sender ${sender} is set to Never read`); continue; }
                    const force=!!opts.force||srule.mode==='always';
                    const ownIgnore=R.ignoreWords.find(w=>this.smsWordAt(line,w)>=0); if(ownIgnore&&!opts.force){ skip(`Has your ignore word "${ownIgnore}"`); continue; }
                    const outWords=[...R.outWords,...(srule.outWords||[])], inWords=[...R.inWords,...(srule.inWords||[])];
                    const ownOut=Math.min(...outWords.map(w=>this.smsWordAt(line,w)).filter(i=>i>=0),Infinity), ownIn=Math.min(...inWords.map(w=>this.smsWordAt(line,w)).filter(i=>i>=0),Infinity);
                    const amountMatch=opts.amount?[String(opts.amount),String(opts.amount)]:line.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i)||line.match(/(?:debited|credited|spent|received|paid|purchase of)\D{0,12}([0-9,]+(?:\.\d{1,2})?)/i);
                    // Promotional SMS mention amounts and words like "cashback" but no money moved: skip them.
                    const movedMoney=ownOut<Infinity||ownIn<Infinity||/\b(a\/c|acct|account|card|reversed|upi|vpa|neft|imps|rtgs|ref(?:erence)?|txn|avl\.?\s*bal|available balance|debited|credited|withdrawn|spent)\b/i.test(line);
                    const promotional=/\b(t\s*&\s*c|offer|hurry|click|download|apply now|recharge now|shop now|use code|coupon|on your next|win)\b/i.test(line)&&!/\b(debited|credited|withdrawn|spent)\b/i.test(line);
                    // OTPs, reminders and scheduled payments mention an amount, but no money has moved yet
                    const notYet=/\b(OTP|one time password|will be executed|is due|due on|due date|ignore if already paid|maintain sufficient balance|scheduled transaction)\b/i.test(line)&&!/\b(debited|credited|withdrawn|spent)\b/i.test(line);
                    // Declined or failed payments, statements, bills, mandate set-ups and EMI conversions: no money moved
                    const noMove=!!amountMatch&&!this.smsIsTransaction(line)&&/\b(declined|failed|unsuccessful|e-?statement|statement (?:is|for)|mandate|converted to EMIs?|credit balance of|reported to|bill (?:of|for|is|dated))\b/i.test(line);
                    if(!force){ if(!movedMoney){ skip('No account, card or transaction words'); continue; } if(promotional){ skip('Looks like an offer or promotion'); continue; }
                        if(notYet){ skip('OTP, reminder or scheduled payment: no money moved yet'); continue; } if(noMove){ skip('Declined, statement, bill or mandate: no money moved'); continue; } }
                    // "Acct XX1234 debited ...; Spotify credited": the first direction word is the account holder's side.
                    // "Credit INR 500 to A/c" counts as money in, "Credit Card" does not; "Thank you for payment of INR … towards
                    // your credit card" is money received on the card.
                    const cardPaid=/thank you for (?:the )?payment of[^.]{0,40}towards your[^.]{0,20}\bcard\b/i.test(line);
                    const creditAt=cardPaid?0:line.search(/\b(credited|credit(?!\s*card)|received|deposited|salary|refund|cashback|reversed|reversal)\b/i), debitAt=line.search(/\b(debited|debit|auto[ -]?debit|autodebit|spent|withdrawn|paid|purchase|sent|payment of|transferred|nach|ecs debit|mandate debit|standing instruction)\b/i);
                    // Your own words count too; the earliest direction word in the message decides
                    const inAt=Math.min(creditAt>=0?creditAt:Infinity,ownIn), outAt=Math.min(debitAt>=0?debitAt:Infinity,ownOut);
                    const baseType=opts.direction||(inAt<Infinity&&inAt<outAt?'Income':(outAt<Infinity?'Expense':null));
                    const typeMatch=baseType||(/\b(transfer|neft|imps|rtgs|sip|investment|premium|insurance|emi|installment|instalment|mandate|subscription renewal)\b/i.test(line)?'Expense':null);
                    if(!amountMatch){ skip('No amount found'); continue; } if(!typeMatch){ skip('Could not tell money in or out'); continue; }
                    const amount=Number(String(amountMatch[1]).replace(/,/g,''));if(!Number.isFinite(amount)||amount<=0){ skip('No amount found'); continue; }
                    let date='';if(msg.date&&/^\d{10,13}$/.test(String(msg.date))){const stamp=Number(msg.date),d=new Date(stamp<1e12?stamp*1000:stamp);if(!Number.isNaN(d.getTime()))date=this.todayISO(d);}
                    if(!date){const d=line.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})\b/),numeric=line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/),
                        // Indian bank SMS write numeric dates day-first: 15-10-26, 15/10/2026, 15.10.26
                        dmy=line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
                        const validDmy=dmy&&+dmy[1]>=1&&+dmy[1]<=31&&+dmy[2]>=1&&+dmy[2]<=12;
                        if(numeric)date=`${numeric[1]}-${numeric[2]}-${numeric[3]}`;else if(d){const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};let y=Number(d[3]);if(y<100)y+=2000;date=`${y}-${String(months[d[2].toLowerCase()]||1).padStart(2,'0')}-${d[1].padStart(2,'0')}`;}else if(validDmy){let y=Number(dmy[3]);if(y<100)y+=2000;date=`${y}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;}else date=this.todayISO();}
                    const payee=opts.payee||this.smsTaughtPayee(line,srule)||this.smsPayee(line,typeMatch)||(typeMatch==='Income'?'Bank Credit':'Bank Payment');
                    const accountRefs=this.smsAccountRefs(line);
                    let mapped=this.classifySmsTransaction(line,typeMatch,payee);
                    // Settings → SMS rules → Payee → category
                    const pc=mapped.type!=='Transfer'&&R.payeeCats.find(r=>r.match&&(payee.toLowerCase().includes(r.match.toLowerCase())||line.toLowerCase().includes(r.match.toLowerCase())));
                    if(pc)mapped={...mapped,category:pc.category,subcategory:pc.subcategory||''};
                    // "a/c XX123 debited … and a/c XX456 credited" between two of your own accounts is a transfer
                    if(mapped.type!=='Transfer'&&typeMatch!=='Income'&&accountRefs.length>1){ const r=this.smsResolveAccount({accountRefs,sender:msg.address}); if(r?.to)mapped={type:'Transfer',category:'Transfer',subcategory:'Own Account Transfer'}; }const reference=(line.match(/\b(?:UTR|RRN|Ref(?:erence)?|Txn(?:\s*ID)?)\s*[:#-]?\s*([A-Z0-9-]{6,})/i)||[])[1]||'';
                    const messageKey=`${date}|${amount.toFixed(2)}|${mapped.type}|${reference||line.replace(/\s+/g,' ').toLowerCase()}`;
                    if(existing.has(messageKey)){ignored++;continue;} existing.add(messageKey);
                    inbox.unshift({id:'sms_inbox_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),messageKey,date,type:mapped.type,amount,accountHint:accountRefs[0]?.digits||'',accountRefs,...(this.payeeFieldsFor(payee)?{custom:this.payeeFieldsFor(payee)}:{}),account:'SMS (Unreconciled)',category:mapped.category,subcategory:mapped.subcategory,payee,notes:`${payee}${mapped.subcategory?' — '+mapped.subcategory:''}`.slice(0,160),description:line,reference,originalSmsDate:msg.date||'',sender:msg.address||'',...(opts.account?{accountChoice:opts.account}:{}),sourceFile:sourceName,status:'pending',importedAt:new Date().toISOString()});added++;
                }
                if(!added){ if(!opts.quiet)alert(`No new SMS records were staged. ${ignored} message(s) were unsupported or already present in the SMS Ledger.`); return {added,ignored}; }
                this.saveVault();this.renderAll();this.renderSmsReconciliation();
                const status=document.getElementById('sms-import-status');if(status){status.textContent=`Staged ${added} SMS record(s) in Core SMS Ledger. ${ignored} unsupported or repeated message(s) skipped. No account balances or Core Ledger records were changed.`;status.classList.remove('hidden','text-rose-600');status.classList.add('text-emerald-600');}
                if(!opts.quiet)alert(`Added ${added} record(s) to Core SMS Ledger. They have not been added to Core Ledger and have not changed account balances. Review suggested matches before merging unmatched records.${ignored?`\n${ignored} unsupported/repeated message(s) skipped.`:''}`);
                return {added,ignored};
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
            /** Core Ledger transactions already standing for an SMS: matched to one, or added from one (Merge). One SMS each. */
            smsClaimedTx(exceptId){
                const used=new Set(); const except=exceptId==null?null:String(exceptId);
                (this.data.smsInbox||[]).forEach(x=>{ if(String(x.id)===except)return; if(x.status==='matched'&&x.matchedTransactionId)used.add(String(x.matchedTransactionId)); if(x.status==='merged'&&x.mergedTransactionId)used.add(String(x.mergedTransactionId)); });
                (this.data.tx||[]).forEach(t=>{ if(t&&t.smsInboxId!=null&&String(t.smsInboxId)!==except)used.add(String(t.id)); });
                return used;
            }
            /**
             * Matched SMS that share one transaction (an earlier Confirm match could reuse it), or whose transaction is gone or
             * excluded, go back to Pending review: each SMS needs its own Core Ledger entry. The best fit keeps the match.
             */
            repairSmsMatches(){
                const inbox=this.data.smsInbox||[]; const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,''); let reset=0;
                const byTx=new Map();
                inbox.filter(x=>x.status==='matched').forEach(x=>{ const t=(this.data.tx||[]).find(t=>String(t.id)===String(x.matchedTransactionId));
                    if(!t||t.excludedFromLedger){ x.status='pending'; x.matchReason='Returned to pending: its matched transaction is no longer in Core Ledger'; delete x.matchedTransactionId; reset++; return; }
                    const k=String(t.id); if(!byTx.has(k))byTx.set(k,[]); byTx.get(k).push({x,t}); });
                byTx.forEach(list=>{ if(list.length<2)return;
                    const fit=({x,t})=>{ const r=norm(x.reference); const exact=r.length>=6&&norm(t.reference||t.transactionId||t.utr)===r; const a=this.smsDateDay(x.date), b=this.smsDateDay(t.date); return (exact?0:1000)+(a!=null&&b!=null?Math.abs(a-b):99); };
                    list.sort((p,q)=>fit(p)-fit(q)).slice(1).forEach(({x})=>{ x.status='pending'; x.matchReason='Returned to pending: another SMS is matched to the same Core Ledger transaction'; delete x.matchedTransactionId; reset++; }); });
                return reset;
            }
            findSmsMatches(item){
                const claimed=this.smsClaimedTx(item.id);
                const txs=(this.data.tx||[]).filter(t=>t&&!this.isSmsTx(t)&&!t.excludedFromLedger&&!claimed.has(String(t.id)));
                const norm=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
                const ref=this.extractReconciliationReference(item),day=this.smsDateDay(item.date),want=Math.round((Number(item.amount)||0)*100);
                const own=this.smsResolveAccount(item);
                return txs.map(t=>{
                    if(Math.round((Number(t.amount)||0)*100)!==want)return null;
                    const sameType=(item.type==='Income')===(t.type==='Income');if(!sameType)return null;
                    const txRef=norm(t.reference||t.transactionId||t.utr),td=this.smsDateDay(t.date),dateDiff=day!==null&&td!==null?Math.abs(day-td):99;
                    // The SMS account (from its digits or sender) ranks entries in that account first; another account counts against
                    const sameAccount=own?(t.account===own.account.name||t.destinationAccount===own.account.name):null;
                    const exactRef=ref.length>=6&&txRef===ref;
                    if(ref.length>=6&&txRef.length>=6&&!exactRef)return null;   // both have a reference and they differ
                    if(exactRef)return {t,score:1000,reason:'Exact UTR/IMPS/reference + amount + direction',exactRef:true,dateDiff};
                    if(dateDiff<=7)return {t,score:100-dateDiff+(sameAccount===true?20:sameAccount===false?-30:0),reason:`Same amount and direction; date difference ${dateDiff} day(s)${sameAccount===true?` + same account (${own.how})`:sameAccount===false?` · different account from the SMS (${own.account.name})`:''}`,exactRef:false,dateDiff,sameAccount};
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
                const usedTx=this.smsClaimedTx();
                let matched=0,ambiguous=0,unmatched=0,refMatches=0,detailMatches=0;
                const decisions=[];
                const owns=new Map(), ownOf=item=>{ if(!owns.has(item.id))owns.set(item.id,this.smsResolveAccount(item)); return owns.get(item.id); };
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
                        // Automatic matching stays strict: the entry must be in the account the SMS names (digits or sender)
                        const own=ownOf(item);
                        if(own){ if(t.account!==own.account.name&&t.destinationAccount!==own.account.name)return false; }
                        else { const hint=norm(item.accountHint); if(hint&&!norm(t.account).includes(hint))return false; }
                        const txRef=norm(t.reference||t.transactionId||t.utr);
                        const exactRef=ref.length>=6 && txRef===ref;
                        if(ref.length>=6 && txRef.length>=6 && !exactRef)return false;
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
                { const reset=this.repairSmsMatches(); if(reset){ this.saveVault(); this.showToast(`${reset} SMS ${reset===1?'was':'were'} matched to a Core Ledger entry that another SMS already stands for, or that is gone. ${reset===1?'It is':'They are'} back in Pending review: merge ${reset===1?'it':'them'} to add ${reset===1?'it':'them'}.`,{ms:9000}); } }
                const inbox=this.data.smsInbox||(this.data.smsInbox=[]);
                const counts={pending:0,matched:0,merged:0,ignored:0,duplicate:0,error:0};
                inbox.forEach(x=>{const st=x.status||'pending';counts[st]=(counts[st]||0)+1;});
                const summary=document.getElementById('sms-reconcile-summary');
                if(summary) summary.innerHTML=[['Pending review',counts.pending||0],['Matched to bank',counts.matched||0],['Merged to ledger',counts.merged||0],['Ignored',counts.ignored||0],['Duplicates',counts.duplicate||0],['Errors',counts.error||0]].map(([label,n])=>`<div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700"><div class="text-xs text-slate-500">${label}</div><div class="text-xl font-bold">${n}</div></div>`).join('');
                const filter=document.getElementById('sms-reconcile-filter')?.value||'all';
                // My fields: set one field on every pending SMS shown, in one go
                const bulk=document.getElementById('sms-myfields-bulk'); const fields=this.myFields();
                if(bulk){ const shownPending=inbox.filter(x=>(x.status||'pending')==='pending'&&(filter==='all'||filter==='pending')).length; bulk.hidden=!fields.length||!shownPending;
                    if(!bulk.hidden){ const keep=document.getElementById('sms-bulk-field')?.value; bulk.innerHTML=`<label class="flex flex-col gap-1">Set field<select id="sms-bulk-field" class="px-2 py-1 rounded border dark:bg-slate-900">${fields.map(f=>`<option value="${this.escapeHtml(f.id)}" ${f.id===keep?'selected':''}>${this.escapeHtml(f.name)}</option>`).join('')}</select></label><span id="sms-bulk-value-wrap"></span><button type="button" class="px-3 py-1.5 rounded border" onclick="app.bulkSetSmsField()" id="sms-bulk-apply">Apply to ${shownPending} pending SMS</button>`;
                        const paint=()=>{ const f=fields.find(x=>x.id===document.getElementById('sms-bulk-field').value)||fields[0]; document.getElementById('sms-bulk-value-wrap').innerHTML=this.myFieldsInputs({},'sms-bulk','',true).split('</label>').find(s=>s.includes(`id="sms-bulk-${f.id}"`))+'</label>'; };
                        document.getElementById('sms-bulk-field').onchange=paint; paint(); } }
                // Search (kept on this device until changed): every word must appear in the record or its account
                const q=this.smsSearch(); const sb=document.getElementById('sms-reconcile-search'); if(sb&&sb.value!==q&&document.activeElement!==sb)sb.value=q;
                const words=q.toLowerCase().split(/\s+/).filter(Boolean);
                // Newest SMS first (by when the SMS arrived), grouped by year; the year filter narrows to one year
                const smsTime=x=>{ const o=String(x.originalSmsDate||''); if(/^\d{10,13}$/.test(o))return Number(o)<1e12?Number(o)*1000:Number(o); const t=Date.parse(String(x.date||'').slice(0,10)+'T12:00:00'); return Number.isNaN(t)?0:t; };
                const yearOf=x=>{ const t=smsTime(x); return t?String(new Date(t).getFullYear()):'Undated'; };
                const ysel=document.getElementById('sms-reconcile-year'); const years=[...new Set(inbox.map(yearOf))].sort((a,b)=>b.localeCompare(a));
                if(ysel){ const keep=ysel.value||(()=>{ try{ return localStorage.getItem('aifico_sms_year')||''; }catch(e){ return ''; } })(); ysel.innerHTML=`<option value="">All years</option>${years.map(y=>`<option ${y===keep?'selected':''}>${this.escapeHtml(y)}</option>`).join('')}`; if(keep&&!years.includes(keep))ysel.value=''; }
                const year=ysel?.value||'';
                const byStatus=inbox.filter(x=>(filter==='all'||(x.status||'pending')===filter)&&(!year||yearOf(x)===year));
                const visible=(words.length?byStatus.filter(x=>{ const hay=this.smsSearchText(x); return words.every(w=>hay.includes(w)); }):byStatus).slice().sort((a,b)=>smsTime(b)-smsTime(a));
                this._smsShown=new Set(visible.map(x=>String(x.id))); const nPend=visible.filter(x=>(x.status||'pending')==='pending').length; const ap=document.getElementById('sms-bulk-apply'); if(ap){ ap.textContent=`Apply to ${nPend} pending SMS${words.length?' shown':''}`; ap.disabled=!nPend; }
                const cnt=document.getElementById('sms-search-count'); if(cnt)cnt.textContent=words.length?`${visible.length} of ${byStatus.length}`:'';
                if(!visible.length){body.innerHTML=`<tr><td colspan="7" class="p-6 text-center text-slate-500">${words.length?`No SMS records match "${this.escapeHtml(q)}".`:inbox.length?'No SMS records for this status filter.':'No SMS records staged yet. Paste SMS text or upload an SMS backup above.'}</td></tr>`;return;}
                let lastYear=null; const perYear=visible.reduce((m,x)=>(m[yearOf(x)]=(m[yearOf(x)]||0)+1,m),{});
                body.innerHTML=visible.map(item=>{
                    const y=yearOf(item); const yearRow=y!==lastYear?`<tr class="sms-year-row"><td colspan="7">${this.escapeHtml(y)} · ${perYear[y]} SMS</td></tr>`:''; lastYear=y;
                    const status=item.status||'pending';
                    const matches=status==='pending'?this.findSmsMatches(item):[];
                    const matchHtml=matches.length?`<div class="space-y-2"><div class="text-xs font-semibold text-slate-600">${matches.length} candidate(s) — compare before confirming</div>${matches.map((candidate,i)=>`<div class="rounded-lg border ${candidate.exactRef?'border-emerald-300 bg-emerald-50/50':'border-slate-200 dark:border-slate-700'} p-2 space-y-1"><div class="font-medium">${this.escapeHtml(candidate.t.date||'')} · ${this.escapeHtml(candidate.t.account||'')} · ${CUR()}${(Number(candidate.t.amount)||0).toLocaleString('en-IN')}</div><div class="text-slate-500">${this.escapeHtml(candidate.reason)}</div><div class="text-slate-500">Type: ${this.escapeHtml(candidate.t.type||'Unknown')} · Reference: ${this.escapeHtml(candidate.t.reference||candidate.t.transactionId||candidate.t.utr||'—')}</div><button class="px-2 py-1 rounded ${candidate.exactRef?'bg-emerald-600':'bg-slate-700'} text-white" onclick="app.confirmSmsMatch('${String(item.id).replace(/'/g,"\\'")}','${String(candidate.t.id).replace(/'/g,"\\'")}')">${candidate.exactRef?'Confirm reference match':'Confirm candidate '+(i+1)}</button></div>`).join('')}${matches.length>1?'<div class="text-amber-700">Multiple candidates found. Confirm only after comparing the reference and transaction details.</div>':''}</div>`:'<span class="text-slate-500">No likely match found</span>';
                    let actions='';
                    if(status==='pending') actions=`<button class="px-2 py-1 rounded border" onclick="app.mergeSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Merge to Core Ledger</button> <button class="px-2 py-1 rounded border" onclick="app.ignoreSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Ignore</button> <button class="px-2 py-1 rounded border" title="Correct how this SMS was read and remember it for the sender" onclick="app.openSmsTeach({inboxId:'${String(item.id).replace(/'/g,"\\'")}'})">Teach</button>`;
                    else if(status==='ignored'||status==='duplicate'||status==='error') actions=`<button class="px-2 py-1 rounded border" onclick="app.reopenSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Return to pending</button>`;
                    else if(status==='matched'){ const mt=(this.data.tx||[]).find(t=>String(t.id)===String(item.matchedTransactionId)); actions=`<div class="text-slate-600 dark:text-slate-300">Matched to Core Ledger: ${mt?`${this.escapeHtml(mt.date||'')} · ${this.escapeHtml(mt.payee||mt.description||'')} · ${CUR()}${(Number(mt.amount)||0).toLocaleString('en-IN')}`:'(not found)'}</div><button class="px-2 py-1 rounded border mt-1" onclick="app.reopenSmsInbox('${String(item.id).replace(/'/g,"\\'")}')">Undo match</button>`; }
                    else actions=`<span class="text-slate-500">${this.escapeHtml(status)}</span>`;
                    return yearRow+`<tr class="border-b border-slate-100 dark:border-slate-800 align-top"><td class="p-2 whitespace-nowrap">${this.escapeHtml(item.date||'')}</td><td class="p-2 min-w-56"><div class="font-medium">${this.escapeHtml(item.payee||item.description||'SMS')}</div><div class="text-slate-500 whitespace-normal">${this.escapeHtml(item.description||'')}</div>${(()=>{ const o=status==='pending'?this.smsResolveAccount(item):null; const r=(item.accountRefs||[])[0]; return o?`<div class="text-xs text-emerald-700 dark:text-emerald-300">${this.escapeHtml(o.account.name)}${o.to?' → '+this.escapeHtml(o.to.name):''} · ${this.escapeHtml(o.how)}</div>`:(status==='pending'&&r?`<div class="text-xs text-amber-700 dark:text-amber-300">${r.card?'Card':'A/c'} ••${this.escapeHtml(r.digits)} isn't on any account yet: add it in Accounts → Edit → Last digits</div>`:''); })()}${status==='pending'&&this.myFields().length?`<div class="sms-myfields">${this.myFieldsInputs(item.custom,'sms-mf-'+this.escapeHtml(String(item.id).replace(/[^\w-]/g,'')),`app.setSmsField('${this.escapeHtml(String(item.id).replace(/'/g,"\\'"))}','%ID%',this.value)`,true)}</div>`:(item.custom?`<div class="text-xs text-slate-500">${this.myFieldsSummary(item.custom).map(([n,v])=>this.escapeHtml(n+': '+v)).join(' · ')}</div>`:'')}<div class="text-slate-400">${this.escapeHtml(item.sourceFile||'')}</div></td><td class="p-2 whitespace-nowrap">${item.type==='Income'?'+':'−'}${CUR()}${(Number(item.amount)||0).toLocaleString('en-IN')}</td><td class="p-2">${this.escapeHtml(item.reference||'—')}</td><td class="p-2 min-w-64">${status==='pending'?matchHtml:this.escapeHtml(item.matchedTransactionId||item.matchReason||'—')}</td><td class="p-2">${this.escapeHtml(status)}</td><td class="p-2 min-w-40">${actions}</td></tr>`;
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
                if(!item||!['ignored','duplicate','error','matched'].includes(item.status))return;
                delete item.matchedTransactionId;
                item.status='pending'; item.reviewedAt=null; item.matchReason='Returned to pending by user';
                this.saveVault(); this.renderSmsReconciliation();
            }
            /**
             * Handles the confirm sms match workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId,txId. Side effects, if any, are described by the statements below.
             */
            async confirmSmsMatch(inboxId,txId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));const tx=(this.data.tx||[]).find(x=>String(x.id)===String(txId)&&!this.isSmsTx(x));if(!item||!tx)return alert('The SMS or bank transaction could not be found. Refresh and review again.');if(this.smsClaimedTx(item.id).has(String(tx.id)))return alert('That Core Ledger transaction already stands for another SMS. Use Merge to Core Ledger to add this SMS as its own entry.');if(!await this.uiConfirm(`Mark this SMS as already present in Core Ledger?\n\nSMS: ${item.date} ${CUR()}${item.amount} ${item.payee}\nBank transaction: ${tx.date} ${CUR()}${tx.amount} ${tx.payee||tx.description||''}\n\nNo new transaction will be created.`))return;item.status='matched';item.matchedTransactionId=String(tx.id);item.matchReason='Human confirmed';item.reviewedAt=new Date().toISOString();this.saveVault();this.renderSmsReconciliation();}
            /**
             * Handles the merge sms inbox workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId. Side effects, if any, are described by the statements below.
             */
            /** Merge: open the SMS as a transaction to review and edit. Saving parks it in Core Ledger as Excluded (see saveSmsReview). */
            async mergeSmsInbox(inboxId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));if(!item||item.status!=='pending')return;if(this.findSmsMatches(item).length&&!await this.uiConfirm('A possible bank match exists for this SMS. Review it as a new Core Ledger entry anyway?'))return;const accounts=this.data.accounts||[];if(!accounts.length)return alert('Create an account in Accounts & Wallets first.');const own=this.smsResolveAccount(item);const account=own?.account||this.getGlobalDefaultAccount()||accounts[0];this.openTransactionModal({smsInboxId:item.id,type:item.type,date:item.date,amount:item.amount,payee:item.payee||'',category:item.category,subcategory:item.subcategory,account:account.name,...(item.type==='Transfer'&&own?.to?{destinationAccount:own.to.name}:{}),note:item.notes||'',description:item.description||'',smsDate:item.originalSmsDate||item.date||''});}
            /**
             * Handles the ignore sms inbox workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: inboxId. Side effects, if any, are described by the statements below.
             */
            async ignoreSmsInbox(inboxId){const item=(this.data.smsInbox||[]).find(x=>String(x.id)===String(inboxId));if(!item||item.status!=='pending')return;if(!await this.uiConfirm('Mark this SMS as ignored? The original message will remain in the SMS Ledger and no financial records will change.'))return;item.status='ignored';item.reviewedAt=new Date().toISOString();this.saveVault();this.renderSmsReconciliation();}

        }
