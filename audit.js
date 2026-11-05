const fs = require('fs');

// Check the migration for profiles table and kyc_status
const sql = fs.readFileSync('D:/Portal/backend/supabase/migrations/202611050001_portal_core.sql', 'utf8');
console.log('=== KYC STATUS ENUM ===');
const kycIdx = sql.indexOf('kyc_status');
if (kycIdx >= 0) {
  // Print the type definition and table columns
  const section = sql.substring(kycIdx, kycIdx + 200);
  console.log(section);
}
console.log('\n');

// Check the profiles table columns
console.log('=== PROFILES TABLE ===');
const profilesIdx = sql.indexOf('create table public.profiles');
if (profilesIdx >= 0) {
  const section = sql.substring(profilesIdx, profilesIdx + 400);
  console.log(section);
}
console.log('\n');

// Check the review_traveller_kyc RPC reference in api.js
const api = fs.readFileSync('D:/Portal/backend/src/routes/api.js', 'utf8');
const rpcIdx = api.indexOf('review_traveller_kyc');
if (rpcIdx >= 0) {
  console.log('=== review_traveller_kyc in api.js ===');
  const section = api.substring(rpcIdx - 20, rpcIdx + 100);
  console.log(section);
}
console.log('\n');

// Check seed script for KYC references
const seed = fs.readFileSync('D:/Portal/backend/scripts/seed_marketplace_demo.sql', 'utf8');
const seedIdx = seed.indexOf('kyc');
if (seedIdx >= 0) {
  console.log('=== KYC in seed script ===');
  const section = seed.substring(seedIdx, seedIdx + 300);
  console.log(section);
}
console.log('\n');

// Check upload service
const uploadsSvc = fs.readFileSync('D:/Portal/backend/src/services/uploads.js', 'utf8');
console.log('=== uploads service (first 1500 chars) ===');
console.log(uploadsSvc.substring(0, 1500));
"