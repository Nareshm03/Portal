const fs = require('fs');
const c = fs.readFileSync('D:/Portal/backend/tests/routes/apiRoutes.test.js', 'utf8');
const regex = /test\(['"]([^'"]+)['"]/g;
const tests = [];
let m;
while ((m = regex.exec(c)) !== null) {
  tests.push(m[1]);
}
console.log('Found', tests.length, 'tests');
tests.slice(0, 40).forEach(t => console.log(t));