'use strict';
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(base, 'untappd-atlas', 'assets', name), 'utf8');
const html = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Untappd Atlas — démonstration</title><style>body{margin:0;background:#e4e2dc;padding:12px} ' + read('dashboard.css') + '</style><div class="uat-app" data-config=\'{"api":"/wp-json/untappd-atlas/v1/","configured":false,"timezone":"Europe/Paris"}\'></div><script>' + read('core.js') + '</script><script>' + read('export.js') + '</script><script>' + read('dashboard.js') + '</script><script>document.querySelector("[data-action=demo]").click();</script></html>';
const target = process.argv[2] || path.join(base, 'preview.html');
fs.writeFileSync(target, html); console.log('Aperçu autonome généré : ' + target);
