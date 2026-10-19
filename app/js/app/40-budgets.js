// AificoApp methods: budgets (5 methods). Part of the AificoApp prototype chain.
        class AificoAppBudgets extends AificoAppAccounts {
            /**
             * Renders the  budgets UI from the current app state.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            renderBudgets() {
                const container = document.getElementById('budgets-container');
                const now = new Date();
                const month = now.getMonth();
                const year = now.getFullYear();
                // Use the salary explicitly configured in Set Monthly Salary as the income baseline.
                // Budget categories compare actual monthly expenses against their category limits.
                const takeHome = Number(this.data.salarySchedule?.amount) || Number(this.data.settings?.monthlyTakeHomeSalary) || 0;
                const budgetEntries = Object.entries(this.data.budgets || {});
                const totalBudget = budgetEntries.reduce((sum, [, limit]) => sum + (Number(limit) || 0), 0);
                const allocationPct = takeHome > 0 ? Math.round((totalBudget / takeHome) * 100) : null;
                const allocationBarPct = allocationPct === null ? 0 : Math.min(allocationPct, 100);
                const allocationLabel = takeHome > 0 ? `${allocationPct}%` : '—';
                const allocationTone = allocationPct !== null && allocationPct > 100 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200';
                const allocationBarTone = allocationPct !== null && allocationPct > 100 ? 'bg-rose-600' : 'bg-indigo-600';
                const allocationSummary = `
                    <div class="p-4 mb-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 space-y-2">
                        <div class="flex flex-wrap justify-between items-center gap-2">
                            <span class="font-semibold text-sm text-slate-800 dark:text-slate-100">Total budget allocation</span>
                            <span class="text-sm font-bold ${allocationTone}">₹${totalBudget.toLocaleString('en-IN')} / ₹${takeHome.toLocaleString('en-IN')} (${allocationLabel})</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div class="${allocationBarTone} h-2.5 rounded-full" style="width: ${allocationBarPct}%"></div>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300">This total can be 100% or higher if your combined category budgets equal or exceed take-home income. Each category compares this month's actual spending with its budget limit.</p>
                    </div>`;
                container.innerHTML = allocationSummary + budgetEntries.map(([cat, limit]) => {
                    const spent = this.countedTx().filter(t => {
                        if (t.category !== cat || !['Expense','EMI','Installment'].includes(t.type)) return false;
                        const d = new Date(t.date || t.timestamp || '');
                        return !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
                    }).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                    const budgetLimit = Number(limit) || 0;
                    // Category label shows how much of monthly take-home is allocated to this category.
                    // The progress bar remains a separate comparison of actual monthly spending vs this category budget.
                    const allocationCategoryPct = takeHome > 0 ? Math.round((budgetLimit / takeHome) * 100) : null;
                    const barPct = budgetLimit > 0 ? Math.min(Math.round((spent / budgetLimit) * 100), 100) : (spent > 0 ? 100 : 0);
                    // Headline figure is how much of this budget is used; the share of take-home sits underneath.
                    const usedPct = budgetLimit > 0 ? Math.round((spent / budgetLimit) * 100) : null;
                    const usedLabel = usedPct === null ? '' : usedPct > 100 ? `${usedPct}% used · over by ₹${(spent - budgetLimit).toLocaleString('en-IN')}` : `${usedPct}% used · ₹${(budgetLimit - spent).toLocaleString('en-IN')} left`;
                    const usedTone = usedPct > 100 ? 'text-rose-600 dark:text-rose-400' : usedPct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400';
                    const barTone = usedPct > 100 ? 'bg-rose-600' : usedPct >= 80 ? 'bg-amber-500' : 'bg-emerald-600';
                    return `
                        <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div class="flex flex-wrap justify-between items-center text-sm font-medium gap-3">
                                <span>${this.escapeHtml(cat)}</span>
                                <div class="flex flex-wrap items-center justify-end gap-3">
                                    <span class="text-right">₹${spent.toLocaleString('en-IN')} / ₹${budgetLimit.toLocaleString('en-IN')}</span>
                                    <button type="button" onclick='app.editBudget(${JSON.stringify(cat)})' class="text-xs text-blue-600 hover:underline">Edit</button>
                                    <button type="button" onclick='app.deleteBudget(${JSON.stringify(cat)})' class="text-xs text-rose-600 hover:underline">Delete</button>
                                </div>
                            </div>
                            <div class="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                                <div class="${barTone} h-2.5 rounded-full" style="width: ${barPct}%"></div>
                            </div>
                            <div class="flex flex-wrap justify-between gap-2 text-xs"><span class="${usedTone}">${usedLabel}</span>${allocationCategoryPct === null ? '' : `<span class="text-slate-500 dark:text-slate-400">${allocationCategoryPct}% of take-home</span>`}</div>
                        </div>
                    `;
                }).join('');
            }

            /**
             * Opens the  budget modal screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            openBudgetModal() { this.showSimpleForm('Set Monthly Budget', [['category','Category','select:'+this.data.categories.join(',')],['amount','Monthly limit (₹)','number']], values=>{if(Number(values.amount)<=0)return alert('Budget must be greater than zero.');this.data.budgets[values.category]=Number(values.amount);this.saveVault();this.renderAll();this.closeModal();}); }
            /**
             * Updates budget.
             * Parameters: category. Side effects, if any, are described by the statements below.
             */
            editBudget(category) {
                if(!Object.prototype.hasOwnProperty.call(this.data.budgets||{},category))return;
                const box=document.getElementById('modal-box');
                const categories=[...new Set([...(this.data.categories||[]),category])];
                box.innerHTML=`<div class="flex items-center justify-between border-b pb-3"><h3 class="font-bold text-lg">Edit Budget</h3><button type="button" onclick="app.closeModal()">✕</button></div>
                <form class="space-y-4 pt-3" onsubmit="app.saveEditedBudget(event,${JSON.stringify(category)})">
                  <label class="block text-sm font-medium">Category<select id="budget-edit-category" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800">${categories.map(c=>`<option value="${this.escapeHtml(c)}" ${c===category?'selected':''}>${this.escapeHtml(c)}</option>`).join('')}</select></label>
                  <label class="block text-sm font-medium">Monthly budget (₹)<input id="budget-edit-amount" type="number" min="0.01" step="0.01" required value="${Number(this.data.budgets[category])||0}" class="mt-1 w-full px-3 py-2 rounded-xl border dark:bg-slate-800"></label>
                  <div class="flex justify-end gap-2"><button type="button" onclick="app.closeModal()" class="px-3 py-2 rounded-lg border">Cancel</button><button type="submit" class="px-4 py-2 rounded-lg bg-emerald-600 text-white">Save Budget</button></div>
                </form>`;
                document.getElementById('modal-container').classList.remove('hidden');
            }
            /**
             * Validates and saves  edited budget.
             * Parameters: event,oldCategory. Side effects, if any, are described by the statements below.
             */
            saveEditedBudget(event,oldCategory) {
                event.preventDefault();
                const newCategory=document.getElementById('budget-edit-category').value;
                const amount=Number(document.getElementById('budget-edit-amount').value);
                if(!Number.isFinite(amount)||amount<=0)return alert('Budget must be greater than zero.');
                if(newCategory!==oldCategory&&Object.prototype.hasOwnProperty.call(this.data.budgets,newCategory))return alert('A budget already exists for this category. Choose that category and edit its amount instead.');
                delete this.data.budgets[oldCategory];this.data.budgets[newCategory]=amount;
                this.saveVault();this.renderAll();this.closeModal();
            }
            /**
             * Removes budget, including associated cleanup where applicable.
             * Parameters: category. Side effects, if any, are described by the statements below.
             */
            async deleteBudget(category) {
                if(!Object.prototype.hasOwnProperty.call(this.data.budgets||{},category))return;
                if(!await this.uiConfirm(`Delete the budget for "${category}"? Transactions and category history will not be deleted.`))return;
                delete this.data.budgets[category];this.saveVault();this.renderAll();
            }
        }
