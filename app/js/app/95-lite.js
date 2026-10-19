// Lite edition: edition settings, stubs for removed Pro features, and shared date helpers.
        class AificoAppLite extends AificoAppBackup {
            // Everything Lite ships is fully available, so nothing is locked behind a Pro gate.
            isPro(){ return true; }
            isDeveloper(){ return false; }
            editionName(){ return 'Lite'; }
            // Removed features: keep data from Pro backups untouched, show and post nothing.
            isCardType(){ return false; }
            cardBadge(){ return ''; }
            cardStatements(){ return { statements: [], status: new Map() }; }
            cardAccountSummary(){ return ''; }
            computeCardStatusMap(){ this.cardStatusMap = new Map(); return this.cardStatusMap; }
            reconBadge(){ return ''; }
            renderReconSettings(){}
            renderInterestPlans(){}
            processInterestPlans(){ return false; }
            renderProjects(){}
            /**
             * Formats or safely prepares ledger date for display.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            formatLedgerDate(value) {
                if (!value) return '';
                const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
            }
            /**
             * Parses or imports ledger date and validates it before use.
             * Parameters: value. Side effects, if any, are described by the statements below.
             */
            parseLedgerDate(value) {
                if (typeof value === 'number' && window.XLSX && XLSX.SSF) {
                    const d=XLSX.SSF.parse_date_code(value); if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
                }
                const v=String(value??'').trim(); if(!v) return '';
                let m=v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
                if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
                m=v.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}`;
                const d=new Date(v); return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }
        }