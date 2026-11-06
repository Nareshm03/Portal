const fs = require('fs');
const c = fs.readFileSync('D:/Portal/backend/tests/marketplaceJourney.integration.test.js', 'utf8');
const regex = /test\(['"]/g;
const matches = c.match(regex);
console.log('Test count:', matches ? matches.length : 0);