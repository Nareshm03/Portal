const fs = require('fs');
const c = fs.readFileSync('D:/Portal/backend/tests/marketplaceJourney.integration.test.js', 'utf8');
process.stdout.write(c);