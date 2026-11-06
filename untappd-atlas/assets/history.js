(function () {
  'use strict';

  function entries(items) {
    const occurrences = new Map();
    return items.map(row => {
      if (!row.synthetic) return {key: 'id:' + row.id, row};
      const identity = JSON.stringify([row.date, row.beer, row.brewery]);
      const count = (occurrences.get(identity) || 0) + 1;
      occurrences.set(identity, count);
      return {key: 'date:' + identity + ':' + count, row};
    });
  }

  function connect(endpoint, nonce) {
    async function request(method, data, after) {
      const url = new URL(endpoint, window.location.href);
      if (after) url.searchParams.set('after', after);
      const response = await fetch(url, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: {'X-WP-Nonce': nonce, ...(data ? {'Content-Type': 'application/json'} : {})},
        ...(data ? {body: JSON.stringify(data)} : {})
      });
      return window.UATTransport.readResponse(response);
    }
    async function read(add) {
      let after;
      do {
        const result = await request('GET', null, after);
        add(result.entries);
        after = result.next;
      } while (after);
    }
    async function save(rows, add) {
      for (let i = 0; i < rows.length; i += 40) {
        const result = await request('POST', {entries: rows.slice(i, i + 40)});
        add(result.entries);
      }
    }
    return {read, save, erase: () => request('DELETE')};
  }

  // Only a visitor who follows an account link stages an import in this browser.
  function temporary(mode, operation) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('untappd-atlas', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('account-transfer');
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Stockage local indisponible.'));
      open.onsuccess = () => {
        const db = open.result;
        try {
          const transaction = db.transaction('account-transfer', mode);
          const request = operation(transaction.objectStore('account-transfer'));
          transaction.oncomplete = () => { db.close(); resolve(request.result); };
          transaction.onabort = () => { db.close(); reject(transaction.error); };
        } catch (error) { db.close(); reject(error); }
      };
    });
  }

  function discard() {
    return temporary('readwrite', store => store.delete('pending'));
  }
  function stage(rows) {
    return temporary('readwrite', store => store.put({rows, expires: Date.now() + 86400000}, 'pending'));
  }
  async function pending() {
    const entry = await temporary('readonly', store => store.get('pending'));
    if (!entry) return null;
    if (entry.expires <= Date.now()) { await discard(); return null; }
    return entry.rows;
  }

  window.UATHistory = {entries, connect, stage, pending, discard};
})();
