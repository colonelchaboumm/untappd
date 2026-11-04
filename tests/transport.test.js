'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {UATExport: require('../untappd-atlas/assets/export.js')};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../untappd-atlas/assets/dashboard.js'), 'utf8'), {window, document: {querySelectorAll: () => []}});
const read = window.UATTransport.readResponse;

test('a WordPress critical-error HTML response becomes a useful plain message', async () => {
  const html = '<p>Il y a eu une erreur critique sur ce site.</p>';
  await assert.rejects(read({status: 500, ok: false, json: async () => JSON.parse(html)}), e => e.status === 500 && /journal PHP/.test(e.message) && !/<p>|JSON|permaliens/.test(e.message));
});

test('structured storage and quota errors preserve their message, status and retry time', async () => {
  await assert.rejects(read({status: 503, ok: false, json: async () => ({code: 'storage', message: 'Enregistrement impossible. Référence : abc.', data: {status: 503}})}), e => e.status === 503 && e.code === 'storage' && e.message.endsWith('abc.'));
  await assert.rejects(read({status: 429, ok: false, json: async () => ({code: 'quota', message: 'Quota atteint', data: {retry_at: 123456}})}), e => e.retryAt === 123456 && e.status === 429);
});

test('REST access failures and malformed success bodies are not treated as imported data', async () => {
  await assert.rejects(read({status: 403, ok: false, json: async () => {throw new Error('HTML');}}), e => e.status === 403 && /API REST/.test(e.message));
  for (const body of [null, true, '<p>critical</p>', []]) await assert.rejects(read({status: 200, ok: true, json: async () => body}), /illisible/);
  const data = {state: {phase: 'done'}, items: []};
  assert.equal(await read({status: 200, ok: true, json: async () => data}), data);
});
