// left.js
import * as right from './right.js';
console.info('right moduleId', right.moduleId);

let id = 0;  // 'var' here hoists var itself, but not initial value
export function getNextId() {
  console.info('ID being fetched');
  return ++id;
}

import './other.js';