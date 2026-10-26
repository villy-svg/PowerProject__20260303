// Read-only check of bank details against employees table (dhhb DB, from .env)
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const norm = s => (s ?? '').toString().replace(/\s+/g, ' ').trim().toUpperCase();
const rows = fs.readFileSync('scratch/bank_input.tsv', 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'));

const { count, error: cErr } = await sb.from('employees').select('id', { count: 'exact', head: true });
console.log('employees visible:', count, cErr?.message ?? '');

for (const [acc, name, ifsc] of rows) {
  const fmt = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase()) ? '' : ' BAD-IFSC-FORMAT';
  const { data, error } = await sb.from('employees')
    .select('full_name, emp_code, account_number, ifsc_code, account_name, status')
    .or(`account_number.eq.${acc},account_number.eq.${acc.replace(/^0+/, '')}`);
  if (error) { console.log(acc, 'ERROR', error.message); continue; }
  if (!data.length) { console.log(`${acc} | ${name} | ${ifsc} => NOT FOUND${fmt}`); continue; }
  for (const e of data) {
    const issues = [];
    if (e.account_number !== acc) issues.push(`acc stored=${e.account_number}`);
    if (norm(e.ifsc_code) !== norm(ifsc)) issues.push(`ifsc db=${e.ifsc_code}`);
    const n = norm(e.account_name || e.full_name);
    if (n !== norm(name)) issues.push(`name db=${e.account_name || e.full_name}`);
    console.log(`${acc} | ${name} | ${ifsc} => ${issues.length ? 'MISMATCH ' + issues.join('; ') : 'MATCH'} [${e.emp_code}, ${e.status}]${fmt}`);
  }
}
