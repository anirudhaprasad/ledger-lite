// AificoApp methods: schedules (11 methods). Part of the AificoApp prototype chain.
        class AificoAppSchedules extends AificoAppGoals {
            /**
             * Validates and saves  salary schedule.
             * Parameters: event. Side effects, if any, are described by the statements below.
             */
            saveSalarySchedule(event){
                event.preventDefault();
                const accountKey=document.getElementById('salary-account').value;
                const account=this.data.accounts.find(a=>String(a.id||a.name)===String(accountKey)||String(a.name)===String(accountKey));
                const amount=Number(document.getElementById('salary-amount').value);
                if(!account||!Number.isFinite(amount)||amount<=0)return alert('Select a checking/salary account and enter a valid salary amount.');
                this.data.salarySchedule={title:document.getElementById('salary-title').value.trim()||'Monthly Salary',amount,accountId:String(account.id||account.name),accountName:account.name,day:Math.min(28,Math.max(1,Number(document.getElementById('salary-day').value)||1)),startMonth:document.getElementById('salary-start').value,enabled:true};
                this.processSalarySchedule();
                this.saveVault();this.renderAll();this.closeModal();
            }
            /**
             * Handles the process salary schedule workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            processSalarySchedule(){
                const s=this.data.salarySchedule;if(!s||!s.enabled||!s.amount||!s.startMonth)return;
                const account=this.data.accounts.find(a=>String(a.id||a.name)===String(s.accountId)||String(a.name).toLowerCase()===String(s.accountName||'').toLowerCase());
                if(!account)return;
                const now=new Date(), start=new Date(s.startMonth+'-01T12:00:00');
                let cursor=new Date(start.getFullYear(),start.getMonth(),1), guard=0, changed=false;
                while((cursor.getFullYear()<now.getFullYear()||(cursor.getFullYear()===now.getFullYear()&&cursor.getMonth()<=now.getMonth()))&&guard++<240){
                    const month=cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0');
                    const day=Math.min(Number(s.day)||1,28);
                    const date=new Date(cursor.getFullYear(),cursor.getMonth(),day,12);
                    if(date<=now&&!this.data.tx.some(t=>t.recurringSalaryMonth===month&&t.recurringSalaryAccount===String(s.accountId))){
                        const tx={id:'salary_auto_'+month+'_'+Date.now(),date:date.toISOString().slice(0,10),type:'Income',amount:Number(s.amount),account:account.name,category:'Salary',subcategory:'Monthly Salary',payee:s.title||'Monthly Salary',notes:'Automatically generated monthly salary',description:`${s.title||'Monthly Salary'} — ${month}`,currency:'INR',source:'recurring-salary',recurringSalaryMonth:month,recurringSalaryAccount:String(s.accountId)};
                        this.data.tx.unshift(tx);account.balance=(Number(account.balance)||0)+Number(s.amount);this.ensureCategoryAndSubcategory('Salary','Monthly Salary');changed=true;
                    }
                    cursor.setMonth(cursor.getMonth()+1);
                }
                if(changed)this.saveVault();
            }
            /**
             * Renders the  salary schedule UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderSalarySchedule(){
                const el=document.getElementById('salary-schedule-container');if(!el)return;
                const s=this.data.salarySchedule;
                if(!s){el.innerHTML='<div class="p-4 rounded-xl border border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800/50 text-sm">No monthly salary schedule configured. Set your salary amount and checking account to auto-create a monthly income entry.</div>';return;}
                const enabled=s.enabled!==false;
                el.innerHTML=`<div class="p-4 rounded-xl border ${enabled?'border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800/50':'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20'} flex items-center justify-between gap-3"><div><h4 class="font-bold">${this.escapeHtml(s.title||'Monthly Salary')}</h4><p class="text-sm text-slate-600 dark:text-slate-300">₹${Number(s.amount).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} / month · ${this.escapeHtml(s.accountName||'Account')} · Day ${Number(s.day)||1}</p><p class="text-xs ${enabled?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-300'} mt-1">Auto-entry ${enabled?'enabled':'disabled'} · One entry per month</p></div><div class="flex gap-3"><button onclick="app.openSalaryScheduleModal()" class="text-sm text-blue-600">Edit</button><button onclick="app.toggleSalarySchedule()" class="text-sm ${enabled?'text-rose-600':'text-emerald-700 dark:text-emerald-400'} font-medium">${enabled?'Disable':'Enable'}</button></div></div>`;
            }
            /**
             * Changes the salary schedule and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async toggleSalarySchedule(){
                const s=this.data.salarySchedule;
                if(!s)return alert('No monthly salary schedule is configured.');
                const currentlyEnabled=s.enabled!==false;
                const message=currentlyEnabled
                    ?'Disable future automatic salary entries? Existing salary transactions will remain.'
                    :'Enable automatic monthly salary entries? The app may create any missing salary entries from the configured start month through the current month. Existing entries will not be duplicated.';
                if(!await this.uiConfirm(message))return;
                s.enabled=!currentlyEnabled;
                this.saveVault();
                this.renderAll();
                alert(s.enabled?'Automatic salary entries are now enabled.':'Automatic salary entries are now disabled. Existing salary transactions were not changed.');
            }
            /**
             * Renders the  yearly UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderYearly() {
                const container=document.getElementById('yearly-container');if(!container)return;
                container.innerHTML=(this.data.yearly||[]).map(y=>{
                    const destinationType=y.destinationType||(y.sourceAccount&&y.destinationAccount?'account':'legacy');
                    const target=destinationType==='category'?`Category: ${this.escapeHtml(y.category||'Uncategorized')} ${y.subcategory?' / '+this.escapeHtml(y.subcategory):''}`:destinationType==='account'?`Transfer: ${this.escapeHtml(y.sourceAccountName||'Source')} → ${this.escapeHtml(y.destinationAccountName||'Destination')}`:`Legacy schedule — not auto-posted`;
                    const disabled=y.enabled===false;
                    const sid=String(y.id).replace(/'/g,"\\'");
                    return `<div class="yr-item p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${disabled?'bg-slate-100 dark:bg-slate-900/70 border-slate-300 dark:border-slate-700':'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}">
                      <div class="min-w-0"><h4 class="font-bold text-sm ${disabled?'text-slate-500 dark:text-slate-400':''}">${this.escapeHtml(y.title||'Scheduled payment')} ${disabled?'<span class="ml-2 text-xs font-semibold text-slate-500">DISABLED</span>':''}</h4>
                      <p class="text-xs ${disabled?'text-slate-400':'text-slate-500'}">Start: ${this.escapeHtml(y.startDate||y.dueDate||'Not set')} · End: ${this.escapeHtml(y.endDate||'No end date')} · ${this.escapeHtml(y.frequency||'monthly')} · ${target} · ${disabled?'Disabled':'Auto-entry enabled'}</p></div>
                      <div class="yr-side flex flex-wrap items-center gap-3"><span class="text-lg font-bold ${disabled?'text-slate-500':''}">₹${Number(y.amount||0).toLocaleString('en-IN')}</span><button onclick="app.openYearlyModal('${sid}')" class="text-xs text-blue-600 hover:text-blue-800">Edit${destinationType==='legacy'?' / Convert':''}</button>${destinationType!=='legacy'?`<button onclick="app.toggleRecurringPayment('${sid}')" class="text-xs ${disabled?'text-emerald-700 hover:text-emerald-900':'text-rose-600 hover:text-rose-800'} font-medium">${disabled?'Enable':'Disable'}</button>`:''}<button onclick="app.deleteScheduledItem('${sid}')" class="text-xs text-rose-600 hover:text-rose-800 font-medium">Delete</button></div>
                    </div>`;
                }).join('')||'<p class="text-sm text-slate-500 py-6 text-center">No scheduled payments yet.</p>';
            }

            /**
             * Opens the  yearly modal screen, dialog, or workflow.
             * Parameters: id=null. Side effects, if any, are described by the statements below.
             */
            openYearlyModal(id=null) {
                const existing=id?this.data.yearly.find(x=>String(x.id)===String(id)):null;
                const nextMonth=new Date();nextMonth.setDate(1);nextMonth.setMonth(nextMonth.getMonth()+1);const nextMonthStart=nextMonth.getFullYear()+'-'+String(nextMonth.getMonth()+1).padStart(2,'0')+'-01';const y=existing?{...existing,startDate:(existing.sourceAccount&&existing.destinationAccount?(existing.startDate||existing.dueDate):nextMonthStart)}:{title:'',amount:'',sourceAccount:'',destinationAccount:'',frequency:'monthly',startDate:nextMonthStart,day:1,enabled:true};
                const accounts=this.data.accounts||[];
                const opts=accounts.map(a=>`<option value="${this.escapeHtml(String(a.id||a.name))}">${this.escapeHtml(a.name||'Unnamed account')} (${this.escapeHtml(a.type||'Account')})</option>`).join('');
                const box=document.getElementById('modal-box');
                box.innerHTML=`<div class="flex items-center justify-between border-b pb-3"><h3 class="font-bold text-lg">${existing?'Edit':'Add'} Recurring Auto Debit / Transfer</h3><button type="button" onclick="app.closeModal()">✕</button></div>
                <form onsubmit="app.saveRecurringPayment(event,${existing?`'${String(y.id).replace(/'/g,"\\'")}'`:'null'})" class="space-y-3">
                  <label class="block text-sm">Payment name / description<input id="sched-title" required maxlength="120" value="${this.escapeHtml(y.title||'')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                  <label class="block text-sm">Amount (₹)<input id="sched-amount" type="number" min="0.01" step="0.01" required value="${Number(y.amount)||''}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><button type="button" onclick="app.openAmountCalculator('sched-amount')" class="mt-1 text-xs text-emerald-600 hover:underline">🧮 Calculator</button></label>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3"><label class="block text-sm">From account<select id="sched-source" required class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><option value="">Select source account</option>${opts}</select></label><label class="block text-sm">Destination type<select id="sched-dest-type" onchange="app.toggleScheduleDestination()" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><option value="account" ${(y.destinationType||'account')==='account'?'selected':''}>Account (transfer)</option><option value="category" ${y.destinationType==='category'?'selected':''}>Category (expense / payment)</option></select></label></div>
                  <div id="sched-dest-account-wrap" class="${y.destinationType==='category'?'hidden':''}"><label class="block text-sm">Destination account<select id="sched-dest" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><option value="">Select destination account</option>${opts}</select></label></div>
                  <div id="sched-dest-category-wrap" class="${y.destinationType==='category'?'':'hidden'} grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label class="block text-sm">Transaction type<select id="sched-tx-type" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${[['Expense','Expense'],['EMI','EMI / Installment'],['Investment','Investment'],['Insurance','Insurance'],['Transfer','Transfer']].map(([v,l])=>`<option value="${v}" ${(y.transactionType||'Expense')===v?'selected':''}>${l}</option>`).join('')}</select></label>
                    <label class="block text-sm">Category<input id="sched-category" list="sched-category-options" value="${this.escapeHtml(y.category||'')}" placeholder="e.g. Rent, Insurance" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><datalist id="sched-category-options">${(this.data.categories||[]).map(c=>`<option value="${this.escapeHtml(typeof c==='string'?c:c.name||c.title||'')}"></option>`).join('')}</datalist></label>
                    <label class="block text-sm">Subcategory<input id="sched-subcategory" value="${this.escapeHtml(y.subcategory||'')}" placeholder="e.g. PG, HouseRent" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3"><label class="block text-sm">Frequency<select id="sched-frequency" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800">${[['monthly','Monthly'],['quarterly','Quarterly'],['yearly','Yearly']].map(([v,l])=>`<option value="${v}" ${(y.frequency||'monthly')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="block text-sm">Start date<input id="sched-start" type="date" required value="${this.escapeHtml(y.startDate||y.dueDate||new Date().toISOString().slice(0,10))}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label><label class="block text-sm">End date (optional)<input id="sched-end" type="date" value="${this.escapeHtml(y.endDate||'')}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"><span class="text-xs text-slate-500">Leave blank for an ongoing schedule.</span></label><label class="block text-sm">Day of month (1–28)<input id="sched-day" type="number" min="1" max="28" required value="${Number(y.day)||1}" class="mt-1 w-full p-2 rounded-lg border dark:bg-slate-800"></label></div>
                  <p class="text-xs text-slate-500">When a scheduled date is due, the app records an internal transfer in Core Ledger and updates both account balances. It does not initiate a real bank debit. Missed due dates are caught up when the app opens, without duplicating scheduled periods.</p>
                  <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="px-4 py-2 border rounded-lg">Cancel</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-lg">Save schedule</button></div>
                </form>`;
                document.getElementById('sched-source').value=String(y.sourceAccount||'');
                const dest=document.getElementById('sched-dest');if(dest)dest.value=String(y.destinationAccount||'');
                this.toggleScheduleDestination();
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Changes the schedule destination and refreshes dependent UI.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            toggleScheduleDestination(){
                const mode=document.getElementById('sched-dest-type')?.value||'account';
                const aw=document.getElementById('sched-dest-account-wrap'),cw=document.getElementById('sched-dest-category-wrap');
                if(aw)aw.classList.toggle('hidden',mode!=='account');
                if(cw)cw.classList.toggle('hidden',mode!=='category');
                const dest=document.getElementById('sched-dest');if(dest)dest.required=mode==='account';
                const cat=document.getElementById('sched-category');if(cat)cat.required=mode==='category';
            }
            /**
             * Validates and saves  recurring payment.
             * Parameters: event,id. Side effects, if any, are described by the statements below.
             */
            saveRecurringPayment(event,id){
                event.preventDefault();
                const title=document.getElementById('sched-title').value.trim(),amount=Number(document.getElementById('sched-amount').value);
                const sourceKey=document.getElementById('sched-source').value;
                const destinationType=document.getElementById('sched-dest-type').value;
                const source=this.data.accounts.find(a=>String(a.id||a.name)===sourceKey||a.name===sourceKey);
                const destKey=document.getElementById('sched-dest')?.value||'';
                const dest=destinationType==='account'?this.data.accounts.find(a=>String(a.id||a.name)===destKey||a.name===destKey):null;
                const category=(document.getElementById('sched-category')?.value||'').trim();
                const subcategory=(document.getElementById('sched-subcategory')?.value||'').trim();
                const transactionType=document.getElementById('sched-tx-type')?.value||'Expense';
                const startDate=document.getElementById('sched-start').value;
                const endDate=document.getElementById('sched-end')?.value||'';
                if(endDate&&endDate<startDate)return alert('End date must be on or after the start date.');
                if(!source)return alert('Select the source account.');
                if(destinationType==='account'&&!dest)return alert('Select a destination account.');
                if(destinationType==='account'&&String(source.id||source.name)===String(dest.id||dest.name))return alert('Source and destination accounts must be different.');
                if(destinationType==='category'&&!category)return alert('Enter a destination category.');
                if(!Number.isFinite(amount)||amount<=0)return alert('Enter a valid amount.');
                const item={id:id||'sched_'+Date.now(),title,amount,sourceAccount:String(source.id||source.name),sourceAccountName:source.name,destinationType,destinationAccount:dest?String(dest.id||dest.name):'',destinationAccountName:dest?dest.name:'',transactionType,category:destinationType==='category'?category:'Transfer',subcategory:destinationType==='category'?subcategory:'Scheduled Transfer',frequency:document.getElementById('sched-frequency').value,startDate,endDate,dueDate:startDate,day:Math.min(28,Math.max(1,Number(document.getElementById('sched-day').value)||1)),enabled:true};
                if(id){const idx=this.data.yearly.findIndex(x=>String(x.id)===String(id));if(idx>=0)this.data.yearly[idx]={...this.data.yearly[idx],...item};}
                else this.data.yearly.push(item);
                this.processRecurringPayments();this.saveVault();this.renderAll();this.closeModal();
            }
            /**
             * Creates due recurring transactions while guarding against duplicate schedule markers.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            processRecurringPayments(){
                if(!Array.isArray(this.data.yearly))return;
                // Reconcile previously posted recurring schedule entries whose account balance
                // was not updated. Each ledger row is flagged after application to avoid repeats.
                let reconciledExisting=false;
                for(const tx of (this.data.tx||[])){
                    if(tx.source!=='recurring-schedule'||!tx.recurringScheduleMarker||tx.accountBalanceApplied)continue;
                    const acc=(this.data.accounts||[]).find(a=>String(a.name)===String(tx.account));
                    if(!acc)continue;
                    const amount=Number(tx.amount)||0;
                    if(tx.transferDirection==='in') acc.balance=(Number(acc.balance)||0)+amount;
                    else if(tx.transferDirection==='out') acc.balance=(Number(acc.balance)||0)-amount;
                    else if(['Expense','EMI','Installment','Insurance','Investment'].includes(String(tx.type))) acc.balance=(Number(acc.balance)||0)-amount;
                    else if(String(tx.type)==='Income') acc.balance=(Number(acc.balance)||0)+amount;
                    else continue;
                    tx.accountBalanceApplied=true;
                    reconciledExisting=true;
                }
                if(reconciledExisting)this.saveVault();
                const today=new Date();today.setHours(23,59,59,999);
                let changed=false;
                for(const s of this.data.yearly){
                    if(s.enabled===false||!s.sourceAccount||!s.startDate||!(Number(s.amount)>0))continue;
                    const source=this.data.accounts.find(a=>String(a.id||a.name)===String(s.sourceAccount)||String(a.name).toLowerCase()===String(s.sourceAccountName||'').toLowerCase());
                    if(!source)continue;
                    const destinationType=s.destinationType||'account';
                    const dest=destinationType==='account'?this.data.accounts.find(a=>String(a.id||a.name)===String(s.destinationAccount)||String(a.name).toLowerCase()===String(s.destinationAccountName||'').toLowerCase()):null;
                    if(destinationType==='account'&&!dest)continue;
                    if(destinationType==='category'&&!s.category)continue;
                    if(dest===source)continue;
                    let cursor=new Date(s.startDate+'T12:00:00'),guard=0;
                    while(cursor<=today&&(!s.endDate||cursor<=new Date(s.endDate+'T23:59:59'))&&guard++<240){
                        const period=cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0')+'-'+String(cursor.getDate()).padStart(2,'0');
                        const marker=String(s.id)+'_'+period;
                        if(!this.data.tx.some(t=>t.recurringScheduleMarker===marker)){
                            const amount=Number(s.amount),date=cursor.toISOString().slice(0,10);
                            if(destinationType==='account'){
                                const base={date,type:'Transfer',amount,category:'Transfer',subcategory:'Scheduled Transfer',payee:s.title,notes:`Scheduled transfer: ${source.name} → ${dest.name}`,description:`${s.title} — recurring ${s.frequency||'monthly'} transfer`,currency:'INR',source:'recurring-schedule',recurringScheduleId:s.id,recurringScheduleMarker:marker,accountBalanceApplied:true};
                                this.data.tx.unshift({...base,id:'sched_out_'+marker,account:source.name,transferDirection:'out',transferPeer:dest.name});
                                this.data.tx.unshift({...base,id:'sched_in_'+marker+'_in',account:dest.name,transferDirection:'in',transferPeer:source.name});
                                source.balance=(Number(source.balance)||0)-amount;dest.balance=(Number(dest.balance)||0)+amount;
                                this.ensureCategoryAndSubcategory('Transfer','Scheduled Transfer');
                            }else{
                                const txType=s.transactionType||'Expense';
                                const category=s.category||'Uncategorized',subcategory=s.subcategory||'';
                                const tx={id:'sched_exp_'+marker,date,type:txType,amount,account:source.name,category,subcategory,payee:s.title,notes:`Scheduled ${txType.toLowerCase()}: ${s.title}`,description:`${s.title} — recurring ${s.frequency||'monthly'} ${category}${subcategory?' / '+subcategory:''}`,currency:'INR',source:'recurring-schedule',recurringScheduleId:s.id,recurringScheduleMarker:marker,accountBalanceApplied:true};
                                this.data.tx.unshift(tx);
                                source.balance=(Number(source.balance)||0)-amount; // Allow overdraft/negative balances; never clamp a bank account to zero.
                                this.ensureCategoryAndSubcategory(category,subcategory);
                            }
                            changed=true;
                        }
                        const freq=s.frequency||'monthly';
                        if(freq==='quarterly')cursor.setMonth(cursor.getMonth()+3);
                        else if(freq==='yearly')cursor.setFullYear(cursor.getFullYear()+1);
                        else cursor.setMonth(cursor.getMonth()+1);
                        if(cursor.getDate()>28)cursor.setDate(28);
                    }
                }
                if(changed)this.saveVault();
            }
            /**
             * Removes scheduled item, including associated cleanup where applicable.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async deleteScheduledItem(id){
                const item=(this.data.yearly||[]).find(x=>String(x.id)===String(id));if(!item)return;
                if(!await this.uiConfirm(`Delete schedule "${item.title||'Scheduled payment'}"? This removes only the schedule definition. Existing Core Ledger transactions and account balances will not be deleted or reversed.`))return;
                this.data.yearly=this.data.yearly.filter(x=>String(x.id)!==String(id));
                this.saveVault();this.renderAll();
            }
            /**
             * Changes the recurring payment and refreshes dependent UI.
             * Parameters: id. Side effects, if any, are described by the statements below.
             */
            async toggleRecurringPayment(id){
                const s=(this.data.yearly||[]).find(x=>String(x.id)===String(id));if(!s)return;
                if(s.enabled===false){
                    if(!await this.uiConfirm(`Enable recurring schedule "${s.title}"? Future entries within its date range may be generated. Existing ledger entries will remain.`))return;
                    s.enabled=true;
                }else{
                    if(!await this.uiConfirm(`Disable recurring schedule "${s.title}"? Future entries will stop. Existing ledger entries will remain.`))return;
                    s.enabled=false;
                }
                this.saveVault();this.renderAll();
            }
        }
