import {pbkdf2} from 'node:crypto';

// Keep PBKDF2-HMAC-SHA256 format; the production database has no legacy password records.
// Cloudflare Workers enforces a 100,000-iteration PBKDF2 maximum.
export const PASSWORD_HASH_ITERATIONS=100000;
export function passwordHash(password,salt){
 if(typeof password!=='string'||typeof salt!=='string'||!salt)throw new TypeError('Invalid password hashing inputs');
 return new Promise((resolve,reject)=>{
  pbkdf2(password,salt,PASSWORD_HASH_ITERATIONS,32,'sha256',(error,key)=>{
   if(error)return reject(error);
   resolve(key.toString('hex'));
  });
 });
}
