import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG LOGS - Check your browser console for these!
console.log("--- Supabase Env Debug ---");
console.log("URL exists:", !!supabaseUrl);
console.log("Key exists:", !!supabaseAnonKey);
console.log("All Vite Env:", import.meta.env);
console.log("--------------------------");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase credentials are missing! Check .env naming and restart your dev server.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);