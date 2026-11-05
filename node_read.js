const fs = require('fs');
const api = fs.readFileSync('D:/Portal/backend/src/routes/api.js', 'utf8');
const lines = api.split('\n');

// KYC SUBMIT (lines 444-452)
console.log('=== KYC SUBMIT (444-452) ===');
for (let i = 443; i < 453; i++) {
  console.log((i + 1) + ': ' + lines[i].trim());
}
console.log();

// Admin KYC review (lines 559-565)
console.log('=== ADMIN KYC REVIEW (559-565) ===');
for (let i = 558; i < 566; i++) {
  console.log((i + 1) + ': ' + lines[i].trim());
}
console.log();

// Duty assessment
console.log('=== DUTY ASSESSMENT SEARCH ===');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("duty-assessment") || lines[i].includes("duty_assessment_status")) {
    console.log((i + 1) + ': ' + lines[i].trim().substring(0, 100));
  }
}