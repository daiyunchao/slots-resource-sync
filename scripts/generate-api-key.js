#!/usr/bin/env node

import crypto from 'crypto';

console.log('\n🔐 生成安全的API Key\n');
console.log('─'.repeat(60));

// 生成16位字母数字组合
function generate16CharKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  const randomBytes = crypto.randomBytes(16);

  for (let i = 0; i < 16; i++) {
    key += chars[randomBytes[i] % chars.length];
  }

  return key;
}

// 生成32字节hex（更安全，64字符）
const longKey = crypto.randomBytes(32).toString('hex');

// 生成16位字母数字组合
const shortKey = generate16CharKey();

console.log('\n✅ 推荐使用（16位字母数字组合）:');
console.log(`\nAPI_KEY=${shortKey}`);

console.log('\n\n或者更安全的64字符版本:');
console.log(`\nAPI_KEY=${longKey}`);

console.log('\n\n请将上面的任一API_KEY复制到 .env 文件中');
console.log('─'.repeat(60));
console.log('\n📝 提示：');
console.log('1. 这个Key是固定的，生成一次即可');
console.log('2. 每次请求时在Header中携带: X-API-Key: ' + shortKey);
console.log('3. 不要分享这个Key给任何人');
console.log('4. 不要提交到Git仓库');
console.log('5. 定期更换API Key（如每3个月）');
console.log('');
