// AificoApp methods: dashboard (6 methods). Part of the AificoApp prototype chain.
        class AificoAppDashboard extends AificoAppLedger {
            /**
             * Renders the  dashboard UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderDashboard() {
                const num = v => { if (typeof v === 'string') v=v.replace(/[₹,\s]/g,''); const n=Number(v); return Number.isFinite(n) ? n : 0; };
                const assetTypes = ['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const liabilityTypes = ['Loan Account','Loan']; // credit card dues are excluded: card spends hit net worth only when the bill is paid
                const assets = this.data.accounts.filter(a => assetTypes.includes(a.type)).reduce((sum,a)=>sum+num(a.balance),0);
                const liabilities = this.data.accounts.filter(a => liabilityTypes.includes(a.type)).reduce((sum,a)=>sum+Math.abs(num(a.balance)),0);
                const netWorth = assets - liabilities;
                const liquid = this.data.accounts.filter(a => ['Checking','Cash','Savings','Savings Account'].includes(a.type)).reduce((sum,a)=>sum+num(a.balance),0);
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const inMonth = t => (this.parseLedgerDate(t.date)||'').slice(0,7) === monthKey;
                const income = this.countedTx().filter(t => t.type === 'Income' && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const expense = this.countedTx().filter(t => (this.isSpending(t)) && inMonth(t)).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const suspiciousAccounts = this.data.accounts.filter(a => !Number.isFinite(Number(a.balance)) || Math.abs(num(a.balance)) >= 1000000000);
                const suspiciousTx = this.data.tx.filter(t => !Number.isFinite(Number(t.amount)) || Math.abs(num(t.amount)) >= 1000000000);
                let warning = document.getElementById('dashboard-calculation-warning');
                if (!warning) { warning=document.createElement('div'); warning.id='dashboard-calculation-warning'; warning.className='mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900'; document.querySelector('#panel-dashboard')?.prepend(warning); }
                const moneyDashboard = v => `${num(v)<0?'−':''}${CUR()}${Math.abs(num(v)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                warning.classList.toggle('hidden', !(suspiciousAccounts.length || suspiciousTx.length));
                if (suspiciousAccounts.length || suspiciousTx.length) {
                    const accountDetails = suspiciousAccounts.map(a => `<li><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)}</li>`).join('');
                    const txDetails = suspiciousTx.slice(0,8).map(t => `<li>${this.escapeHtml(t.date||'No date')} · ${this.escapeHtml(t.payee||t.description||t.notes||'Transaction')} · ${moneyDashboard(t.amount)}</li>`).join('');
                    const accountActions = suspiciousAccounts.map((a, accountIndex) => `<li class="mb-2"><strong>${this.escapeHtml(a.name||'Unnamed account')}</strong> (${this.escapeHtml(a.type||'Unknown type')}): ${moneyDashboard(a.balance)} <button type="button" class="ml-2 underline font-semibold" onclick="app.rebuildAccountBalanceFromLedgerByIndex(${this.data.accounts.indexOf(a)})">Rebuild from ledger</button> <button type="button" class="ml-2 underline" onclick="app.reconcileAccountBalanceByIndex(${this.data.accounts.indexOf(a)})">Set verified balance</button> <button type="button" class="ml-2 underline" onclick="app.openAccountLedgerEntriesByIndex(${this.data.accounts.indexOf(a)})">Inspect ledger entries</button></li>`).join('');
                    warning.innerHTML = `<div class="font-semibold mb-1">Dashboard totals need review</div><p class="mb-2">Found ${suspiciousAccounts.length} account balance(s) and ${suspiciousTx.length} transaction amount(s) that are invalid or unusually large (${CUR()}1 billion or more). No data has been changed automatically.</p>${accountActions?`<div class="font-semibold">Accounts to check</div><ul class="list-disc pl-5 mb-2">${accountActions}</ul>`:''}${txDetails?`<div class="font-semibold">Example transactions to check</div><ul class="list-disc pl-5 mb-2">${txDetails}</ul>`:''}<p class="text-xs mb-2">Use “Set verified balance” only after checking your actual bank statement. This changes the account's stored balance; it does not delete or rewrite ledger history.</p><button type="button" class="underline font-semibold" onclick="app.openDashboardDrilldown('Account balances to review','accounts-networth')">Open account breakdown</button>`;
                }
                const netEl=document.getElementById('kpi-net-worth'), liquidEl=document.getElementById('kpi-liquid');
                netEl.innerText = suspiciousAccounts.length ? 'Review data' : moneyDashboard(netWorth);
                liquidEl.innerText = suspiciousAccounts.some(a=>['Checking','Cash','Savings','Savings Account'].includes(a.type)) ? 'Review data' : moneyDashboard(liquid);
                document.getElementById('kpi-income').innerText = `${CUR()}${income.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                document.getElementById('kpi-expense').innerText = `${CUR()}${expense.toLocaleString('en-IN', {minimumFractionDigits: 2,maximumFractionDigits:2})}`;
                // Net worth, in parts: bank and cash, investments (FD/RD, funds…), minus loans
                const investAcc = a => this.isInvestmentAccount(a);
                const invested = this.data.accounts.filter(a => assetTypes.includes(a.type) && investAcc(a)).reduce((sum,a)=>sum+num(a.balance),0);
                const nwParts = [`Bank & cash ${this.fmtMoney0(assets-invested)}`, invested?`Investments ${this.fmtMoney0(invested)}`:'', liabilities?`Loans −${this.fmtMoney0(liabilities)}`:''].filter(Boolean);
                const nwS = document.getElementById('kpi-net-worth-s'); if (nwS && !suspiciousAccounts.length) { if (!nwS.dataset.plain) nwS.dataset.plain = nwS.textContent; nwS.textContent = nwParts.length>1 ? nwParts.map(s=>s.replace(/ /g,' ')).join(' · ') : nwS.dataset.plain; }
                netEl.classList.toggle('dk-out', !suspiciousAccounts.length && netWorth<0);
                // Money put into investments this month (not spending, unless the account counts it as spending)
                const putIn = this.investedTx(inMonth).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                const invEl = document.getElementById('dash-invested');
                if (invEl) { invEl.hidden = !putIn; invEl.innerHTML = putIn ? `<i data-lucide="trending-up"></i><span>Invested this month <b>${this.fmtMoney(putIn)}</b></span><small>Kept in your investment accounts, so it isn't spending</small>` : ''; }
                this.renderDashboardAttention();
                this.renderMonthlyComparison();
                const tbody = document.getElementById('dashboard-tx-tbody');
                // Latest five by date (not by when they were typed in). Money in shows +, money out −, a move between your own accounts no sign.
                const recent=[...this.countedTx()].sort((a,b)=>(this.normalizeLedgerDate(b.date)||'').localeCompare(this.normalizeLedgerDate(a.date)||'')).slice(0,5);
                const sign=t=>t.type==='Income'||(t.type==='Transfer'&&t.transferDirection==='in')?'+':t.type==='Transfer'&&t.transferDirection!=='out'?'':'−';
                tbody.innerHTML = recent.map(t => `<tr title="Open transaction details" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onclick="app.editTransaction('${String(t.id).replace(/'/g, '\\\'')}')"><td class="py-3 text-slate-500">${this.escapeHtml(t.date||'')}</td><td class="py-3 font-medium">${this.escapeHtml(t.payee||t.description||'')}</td><td class="py-3"><span class="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800">${this.escapeHtml(t.category||'Uncategorized')}</span></td><td class="py-3 text-slate-500">${this.escapeHtml(t.account||'')}</td><td class="py-3 text-right font-semibold whitespace-nowrap ${sign(t)==='+'?'text-emerald-600':'text-slate-800 dark:text-slate-200'}">${sign(t)}${CUR()}${num(t.amount).toLocaleString('en-IN')}</td></tr>`).join('');
                const remList = document.getElementById('reminders-list');
                // Upcoming = enabled schedules that still have a next date, soonest first; Due shows that next date.
                const nextOf=y=>{ try{ return y.startDate&&this.scheduleProgress?this.scheduleProgress(y,0).next:''; }catch(e){ return ''; } };
                const scheduledItems = (Array.isArray(this.data.yearly)?this.data.yearly:[]).filter(y=>y.enabled!==false).map(y=>({y,next:nextOf(y)})).filter(x=>x.next||!x.y.startDate).sort((a,b)=>(a.next||'9999').localeCompare(b.next||'9999')).map(x=>({...x.y,__next:x.next}));
                remList.innerHTML = scheduledItems.map(y => {
                    const due = y.__next ? new Date(y.__next+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : (y.startDate || y.dueDate || 'Not set');
                    const mode = y.destinationType || (y.sourceAccount && y.destinationAccount ? 'account' : 'legacy');
                    let destination = '';
                    if (mode === 'account') destination = `To account: ${this.escapeHtml(y.destinationAccountName || y.destinationAccount || 'Destination account')}`;
                    else if (mode === 'category') destination = `Category: ${this.escapeHtml(y.category || 'Uncategorized')}${y.subcategory ? ' / '+this.escapeHtml(y.subcategory) : ''} · ${this.escapeHtml(y.transactionType || 'Expense')}`;
                    else destination = 'Legacy schedule · Edit in Yearly / Scheduled to configure destination';
                    const source = y.sourceAccountName ? `From: ${this.escapeHtml(y.sourceAccountName)} · ` : '';
                    const frequency = y.frequency ? `${this.escapeHtml(y.frequency.charAt(0).toUpperCase()+y.frequency.slice(1))} · ` : '';
                    const status = mode === 'legacy' ? 'Needs setup' : 'Scheduled';
                    return `<div class="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"><div class="min-w-0"><h4 class="font-medium text-sm">${this.escapeHtml(y.title||'')}</h4><p class="text-xs text-slate-500">Due: ${this.escapeHtml(due)} · ${frequency}${source}${destination}</p><p class="text-xs ${mode==='legacy'?'text-amber-600':'text-emerald-600'} mt-1">${status}</p></div><span class="font-bold text-sm shrink-0">${CUR()}${num(y.amount).toLocaleString('en-IN')}</span></div>`;
                }).join('') || '<p class="text-sm text-slate-500">No upcoming reminders.</p>';
                this.renderCharts(income, expense);
            }

            /** An account that holds investments: funds, shares, NPS/PPF, insurance, fixed or recurring deposits. */
            isInvestmentAccount(a){ return !!a&&/invest|mutual|demat|stock|nps|ppf|pension|insurance|fixed deposit|recurring deposit|^rd\b/i.test(String(a.type||'')); }
            /** Counted entries that put money into investments (an Investment, or a transfer into an investment account) and aren't spending. */
            investedTx(keep=()=>true){ const inv=new Set((this.data.accounts||[]).filter(a=>this.isInvestmentAccount(a)).map(a=>String(a.name)));
                return this.countedTx().filter(t=>keep(t)&&!this.isSpending(t)&&(t.type==='Investment'||(t.type==='Transfer'&&t.transferDirection!=='in'&&inv.has(String(t.destinationAccount||t.toAccount||''))))); }
            /** "Needs attention": SMS to review, SMS entries parked as Excluded, payments due within a week, bank or cash below zero. */
            renderDashboardAttention(){ const box=document.getElementById('dash-attention'); if(!box)return; const items=[]; const n=(c,one,many)=>`${c} ${c===1?one:many}`;
                const pending=(this.data.smsInbox||[]).filter(x=>(x.status||'pending')==='pending').length;
                if(pending)items.push({text:n(pending,'SMS to review','SMS to review'),detail:'Merge, match or ignore them on the SMS page',go:"app.switchTab('sms')"});
                const parked=(this.data.tx||[]).filter(t=>t&&t.smsInboxId!=null&&t.excludedFromLedger).length;
                if(parked&&typeof this.openExcludedInLedger==='function')items.push({text:n(parked,'SMS entry not yet included','SMS entries not yet included'),detail:"Saved as Excluded: they don't count until you include them",go:'app.openExcludedInLedger()'});
                const today=this.todayISO(), week=this.todayISO(new Date(Date.now()+7*864e5)); const due=[];
                (Array.isArray(this.data.yearly)?this.data.yearly:[]).filter(y=>y.enabled!==false&&y.startDate).forEach(y=>{ try{ const nx=this.scheduleProgress?this.scheduleProgress(y,0).next:''; if(nx&&nx>=today&&nx<=week)due.push({y,nx}); }catch(e){} });
                due.sort((a,b)=>a.nx.localeCompare(b.nx));
                if(due.length)items.push({text:n(due.length,'payment due this week','payments due this week'),detail:due.slice(0,3).map(d=>`${d.y.title||'Payment'} on ${new Date(d.nx+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`).join(' · ')+(due.length>3?' …':''),go:"app.switchTab('yearly')"});
                (this.data.accounts||[]).filter(a=>['Checking','Cash','Savings','Savings Account'].includes(a.type)&&Number(a.balance)<0).slice(0,2).forEach(a=>items.push({text:`${a.name} is below zero`,detail:`Balance ${this.fmtMoney(Number(a.balance))}: check its entries or set the balance`,go:"app.switchTab('accounts')",bad:true}));
                // Shown like notifications: a dot, a title, one line of detail; tap to go there
                box.hidden=!items.length; box.innerHTML=items.length?`<div class="da-h">Needs attention <span class="da-n">${items.length}</span></div>${items.map(i=>`<button type="button" class="da-i${i.bad?' da-bad':''}" onclick="${i.go}"><span class="da-dot" aria-hidden="true"></span><span class="da-t"><b>${this.escapeHtml(i.text)}</b><small>${this.escapeHtml(i.detail)}</small></span><i data-lucide="chevron-right"></i></button>`).join('')}`:''; window.lucide?.createIcons?.(); }
            /**
             * Renders the  monthly comparison UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderMonthlyComparison() {
                const num = v => { if (typeof v === 'string') v=v.replace(/[₹,\s]/g,''); const n=Number(v); return Number.isFinite(n) ? n : 0; };
                const now = new Date();
                const current = new Date(now.getFullYear(), now.getMonth(), 1);
                const previous = new Date(now.getFullYear(), now.getMonth()-1, 1);
                const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                const flowExpense = t => this.isSpending(t);
                const totals = monthKey => {
                    const rows=this.countedTx().filter(t=>(this.parseLedgerDate(t.date)||'').slice(0,7)===monthKey);
                    const income=rows.filter(t=>t.type==='Income').reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    const expense=rows.filter(flowExpense).reduce((sum,t)=>sum+Math.max(0,num(t.amount)),0);
                    return {income,expense,net:income-expense};
                };
                const cur=totals(key(current)), prev=totals(key(previous));
                const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
                const short=now.toLocaleDateString('en-IN',{month:'short'}), prevShort=previous.toLocaleDateString('en-IN',{month:'short'});
                document.querySelectorAll('#dash-kpis .dk-month').forEach(el=>{ el.textContent=short; });
                set('kpi-net',this.fmtMoney(cur.net));
                const netEl=document.getElementById('kpi-net'); if(netEl)netEl.classList.toggle('dk-out',cur.net<0);
                // "▲ ₹2,499 · 1.7% vs Sep": green when it helps you (more income, less spending, higher net), red when it doesn't.
                const change=(id,a,b,higherIsGood)=>{ const el=document.getElementById(id); if(!el)return; const diff=a-b;
                    if(!a&&!b){ el.textContent=`Nothing yet in ${prevShort} or ${short}`; el.className='dk-s'; return; }
                    const pct=b?` · ${Math.abs(diff/Math.abs(b)*100).toFixed(Math.abs(diff/b)<0.1?1:0)}%`:'';
                    el.textContent=diff===0?`Same as ${prevShort}`:`${diff>0?'▲':'▼'} ${this.fmtMoney0(Math.abs(diff))}${pct} vs ${prevShort}`;
                    el.className='dk-s '+(diff===0?'':((diff>0)===higherIsGood?'dk-good':'dk-bad')); };
                change('kpi-income-change',cur.income,prev.income,true);
                change('kpi-expense-change',cur.expense,prev.expense,false);
                change('kpi-net-change',cur.net,prev.net,true);
            }

            /**
             * Opens the  dashboard drilldown screen, dialog, or workflow.
             * Parameters: title, mode, extra={}. Side effects, if any, are described by the statements below.
             */
            openDashboardDrilldown(title, mode, extra={}) {
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const money=v=>`${CUR()}${Math.abs(num(v)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
                const assetTypes=['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const liabilityTypes=['Loan Account','Loan'];
                const now=new Date(), monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const inMonth=t=>(this.parseLedgerDate(t.date)||'').slice(0,7)===monthKey;
                let rows=[], kind='transactions';
                if(mode==='accounts-networth'||mode==='accounts-liquid'){
                    kind='accounts';
                    rows=this.data.accounts.filter(a=>mode==='accounts-networth'||['Checking','Cash','Savings','Savings Account'].includes(a.type));
                } else {
                    rows=this.countedTx().filter(t=>{
                        if(mode==='income-current')return t.type==='Income'&&inMonth(t);
                        if(mode==='expense-current')return inMonth(t)&&(this.isSpending(t));
                        if(mode==='invested-current')return inMonth(t)&&this.investedTx(x=>x===t).length>0;
                        if(mode==='month-type')return (this.parseLedgerDate(t.date)||'').slice(0,7)===extra.monthKey && (extra.type==='Income'?t.type==='Income':(this.isSpending(t)));
                        if(mode==='category')return inMonth(t)&&this.isSpending(t)&&(t.category||'Uncategorized')===extra.category;
                        if(mode==='category-period'){const d=this.parseLedgerDate(t.date)||'';return this.isSpending(t)&&(t.category||'Uncategorized')===extra.category&&d.slice(0,4)===extra.year&&(extra.month==='all'||d.slice(5,7)===extra.month);}
                        return false;
                    }).sort((a,b)=>(this.parseLedgerDate(b.date)||'').localeCompare(this.parseLedgerDate(a.date)||''));
                }
                const box=document.getElementById('modal-box');
                const esc=v=>this.escapeHtml(String(v??''));
                const table=kind==='accounts' ? `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-slate-500 border-b"><th class="p-2">Account</th><th class="p-2">Type</th><th class="p-2 text-right">Balance</th></tr></thead><tbody>${rows.map(a=>`<tr class="border-b border-slate-100 dark:border-slate-800"><td class="p-2 font-medium">${esc(a.name)}</td><td class="p-2">${esc(a.type)}</td><td class="p-2 text-right font-semibold ${num(a.balance)<0?'text-rose-600':''}">${num(a.balance)<0?'-':''}${money(a.balance)}</td></tr>`).join('')||'<tr><td colspan="3" class="p-4 text-center text-slate-500">No accounts found.</td></tr>'}</tbody></table></div>` : `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-slate-500 border-b"><th class="p-2">Date</th><th class="p-2">Description</th><th class="p-2">Category</th><th class="p-2">Account</th><th class="p-2 text-right">Amount</th><th class="p-2">Action</th></tr></thead><tbody>${rows.map(t=>`<tr class="border-b border-slate-100 dark:border-slate-800"><td class="p-2 whitespace-nowrap">${esc(t.date||'')}</td><td class="p-2">${esc(t.payee||t.description||t.notes||'Transaction')}<div class="text-xs text-slate-400">${esc(t.type||'')}</div></td><td class="p-2">${esc(t.category||'Uncategorized')}${t.subcategory?' / '+esc(t.subcategory):''}</td><td class="p-2">${esc(t.account||'')}${t.destinationAccount?' → '+esc(t.destinationAccount):''}</td><td class="p-2 text-right font-semibold whitespace-nowrap ${t.type==='Income'?'text-emerald-600':'text-rose-600'}">${t.type==='Income'?'+':'−'}${money(t.amount)}</td><td class="p-2 whitespace-nowrap"><button class="text-emerald-600 hover:underline mr-2" onclick="app.closeModal();app.editTransaction('${String(t.id).replace(/'/g,'\\\'')}')">Edit</button><button class="text-rose-600 hover:underline" onclick="app.closeModal();app.deleteTransaction('${String(t.id).replace(/'/g,'\\\'')}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="p-4 text-center text-slate-500">No matching entries for this period.</td></tr>'}</tbody></table></div>`;
                const total=kind==='accounts'?rows.reduce((a,x)=>a+num(x.balance),0):rows.reduce((a,x)=>a+num(x.amount),0);
                box.innerHTML=`<div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3"><div><h3 class="font-bold text-lg">${esc(title)}</h3><p class="text-xs text-slate-500 mt-1">${rows.length} ${kind==='accounts'?'account(s)':'entry/entries'} · Total ${money(total)}</p></div><button type="button" onclick="app.closeModal()" class="text-slate-500 hover:text-slate-900">✕</button></div>${table}<div class="flex justify-end"><button onclick="app.closeModal()" class="px-4 py-2 border rounded-xl">Close</button></div>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }

            /**
             * Renders the  charts UI from the current app state.
             * Parameters: income, expense. Side effects, if any, are described by the statements below.
             */
            renderCharts(income, expense) {
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const assetTypes=['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'];
                const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+i);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})};});
                const monthTransactions=key=>this.countedTx().filter(t=>(this.parseLedgerDate(t.date)||'').startsWith(key));
                const incomeData=months.map(m=>monthTransactions(m.key).filter(t=>t.type==='Income').reduce((a,t)=>a+Math.max(0,num(t.amount)),0));
                const expenseData=months.map(m=>monthTransactions(m.key).filter(t=>this.isSpending(t)).reduce((a,t)=>a+Math.max(0,num(t.amount)),0));
                const ctxCf=document.getElementById('chart-cashflow').getContext('2d');if(this.charts.cf)this.charts.cf.destroy();
                this.charts.cf=new Chart(ctxCf,{type:'bar',data:{labels:months.map(m=>m.label),datasets:[{label:'Income',data:incomeData,backgroundColor:'#059669',borderRadius:6},{label:'Expenses / allocations',data:expenseData,backgroundColor:'#e11d48',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onClick:(event,elements,chart)=>{if(!elements.length)return;const el=elements[0],month=months[el.index],type=el.datasetIndex===0?'Income':'Expense';this.openDashboardDrilldown(`${month.label} — ${type} Entries`,'month-type',{monthKey:month.key,type});}}});
                this.populateDashboardPieYearOptions();
                this.renderDashboardPieChart();
                this.renderDashCharts();
            }

            // ---------- Dashboard charts: default charts you can hide or reorder, plus charts you build yourself ----------
            /** Default charts. Cash flow and Expense Breakdown are in the page; the others are drawn by drawDashChart. */
            dashChartDefaults(){ return {
                cashflow:{title:'Monthly Cash Flow Trend',sub:'Income vs spending, last 6 months',wide:true},
                breakdown:{title:'Expense Breakdown',sub:'Spending by category'},
                networth:{title:'Net worth over time',sub:'Month end, last 12 months',wide:true},
                budget:{title:'Budget vs actual',sub:'This month'} }; }
            /** Ready-made custom charts offered in Customise; each can be changed after it is added. */
            dashChartPresets(){ return [
                {title:'Invested each month',measure:'invested',by:'month',period:'12m',type:'bar'},
                {title:'Spending by account',measure:'spending',by:'account',period:'month',type:'hbar'},
                {title:'Top payees',measure:'spending',by:'payee',period:'3m',type:'hbar'},
                {title:'Spending by weekday',measure:'spending',by:'weekday',period:'3m',type:'bar'},
                {title:'Income by category',measure:'income',by:'category',period:'year',type:'doughnut'} ]; }
            /** Your charts in order: {id:'cashflow'} for a default one, {id:'c_…', spec:{title,measure,by,period,type}} for your own. Kept in the vault (and its backups). */
            dashChartList(){ const s=this.data.settings?.dashCharts; return Array.isArray(s)?s:[{id:'cashflow'},{id:'breakdown'},{id:'networth'},{id:'budget'}]; }
            saveDashChartList(list){ this.data.settings ||= {}; this.data.settings.dashCharts=list; this.saveVault(); this.renderDashCharts(); }
            renderDashCharts(){
                const grid=document.getElementById('dash-charts'); if(!grid||typeof Chart==='undefined')return;
                const list=this.dashChartList(), defs=this.dashChartDefaults(), esc=v=>this.escapeHtml(String(v??'')); this.charts.dash ||= {};
                const keep=new Set(list.map(c=>c.id));
                grid.querySelectorAll('[data-chart]').forEach(card=>{ if(keep.has(card.dataset.chart))return; if(card.dataset.gen){ this.charts.dash[card.dataset.chart]?.destroy(); delete this.charts.dash[card.dataset.chart]; card.remove(); } else card.hidden=true; });
                list.forEach((c,i)=>{
                    const info=c.spec?{title:c.spec.title||'My chart',sub:this.dashSpecLabel(c.spec),wide:c.spec.by==='month'}:defs[c.id]; if(!info)return;
                    let card=[...grid.querySelectorAll('[data-chart]')].find(x=>x.dataset.chart===c.id);
                    if(!card){ card=document.createElement('div'); card.dataset.chart=c.id; card.dataset.gen='1'; grid.appendChild(card); }
                    card.hidden=false; card.style.order=String(i);
                    if(!card.dataset.gen)return;
                    card.className=`dash-chart${info.wide?' lg:col-span-2':''} bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4`;
                    card.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold text-sm">${esc(info.title)}</h3><span class="text-xs text-slate-500">${esc(info.sub)}</span></div><div class="h-72"><canvas></canvas></div>`;
                    try{ this.drawDashChart(c,card.querySelector('canvas')); }catch(e){ console.error('Chart could not be drawn',e); }
                });
                grid.closest('.tab-panel')?.querySelector('.dash-charts-empty')?.remove();
                if(!list.length)grid.insertAdjacentHTML('beforebegin','<p class="dash-charts-empty">No charts on the Dashboard. Tap Customise to add some.</p>');
            }
            /** Draws one default or custom chart into a canvas (a short message instead when there is nothing to show). */
            drawDashChart(c,canvas){
                this.charts.dash ||= {}; this.charts.dash[c.id]?.destroy(); delete this.charts.dash[c.id];
                const money=v=>this.fmtMoney0(v), base={responsive:true,maintainAspectRatio:false,animation:{duration:400}};
                const empty=msg=>{ canvas.hidden=true; let p=canvas.parentElement.querySelector('.dash-chart-empty'); if(!p){ p=document.createElement('p'); p.className='dash-chart-empty'; canvas.parentElement.appendChild(p); } p.textContent=msg; };
                canvas.hidden=false; canvas.parentElement.querySelector('.dash-chart-empty')?.remove();
                let cfg;
                if(c.id==='networth'){ const h=this.netWorthHistory(12);
                    cfg={type:'line',data:{labels:h.map(x=>x.label),datasets:[{label:'Net worth',data:h.map(x=>x.value),borderColor:'#4f46e5',backgroundColor:'rgba(79,70,229,.12)',fill:true,tension:.3,pointRadius:3}]},options:{...base,scales:{y:{beginAtZero:true}},plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>money(x.parsed.y)}}}}}; }
                else if(c.id==='budget'){ const b=this.budgetVsActual(); if(!b.length)return empty('No budgets yet. Set them in Budgets.');
                    cfg={type:'bar',data:{labels:b.map(x=>x.category),datasets:[{label:'Spent',data:b.map(x=>x.spent),backgroundColor:b.map(x=>x.spent>x.limit?'#e11d48':'#059669'),borderRadius:6},{label:'Budget',data:b.map(x=>x.limit),backgroundColor:'#cbd5e1',borderRadius:6}]},options:{...base,indexAxis:'y',plugins:{tooltip:{callbacks:{label:x=>`${x.dataset.label}: ${money(x.parsed.x)}`}}}}}; }
                else if(c.spec){ const s=c.spec, d=this.customChartData(s); if(!d.values.some(v=>v))return empty('Nothing to show for this period.');
                    const round=s.type==='pie'||s.type==='doughnut', line=s.type==='line';
                    const colors=d.labels.map((l,i)=>s.by==='category'&&l!=='Other'?this.categoryColor(l):this.dashPalette(i));
                    cfg={type:round?s.type:line?'line':'bar',data:{labels:d.labels,datasets:[{label:s.title||'My chart',data:d.values,backgroundColor:line?'rgba(5,150,105,.15)':colors,borderColor:line?'#059669':undefined,fill:line,tension:.3,borderRadius:round||line?0:6}]},
                        options:{...base,indexAxis:s.type==='hbar'?'y':'x',...(round?{}:{scales:{[s.type==='hbar'?'x':'y']:{beginAtZero:true}}}),plugins:{legend:{display:round,position:'bottom'},tooltip:{callbacks:{label:x=>money(round?x.parsed:s.type==='hbar'?x.parsed.x:x.parsed.y)}}}}}; }
                if(cfg)this.charts.dash[c.id]=new Chart(canvas.getContext('2d'),cfg);
            }
            dashPalette(i){ return ['#059669','#4f46e5','#f59e0b','#e11d48','#0ea5e9','#8b5cf6','#14b8a6','#f97316','#64748b'][i%9]; }
            /** Month-end net worth for the last n months: today's balances, stepped back through the balance effect of every later entry. */
            netWorthHistory(n=12){
                const assetTypes=['Receivable','Checking','Cash','Savings','Savings Account','Investment','Investment Account','Fixed Deposit','Fixed Deposit Account','Recurring Deposit','RD','RD Account'], loanTypes=['Loan Account','Loan'];
                const accs=this.data.accounts||[]; const bal=new Map(accs.map(a=>[a.name,Number(a.balance)||0]));
                const worth=()=>accs.reduce((s,a)=>assetTypes.includes(a.type)?s+bal.get(a.name):loanTypes.includes(a.type)?s-Math.abs(bal.get(a.name)):s,0);
                const tx=(this.data.tx||[]).filter(t=>t&&!t.balanceEffectRemoved).map(t=>({t,d:this.normalizeLedgerDate(t.date)||''})).sort((a,b)=>b.d.localeCompare(a.d));
                const out=[], now=new Date(); let k=0;
                for(let i=0;i<n;i++){ const end=new Date(now.getFullYear(),now.getMonth()-i+1,0), endIso=this.todayISO(end);
                    while(k<tx.length&&tx[k].d>endIso){ this.txEffects(tx[k].t).forEach(e=>{ if(bal.has(e.account))bal.set(e.account,bal.get(e.account)-e.delta); }); k++; }
                    out.unshift({label:end.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}),value:Math.round(worth())}); }
                return out; }
            /** Each budget this month: its limit and what was spent in that category, most used (as a share) first. */
            budgetVsActual(){ const mk=this.todayISO().slice(0,7), spent={};
                this.countedTx().forEach(t=>{ if(!this.isSpending(t)||!(this.normalizeLedgerDate(t.date)||'').startsWith(mk))return; const c=this.spendingCategory(t); spent[c]=(spent[c]||0)+Math.abs(Number(t.amount)||0); });
                return Object.entries(this.data.budgets||{}).map(([category,limit])=>({category,limit:Number(limit)||0,spent:Math.round(spent[category]||0)})).filter(x=>x.limit>0).sort((a,b)=>b.spent/b.limit-a.spent/a.limit); }
            dashPeriodRange(p){ const now=new Date(), y=now.getFullYear(), m=now.getMonth(), first=k=>this.todayISO(new Date(y,m-k,1));
                return p==='month'?[first(0),'9999']:p==='lastmonth'?[first(1),this.todayISO(new Date(y,m,0))]:p==='3m'?[first(2),'9999']:p==='6m'?[first(5),'9999']:p==='12m'?[first(11),'9999']:p==='year'?[`${y}-01-01`,'9999']:['0000','9999']; }
            dashSpecLabel(s){ const m={spending:'Spending',income:'Income',invested:'Invested'}[s.measure]||'', by={category:'by category',account:'by account',payee:'by payee',month:'by month',weekday:'by weekday'}[s.by]||'';
                const per={month:'this month',lastmonth:'last month','3m':'last 3 months','6m':'last 6 months','12m':'last 12 months',year:'this year',all:'all time'}[s.period]||'';
                const only=[s.onlyCat,s.onlyAcc].filter(Boolean).join(', '); return `${m}${only?` (${only})`:''} ${by} · ${per}`; }
            /** A custom chart's numbers: the chosen money (spending, income or invested) in the period, added up by the chosen grouping. */
            customChartData(s){
                const [from,to]=this.dashPeriodRange(s.period); const inv=s.measure==='invested'?new Set(this.investedTx()):null; const W=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                const catOf=t=>s.measure==='spending'?this.spendingCategory(t):(t.category||'Uncategorized');
                const rows=this.countedTx().filter(t=>{ const d=this.normalizeLedgerDate(t.date)||''; if(!d||d<from||d>to)return false; if(s.onlyCat&&catOf(t)!==s.onlyCat)return false; if(s.onlyAcc&&t.account!==s.onlyAcc)return false; return s.measure==='income'?t.type==='Income':s.measure==='invested'?inv.has(t):this.isSpending(t); });
                const keyOf=t=>{ const d=this.normalizeLedgerDate(t.date); if(s.by==='month')return d.slice(0,7); if(s.by==='weekday')return W[(new Date(d+'T12:00:00').getDay()+6)%7];
                    if(s.by==='account')return t.account||'No account'; if(s.by==='payee')return String(t.payee||t.description||'').trim().slice(0,30)||'Unknown'; return catOf(t); };
                const sum=new Map(); rows.forEach(t=>{ const k=keyOf(t); sum.set(k,(sum.get(k)||0)+Math.abs(Number(t.amount)||0)); });
                let entries=[...sum.entries()];
                if(s.by==='month'){ // every month in the period, oldest first, a month with nothing as 0
                    const last=to==='9999'?this.todayISO().slice(0,7):to.slice(0,7); const start=from==='0000'?([...sum.keys()].sort()[0]||last):from.slice(0,7); const keys=[]; let [yy,mm]=start.split('-').map(Number);
                    while(keys.length<240){ const k=`${yy}-${String(mm).padStart(2,'0')}`; keys.push(k); if(k>=last)break; if(++mm>12){ mm=1; yy++; } }
                    entries=keys.map(k=>[this.monthLabel(k),sum.get(k)||0]); }
                else if(s.by==='weekday')entries=W.map(w=>[w,sum.get(w)||0]);
                else { entries.sort((a,b)=>b[1]-a[1]); if(entries.length>8)entries=[...entries.slice(0,7),['Other',entries.slice(7).reduce((a,e)=>a+e[1],0)]]; }
                return {labels:entries.map(e=>e[0]),values:entries.map(e=>Math.round(e[1]))}; }
            /** Customise: the Dashboard's charts in order (move, remove, change), and add a default one, a ready-made one or your own. */
            openChartCustomiser(work){
                const list=work||this.dashChartList().map(c=>({...c,spec:c.spec?{...c.spec}:undefined})); const defs=this.dashChartDefaults(), esc=v=>this.escapeHtml(String(v??''));
                const name=c=>c.spec?(c.spec.title||'My chart'):defs[c.id]?.title||c.id; const missing=Object.keys(defs).filter(id=>!list.some(c=>c.id===id));
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div id="cc" class="space-y-3"><div class="flex justify-between items-center"><h3 class="font-bold text-base">Dashboard charts</h3><button type="button" data-x class="text-slate-400" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                    <p class="text-sm text-slate-500">Shown in this order. Move a chart with the arrows; ✕ takes it off the Dashboard.</p>
                    <div class="cc-list">${list.map((c,i)=>`<div class="cc-row"><span class="cc-name"><b>${esc(name(c))}</b><small>${c.spec?esc(this.dashSpecLabel(c.spec)):'Default chart'}</small></span>${c.spec?`<button type="button" class="cc-b" data-edit="${i}" aria-label="Change ${esc(name(c))}"><i data-lucide="pencil"></i></button>`:''}<button type="button" class="cc-b" data-up="${i}" ${i?'':'disabled'} aria-label="Move ${esc(name(c))} up"><i data-lucide="arrow-up"></i></button><button type="button" class="cc-b" data-down="${i}" ${i<list.length-1?'':'disabled'} aria-label="Move ${esc(name(c))} down"><i data-lucide="arrow-down"></i></button><button type="button" class="cc-b" data-del="${i}" aria-label="Remove ${esc(name(c))}"><i data-lucide="x"></i></button></div>`).join('')||'<p class="cc-none">No charts yet. Add one below.</p>'}</div>
                    <h4 class="cc-h">Add a chart</h4><div class="cc-add">${missing.map(id=>`<button type="button" class="pie-pill" data-add-def="${id}"><i data-lucide="plus"></i><span>${esc(defs[id].title)}</span></button>`).join('')}${this.dashChartPresets().map((p,i)=>`<button type="button" class="pie-pill" data-add-pre="${i}"><i data-lucide="plus"></i><span>${esc(p.title)}</span></button>`).join('')}<button type="button" class="pie-pill on" data-build><i data-lucide="wand-sparkles"></i><span>Build your own…</span></button></div>
                    <div class="af-actions"><button type="button" class="s-btn s-secondary" data-x>Cancel</button><button type="button" class="s-btn s-primary" data-save>Save</button></div></div>`;
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.();
                const newId=()=>'c_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
                document.getElementById('cc').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return; const d=b.dataset;
                    if('x' in d)return this.closeModal();
                    if('save' in d){ this.closeModal(); return this.saveDashChartList(list.map(c=>c.spec?{id:c.id,spec:c.spec}:{id:c.id})); }
                    if('build' in d)return this.openChartBuilder(list,-1);
                    if(d.edit!=null)return this.openChartBuilder(list,+d.edit);
                    if(d.up!=null){ const i=+d.up; [list[i-1],list[i]]=[list[i],list[i-1]]; }
                    else if(d.down!=null){ const i=+d.down; [list[i+1],list[i]]=[list[i],list[i+1]]; }
                    else if(d.del!=null)list.splice(+d.del,1);
                    else if(d.addDef)list.push({id:d.addDef});
                    else if(d.addPre!=null)list.push({id:newId(),spec:{...this.dashChartPresets()[+d.addPre]}});
                    this.openChartCustomiser(list); });
            }
            /** Build your own chart (or change one): what to show, grouped how, over which period, as which kind of chart, with a live preview. */
            openChartBuilder(list,index){
                const cur=index>=0?list[index].spec:{title:'',measure:'spending',by:'category',period:'month',type:'bar'}; const esc=v=>this.escapeHtml(String(v??''));
                const sel=(id,label,opts,v)=>`<label class="af-row"><span>${label}</span><select id="${id}">${opts.map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div id="cb" class="space-y-3"><div class="flex justify-between items-center"><h3 class="font-bold text-base">${index>=0?'Change chart':'Build your own chart'}</h3><button type="button" data-back class="text-slate-400" aria-label="Back"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                    <div class="af-form"><label class="af-row"><span>Name</span><input id="cb-title" type="text" maxlength="40" placeholder="e.g. Food by month" value="${esc(cur.title)}"></label>
                    ${sel('cb-measure','Show',[['spending','Spending'],['income','Income'],['invested','Money invested']],cur.measure)}
                    ${sel('cb-by','Group by',[['category','Category'],['account','Account'],['payee','Payee'],['month','Month'],['weekday','Day of the week']],cur.by)}
                    ${sel('cb-only-cat','Only category',[['','All categories'],...[...new Set([...(this.data.categories||[]),...this.countedTx().map(t=>t.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b)).map(c=>[esc(c),esc(c)])],esc(cur.onlyCat||''))}
                    ${sel('cb-only-acc','Only account',[['','All accounts'],...(this.data.accounts||[]).map(a=>[esc(a.name),esc(a.name)])],esc(cur.onlyAcc||''))}
                    ${sel('cb-period','Period',[['month','This month'],['lastmonth','Last month'],['3m','Last 3 months'],['6m','Last 6 months'],['12m','Last 12 months'],['year','This year'],['all','All time']],cur.period)}
                    ${sel('cb-type','Chart',[['bar','Bars'],['hbar','Bars across'],['line','Line'],['pie','Pie'],['doughnut','Ring']],cur.type)}</div>
                    <div class="cb-preview"><div class="h-56"><canvas id="cb-canvas"></canvas></div></div>
                    <div class="af-actions"><button type="button" class="s-btn s-secondary" data-back>Back</button><button type="button" class="s-btn s-primary" data-ok>${index>=0?'Save chart':'Add chart'}</button></div></div>`;
                window.lucide?.createIcons?.();
                const spec=()=>{ const s={measure:document.getElementById('cb-measure').value,by:document.getElementById('cb-by').value,period:document.getElementById('cb-period').value,type:document.getElementById('cb-type').value};
                    const oc=document.getElementById('cb-only-cat').value, oa=document.getElementById('cb-only-acc').value; if(oc)s.onlyCat=oc; if(oa)s.onlyAcc=oa;
                    s.title=document.getElementById('cb-title').value.trim()||this.dashSpecLabel(s).replace(' · ',', '); return s; };
                const preview=()=>{ try{ this.drawDashChart({id:'__preview',spec:spec()},document.getElementById('cb-canvas')); }catch(e){ console.error(e); } };
                document.querySelectorAll('#cb select').forEach(s=>s.addEventListener('change',preview)); preview();
                document.getElementById('cb').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return;
                    if('back' in b.dataset){ this.charts.dash?.__preview?.destroy(); return this.openChartCustomiser(list); }
                    if('ok' in b.dataset){ this.charts.dash?.__preview?.destroy(); const s=spec(); if(index>=0)list[index]={...list[index],spec:s}; else list.push({id:'c_'+Date.now().toString(36),spec:s}); this.openChartCustomiser(list); } });
            }

            /**
             * Handles the populate dashboard pie year options workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            populateDashboardPieYearOptions() {
                const select=document.getElementById('dashboard-pie-year');
                if(!select) return;
                const current=select.value;
                const years=[...new Set((this.countedTx()||[]).map(t=>(this.parseLedgerDate(t.date)||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort((a,b)=>b.localeCompare(a));
                const nowYear=String(new Date().getFullYear());
                if(!years.includes(nowYear)) years.unshift(nowYear);
                select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
                select.value=years.includes(current)?current:nowYear;
            }

            /**
             * Renders the  dashboard pie chart UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderDashboardPieChart() {
                const canvas=document.getElementById('chart-categories');
                if(!canvas || typeof Chart==='undefined') return;
                const year=document.getElementById('dashboard-pie-year')?.value||String(new Date().getFullYear());
                const month=document.getElementById('dashboard-pie-month')?.value||'all';
                const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
                const period=month==='all'?`${year} — All months`:`${monthNames[Number(month)-1]} ${year}`;
                const label=document.getElementById('dashboard-pie-period-label');if(label)label.textContent=`Expenses by category · ${period}`;
                const num=v=>{if(typeof v==='string')v=v.replace(/[₹,\s]/g,'');const n=Number(v);return Number.isFinite(n)?n:0;};
                const catTotals={};
                this.countedTx().filter(t=>{
                    if(!this.isSpending(t))return false;
                    const d=this.parseLedgerDate(t.date)||'';
                    return d.slice(0,4)===year && (month==='all'||d.slice(5,7)===month);
                }).forEach(t=>{const cat=t.category||'Uncategorized';catTotals[cat]=(catTotals[cat]||0)+Math.max(0,num(t.amount));});
                if(this.charts.cat)this.charts.cat.destroy();
                // Categories you chose to leave out (remembered on this device) are not drawn
                this._pieTotals=catTotals; const hidden=new Set(this.pieHiddenCategories()); const all=Object.keys(catTotals).sort((a,b)=>catTotals[b]-catTotals[a]);
                const categories=all.filter(c=>!hidden.has(c)); const off=all.length-categories.length;
                const pick=document.querySelector('#dashboard-pie-cats span'); if(pick)pick.textContent=off?`${categories.length} of ${all.length} categories`:'All categories';
                document.getElementById('dashboard-pie-cats')?.classList.toggle('on',!!off);
                if(label&&off)label.textContent+=` · ${off} hidden`;
                if(!categories.length){
                    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
                    this.charts.cat=new Chart(canvas.getContext('2d'),{type:'pie',data:{labels:['No expenses'],datasets:[{data:[1],backgroundColor:['#cbd5e1']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false},title:{display:true,text:all.length?'Every category is hidden: tap Categories':'No expenses for this period'}}}});
                    return;
                }
                this.charts.cat=new Chart(canvas.getContext('2d'),{type:'pie',data:{labels:categories,datasets:[{data:categories.map(c=>catTotals[c]),backgroundColor:categories.map(c=>this.categoryColor(c)),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onClick:(event,elements)=>{if(!elements.length)return;const category=categories[elements[0].index];if(category)this.openDashboardDrilldown(`${category} — ${period}`,'category-period',{category,year,month});}}});
            }
            /** Expense Breakdown: categories left out of the pie (this device only). */
            pieHiddenCategories(){ try{ const v=JSON.parse(localStorage.getItem('aifico_pie_hidden')||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
            /** Pick which categories the Expense Breakdown pie shows: the period's categories, biggest first, with their amounts. */
            openPieCategoryPicker(){
                const totals=this._pieTotals||{}; const cats=Object.keys(totals).sort((a,b)=>totals[b]-totals[a]); const hidden=new Set(this.pieHiddenCategories()); const esc=v=>this.escapeHtml(String(v??''));
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex justify-between items-center pb-2"><h3 class="font-bold text-base">Categories in the pie</h3><button type="button" onclick="app.closeModal()" class="text-slate-400" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button></div>
                    ${cats.length?`<div class="pie-pick-all"><button type="button" class="s-btn s-secondary" data-all="1">Show all</button><button type="button" class="s-btn s-secondary" data-all="0">Hide all</button></div>
                    <div class="pie-pick-list">${cats.map(c=>`<label class="pie-pick"><input type="checkbox" value="${esc(c)}" ${hidden.has(c)?'':'checked'}><i class="cat-dot" style="--c:${esc(this.categoryColor(c))}"></i><span>${esc(c)}</span><b>${this.fmtMoney0(totals[c])}</b></label>`).join('')}</div>`:'<p class="text-sm text-slate-500">No spending in this period.</p>'}
                    <div class="af-actions"><button type="button" class="s-btn s-secondary" onclick="app.closeModal()">Cancel</button><button type="button" class="s-btn s-primary" id="pie-pick-save">Show</button></div>`;
                document.getElementById('modal-container').classList.remove('hidden'); window.lucide?.createIcons?.();
                box.querySelectorAll('[data-all]').forEach(b=>b.addEventListener('click',()=>box.querySelectorAll('.pie-pick input').forEach(i=>{ i.checked=b.dataset.all==='1'; })));
                document.getElementById('pie-pick-save').addEventListener('click',()=>{
                    // keep choices for categories not in this period; update the ones shown here
                    const next=new Set(this.pieHiddenCategories()); box.querySelectorAll('.pie-pick input').forEach(i=>{ i.checked?next.delete(i.value):next.add(i.value); });
                    try{ localStorage.setItem('aifico_pie_hidden',JSON.stringify([...next])); }catch(e){} this.closeModal(); this.renderDashboardPieChart(); });
            }

            // ---------- Stats: where the money went (or came from) in a month or a year ----------
            statsState(){ this.stats ||= {mode:'month',kind:'expense',key:this.todayISO().slice(0,7)}; return this.stats; }
            setStatsMode(mode){ const s=this.statsState(); if(mode===s.mode)return; const k=s.key;
                // All time stays all time; "March · all years" becomes all time in Year view; otherwise keep the same year
                if(k==='all'||k.startsWith('*-'))s.key=mode==='year'?'all':(k==='all'?'all':k);
                else s.key=mode==='year'?k.slice(0,4):(k.slice(0,4)===this.todayISO().slice(0,4)?this.todayISO().slice(0,7):`${k.slice(0,4)}-12`);
                s.mode=mode; this.renderStats(); }
            // Stats period keys: "2026-03" a month, "2026" a year, "*-03" that month in every year, "all" all time
            statsInPeriod(iso,key=this.statsState().key){ iso=String(iso||''); if(key==='all')return !!iso; if(key.startsWith('*-'))return iso.slice(5,7)===key.slice(2); return iso.startsWith(key); }
            statsPeriodLabel(key=this.statsState().key,long=false){ const M=['January','February','March','April','May','June','July','August','September','October','November','December'];
                if(key==='all')return 'All time'; if(key.startsWith('*-'))return (long?M:M.map(m=>m.slice(0,3)))[Number(key.slice(2))-1]+' · all years'; if(/^\d{4}$/.test(key))return key; return this.monthLabel(key,long); }
            setStatsKind(kind){ this.statsState().kind=kind; this.renderStats(); }
            setStatsPeriod(key){ const s=this.statsState(); s.key=key==='now'?(s.mode==='year'?this.todayISO().slice(0,4):this.todayISO().slice(0,7)):key; this.renderStats(); }
            /** Tapping the period name: pick any month and year (Month view) or any year (Year view) */
            openStatsPeriodPicker(){
                const s=this.statsState(); const box=document.getElementById('modal-box'); const esc=v=>this.escapeHtml(String(v??''));
                const years=[...new Set([new Date().getFullYear(),...this.countedTx().map(t=>Number(String(this.normalizeLedgerDate(t.date)||'').slice(0,4))).filter(y=>y>1990&&y<3000)])].sort((a,b)=>b-a);
                const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
                // Current choice: "all" = All months + All years; "*-03" = March + All years; "2026" in Month view = All months + 2026
                const k=s.key; const curY=k==='all'||k.startsWith('*-')?'all':k.slice(0,4); const curM=k.startsWith('*-')?k.slice(2):(k==='all'||/^\d{4}$/.test(k)?'all':k.slice(5,7));
                box.innerHTML=`<div class="more-head"><h3 class="font-bold text-lg">Show ${s.mode==='year'?'year':'month'}</h3><button type="button" onclick="app.closeModal()" aria-label="Close">✕</button></div>
                <form id="st-pick" class="space-y-3"><div class="st-pick-row">${s.mode==='year'?'':`<label class="mf-compact"><span>Month</span><select id="stp-m"><option value="all" ${curM==='all'?'selected':''}>All months</option>${months.map((m,i)=>{ const v=String(i+1).padStart(2,'0'); return `<option value="${v}" ${v===curM?'selected':''}>${m}</option>`; }).join('')}</select></label>`}
                <label class="mf-compact"><span>Year</span><select id="stp-y"><option value="all" ${curY==='all'?'selected':''}>All years</option>${years.map(y=>`<option ${String(y)===curY?'selected':''}>${y}</option>`).join('')}</select></label></div>
                <div class="lp-quick"><button type="button" class="s-btn s-secondary" onclick="app.closeModal();app.setStatsPeriod('now')">${s.mode==='year'?'This year':'This month'}</button><button type="submit" class="s-btn s-primary">Show</button></div></form>`;
                const mc=document.getElementById('modal-container'); mc.classList.add('more-sheet'); mc.classList.remove('hidden');
                document.getElementById('st-pick').onsubmit=e=>{ e.preventDefault(); const y=document.getElementById('stp-y').value; const m=document.getElementById('stp-m')?.value; this.closeModal();
                    const key=s.mode==='year'?(y==='all'?'all':String(y)):(y==='all'?(m==='all'?'all':`*-${m}`):(m==='all'?String(y):`${y}-${m}`)); this.setStatsPeriod(key); };
            }
            shiftStatsPeriod(step){ const s=this.statsState(); if(s.key==='all')return; if(s.key.startsWith('*-')){ const m=((Number(s.key.slice(2))-1+step)%12+12)%12+1; s.key='*-'+String(m).padStart(2,'0'); return this.renderStats(); } if(s.mode==='year'||/^\d{4}$/.test(s.key)){ s.key=String(Number(s.key)+step); } else { const [y,m]=s.key.split('-').map(Number); s.key=this.todayISO(new Date(y,m-1+step,1)).slice(0,7); } this.renderStats(); }
            /** Category totals for the chosen period: [{category, amount, share, count}], largest first. Excluded entries are not counted. */
            statsRows(){
                const s=this.statsState(); const types=s.kind==='income'?['Income']:['Expense','EMI','Installment']; const by=new Map(); let total=0;
                this.countedTx().forEach(t=>{ if(s.kind==='income'?t.type!=='Income':!this.isSpending(t))return; const iso=this.normalizeLedgerDate(t.date); if(!this.statsInPeriod(iso,s.key))return; const a=Math.max(0,Number(t.amount)||0); const c=s.kind==='income'?(t.category||'Uncategorized'):this.spendingCategory(t); const o=by.get(c)||{category:c,amount:0,count:0}; o.amount+=a; o.count++; by.set(c,o); total+=a; });
                return {total,rows:[...by.values()].sort((a,b)=>b.amount-a.amount).map(o=>({...o,share:total?o.amount/total*100:0}))};
            }
            renderStats(){
                const panel=document.getElementById('panel-stats'); if(!panel||!this.data)return; const s=this.statsState();
                const label=document.getElementById('stats-period-label'); if(label)label.textContent=this.statsPeriodLabel(s.key); panel.querySelectorAll('.st-head .lp-nav').forEach(b=>b.hidden=s.key==='all');
                panel.querySelectorAll('.st-mode [data-mode]').forEach(b=>{ const on=b.dataset.mode===s.mode; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
                panel.querySelectorAll('.st-kind [data-kind]').forEach(b=>{ const on=b.dataset.kind===s.kind; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
                const sumOf=kind=>{ const types=kind==='income'?['Income']:['Expense','EMI','Installment']; return this.countedTx().filter(t=>(kind==='income'?t.type==='Income':this.isSpending(t))&&this.statsInPeriod(this.normalizeLedgerDate(t.date),s.key)).reduce((n,t)=>n+Math.max(0,Number(t.amount)||0),0); };
                const setText=(id,v)=>{ const el=document.getElementById(id); if(el)el.textContent=v; };
                setText('stats-total-expense',this.fmtMoney(sumOf('expense'))); setText('stats-total-income',this.fmtMoney(sumOf('income')));
                const {total,rows}=this.statsRows(); const period=this.statsPeriodLabel(s.key,true);
                const center=document.getElementById('stats-center'); if(center)center.innerHTML=rows.length?`<span>${s.kind==='income'?'Income':'Spent'}</span><b>${this.fmtMoney0(total)}</b><small>${rows.length} categor${rows.length===1?'y':'ies'}</small>`:'';
                const list=document.getElementById('stats-list'); const esc=v=>this.escapeHtml(String(v??'')); const attrJs=v=>JSON.stringify(v).replace(/&/g,'&amp;').replace(/'/g,'&#39;');
                if(list)list.innerHTML=rows.length?rows.map(r=>`<button type="button" class="st-row" onclick='app.openLedgerCategory(${attrJs(r.category)},${attrJs(s.key.startsWith("*-")?"all":s.key)})' title="Show these entries in Core Ledger"><span class="st-pct" style="--c:${this.categoryColor(r.category)};--t:${this.readableOn(this.categoryColor(r.category))}">${r.share>=10?Math.round(r.share):r.share.toFixed(1)}%</span><span class="st-cat"><b>${esc(r.category)}</b><small>${r.count} entr${r.count===1?'y':'ies'}</small></span><span class="st-amt">${this.fmtMoney(r.amount)}</span></button>`).join(''):`<p class="lx-none">No ${s.kind==='income'?'income':'expenses'} in ${esc(period)}.</p>`;
                const canvas=document.getElementById('chart-stats'); if(!canvas||typeof Chart==='undefined')return;
                this.charts ||= {}; if(this.charts.stats)this.charts.stats.destroy();
                const dark=document.documentElement.classList.contains('dark');
                this.charts.stats=new Chart(canvas.getContext('2d'),{type:'doughnut',data:{labels:rows.length?rows.map(r=>r.category):['None'],datasets:[{data:rows.length?rows.map(r=>r.amount):[1],backgroundColor:rows.length?rows.map(r=>this.categoryColor(r.category)):[dark?'#334155':'#e2e8f0'],borderColor:dark?'#0f172a':'#fff',borderWidth:2}]},
                    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',animation:{duration:250},plugins:{legend:{display:false},tooltip:{enabled:!!rows.length,callbacks:{label:c=>` ${c.label}: ${this.fmtMoney(c.raw)} (${rows[c.dataIndex]?.share.toFixed(1)}%)`}}},
                    onClick:(e,els)=>{ if(!els.length||!rows.length)return; const r=rows[els[0].index]; if(r)this.openLedgerCategory(r.category,s.key.startsWith('*-')?'all':s.key); }}});
            }

        }
