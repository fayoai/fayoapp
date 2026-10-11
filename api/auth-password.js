import {pbkdf2} from 'node:crypto';

// Preserve the original PBKDF2-HMAC-SHA256 format for existing passwords.
export const PASSWORD_HASH_ITERATIONS=220000;
export function passwordHash(password,salt){
 if(typeof password!=='string'||typeof salt!=='string'||!salt)throw new TypeError('Invalid password hashing inputs');
 return new Promise((resolve,reject)=>{
  pbkdf2(password,salt,PASSWORD_HASH_ITERATIONS,32,'sha256',(error,key)=>{
   if(error)return reject(error);
   resolve(key.toString('hex'));
  });
 });
}
