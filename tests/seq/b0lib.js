// The B0 matching-key functions taken straight out of index.html (between /* b0key:start */ and /* b0key:end */), run in
// node with no app around them. keyProj / jobKey look for lsProjForCust / fuF / fuU: pass them in `extra` to test those.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const m = /\/\* b0key:start \*\/([\s\S]*?)\/\* b0key:end \*\//.exec(SRC);
if (!m) throw new Error('b0key block not found in index.html');
const NAMES = ['keyOdd', 'keyNorm', 'keyTxtD', 'keyUBase', 'keyTxt', 'keyCode', 'keyFloor', 'keyFloorStr', 'keyUnit', 'keyTitleBits', 'keyProj', 'keyOf', 'jobKey', 'seqRowKey', 'keyMatch', 'keyHouseStr', 'keyLineStr'];
function load(extra) {
  const ctx = vm.createContext(Object.assign({}, extra || {}));
  vm.runInContext(m[1] + '\n;globalThis.__b0={' + NAMES.join(',') + '};', ctx);
  return ctx.__b0;
}
module.exports = Object.assign(load(), { load, BLOCK: m[1], NAMES });
