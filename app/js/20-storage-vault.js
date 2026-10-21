        // Persistent encrypted-vault storage: IndexedDB primary, legacy localStorage migration/fallback.
        // Existing data is copied only when the IndexedDB key is absent; no automatic overwrite/reset occurs.
        /*
         * AIFICO LEDGER — SOURCE GUIDE
         * This file is the v1.2610.84 working baseline. Comments document intent;
         * executable statements, formulas, data structures, and UI behavior are unchanged.
         * Data is held in the app model and persisted through the storage/vault layer.
         * Financial calculations are documented near their implementation below.
         */
        class AificoStorage {
            /**
             * Handles the constructor workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            constructor() { this.dbPromise = null; this.mode = 'IndexedDB'; }
            /**
             * Opens the requested screen, dialog, or workflow.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            open() {
                if (this.dbPromise) return this.dbPromise;
                this.dbPromise = new Promise((resolve, reject) => {
                    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is unavailable in this browser context.'));
                    const req = indexedDB.open('aifico_money_manager_storage', 1);
                    req.onupgradeneeded = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error || new Error('Could not open IndexedDB.'));
                    req.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open app tab. Close other AIFICO tabs and retry.'));
                });
                return this.dbPromise;
            }
            /**
             * Creates or opens the IndexedDB object store used for durable local data.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async ensurePersistentStore() {
                // Explicitly initialize/open IndexedDB before login, restore, or new-vault setup.
                // Opening creates the database and kv object store when they do not yet exist.
                const db = await this.open();
                if (!db.objectStoreNames.contains('kv')) {
                    this.dbPromise = null;
                    throw new Error('AIFICO persistent database opened without its kv store. Close other AIFICO tabs and reload before continuing.');
                }
                const tx = db.transaction('kv', 'readonly');
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Persistent database readiness check failed.'));
                    tx.objectStore('kv').get('__aifico_storage_ready_check__');
                });
                this.mode = 'IndexedDB';
                return true;
            }
            /**
             * Reads one value from IndexedDB by key.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            async idbGet(key) {
                const db = await this.open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('kv', 'readonly');
                    const req = tx.objectStore('kv').get(key);
                    req.onsuccess = () => resolve(req.result ? req.result.value : null);
                    req.onerror = () => reject(req.error || new Error('IndexedDB read failed.'));
                });
            }
            /**
             * Writes one value to IndexedDB and waits for the write result.
             * Parameters: key, value. Side effects, if any, are described by the statements below.
             */
            async idbSet(key, value) {
                const db = await this.open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('kv', 'readwrite');
                    tx.objectStore('kv').put({ key, value });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB write failed.'));
                });
            }
            /**
             * Deletes one keyed value from IndexedDB.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            async idbRemove(key) {
                const db = await this.open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction('kv', 'readwrite');
                    tx.objectStore('kv').delete(key);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB delete failed.'));
                });
            }
            /**
             * Reads saved data, including compatibility handling for legacy storage.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            async getItem(key) {
                try {
                    const value = await this.idbGet(key);
                    if (value !== null && value !== undefined) return value;
                    // One-way, non-destructive migration of the legacy encrypted vault.
                    let legacy = null;
                    try { legacy = localStorage.getItem(key); } catch (_) {}
                    if (legacy !== null) {
                        await this.idbSet(key, legacy);
                        return legacy;
                    }
                    return null;
                } catch (err) {
                    this.mode = 'localStorage fallback';
                    try { return localStorage.getItem(key); }
                    catch (_) { throw new Error('Persistent storage is unavailable. Your data was not changed. ' + (err?.message || '')); }
                }
            }
            /**
             * Persists data using the app storage strategy; errors are surfaced instead of silently discarding changes.
             * Parameters: key, value. Side effects, if any, are described by the statements below.
             */
            async setItem(key, value) {
                // Only use localStorage fallback if the IndexedDB write itself fails. If an IDB write
                // committed but read-back verification fails, stop rather than create two conflicting copies.
                let idbWriteCommitted = false;
                try {
                    await this.idbSet(key, value);
                    idbWriteCommitted = true;
                } catch (idbError) {
                    try {
                        localStorage.setItem(key, value);
                        if (localStorage.getItem(key) !== value) throw new Error('localStorage read-back verification failed.');
                        this.mode = 'localStorage fallback';
                        return true;
                    } catch (legacyError) {
                        throw new Error('Could not save and verify data in IndexedDB or localStorage. ' + (idbError?.message || '') + ' ' + (legacyError?.message || ''));
                    }
                }
                if (idbWriteCommitted) {
                    const committed = await this.idbGet(key);
                    if (committed !== value) throw new Error('IndexedDB write committed but read-back verification failed. Save status is uncertain; do not reset or restore until the vault is checked.');
                }
                this.mode = 'IndexedDB';
                try { localStorage.setItem(key, value); } catch (mirrorError) { console.warn('Legacy localStorage mirror skipped; IndexedDB save was verified.', mirrorError); }
                return true;
            }
            /**
             * Removes a stored key using the active storage strategy.
             * Parameters: key. Side effects, if any, are described by the statements below.
             */
            async removeItem(key) {
                // Never claim deletion succeeded if IndexedDB could not be checked: a stale IDB vault
                // could otherwise reappear on the next launch after localStorage had been cleared.
                let idbAvailable = true;
                try {
                    await this.idbRemove(key);
                    const idbValue = await this.idbGet(key);
                    if (idbValue !== null && idbValue !== undefined) throw new Error('The IndexedDB record still exists after deletion.');
                } catch (e) {
                    idbAvailable = false;
                    // Only permit localStorage-only deletion when IndexedDB itself cannot be opened.
                    if (this.dbPromise) this.dbPromise = null;
                    try { await this.open(); idbAvailable = true; } catch (_) { idbAvailable = false; }
                    if (idbAvailable) throw new Error('Could not safely verify deletion from IndexedDB. ' + (e?.message || ''));
                }
                try { localStorage.removeItem(key); } catch (e) {
                    if (idbAvailable) throw new Error('IndexedDB record was removed, but the legacy storage mirror could not be cleared.');
                }
                let legacyValue = null;
                try { legacyValue = localStorage.getItem(key); } catch (_) {}
                if (legacyValue !== null) throw new Error('Could not verify removal from the legacy storage mirror.');
                return true;
            }
            /**
             * Removes vault data, including associated cleanup where applicable.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async removeVaultData() {
                // Reset only vault-related browser records. Downloaded backup files are outside browser storage and are never touched.
                const isVaultKey = key => key === 'aifico_vault' || String(key).startsWith('aifico_vault_pre_restore_');
                let idbVerified = false;
                try {
                    const db = await this.open();
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction('kv', 'readwrite');
                        const store = tx.objectStore('kv');
                        const req = store.getAllKeys();
                        req.onsuccess = () => {
                            for (const key of req.result || []) if (isVaultKey(key)) store.delete(key);
                        };
                        req.onerror = () => reject(req.error || new Error('Could not enumerate vault storage keys.'));
                        tx.oncomplete = resolve;
                        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not clear vault storage records.'));
                    });
                    const keys = await new Promise((resolve, reject) => {
                        const tx = db.transaction('kv', 'readonly');
                        const req = tx.objectStore('kv').getAllKeys();
                        req.onsuccess = () => resolve(req.result || []);
                        req.onerror = () => reject(req.error || new Error('Could not verify vault cleanup.'));
                    });
                    if (keys.some(isVaultKey)) throw new Error('Vault-related records remain in IndexedDB after reset.');
                    idbVerified = true;
                } catch (e) {
                    // Do not report a successful reset if IndexedDB is available but could not be verified.
                    if (this.dbPromise) {
                        this.dbPromise = null;
                        try { await this.open(); } catch (_) {}
                        if (this.dbPromise) throw new Error('IndexedDB cleanup could not be verified; reset stopped to avoid leaving stale vault data. ' + (e?.message || ''));
                    }
                }
                try {
                    const keys = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (isVaultKey(key)) keys.push(key);
                    }
                    for (const key of keys) localStorage.removeItem(key);
                    for (let i = 0; i < localStorage.length; i++) {
                        if (isVaultKey(localStorage.key(i))) throw new Error('Vault-related records remain in localStorage after reset.');
                    }
                } catch (e) {
                    if (idbVerified) throw new Error('IndexedDB was cleared, but legacy localStorage cleanup could not be verified. ' + (e?.message || ''));
                    throw new Error('Could not verify browser storage cleanup. ' + (e?.message || ''));
                }
                return true;
            }

            /**
             * Handles the request persistent storage workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            async requestPersistentStorage() {
                try {
                    if (navigator.storage && navigator.storage.persist) {
                        const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
                        if (already) return true;
                        return await navigator.storage.persist();
                    }
                } catch (e) { console.warn('Persistent storage request was not granted:', e); }
                return false;
            }
        }

        class AificoVault {
            /**
             * Handles the constructor workflow. See the implementation below for its inputs, state changes, and side effects.
             * Parameters: none. Side effects, if any, are described by the statements below.
             */
            constructor() {
                this.salt = null;
                this.key = null;
                this.iv = null;
            }

            /**
             * Derives a cryptographic key from the password and salt for vault encryption.
             * Parameters: password, salt. Side effects, if any, are described by the statements below.
             */
            async deriveKey(password, salt) {
                const enc = new TextEncoder();
                const keyMaterial = await window.crypto.subtle.importKey(
                    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
                );
                return window.crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt: salt, iterations: 600000, hash: "SHA-256" },
                    keyMaterial,
                    { name: "AES-GCM", length: 256 },
                    false,
                    ["encrypt", "decrypt"]
                );
            }

            /**
             * Encrypts a data object before it is stored or exported.
             * Parameters: dataObject, password. Side effects, if any, are described by the statements below.
             */
            async encryptData(dataObject, password) {
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const iv = window.crypto.getRandomValues(new Uint8Array(12));
                const key = await this.deriveKey(password, salt);
                const enc = new TextEncoder();
                const encoded = enc.encode(JSON.stringify(dataObject));
                const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
                
                return JSON.stringify({
                    salt: Array.from(salt),
                    iv: Array.from(iv),
                    ciphertext: Array.from(new Uint8Array(ciphertext))
                });
            }

            /**
             * Decrypts a vault payload and returns its data object after authentication.
             * Parameters: encryptedJsonStr, password. Side effects, if any, are described by the statements below.
             */
            async decryptData(encryptedJsonStr, password) {
                const payload = JSON.parse(encryptedJsonStr);
                const salt = new Uint8Array(payload.salt);
                const iv = new Uint8Array(payload.iv);
                const ciphertext = new Uint8Array(payload.ciphertext);
                const key = await this.deriveKey(password, salt);
                
                const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
                const dec = new TextDecoder();
                return JSON.parse(dec.decode(decrypted));
            }
        }
