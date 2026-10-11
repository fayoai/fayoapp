import test from 'node:test';
import assert from 'node:assert/strict';
import {companyInput} from './rawi-company.js';
const example={workspace_id:'11111111-1111-4111-8111-111111111111',logo_data:'',name:'Sample Company',address:'Business district, Riyadh',commercial_registration:'1010101010',tax_number:'300000000000003',phone:'920000000',mobile:'0500000000',website:'https://example.com',emails:'info@example.com',activity:'Consulting',description:'Business services'};
test('Company onboarding accepts valid requested details',()=>{
 assert.equal(companyInput.safeParse(example).success,true);
 assert.equal(companyInput.safeParse({...example,logo_data:'data:image/png;base64,'+Buffer.from('image').toString('base64')}).success,true);
});
test('Company onboarding rejects incomplete or invalid fields',()=>{
 for(const patch of [{name:''},{address:''},{activity:''},{phone:'',mobile:''},{logo_data:'data:text/html;base64,WA=='}]){
  assert.equal(companyInput.safeParse({...example,...patch}).success,false,JSON.stringify(patch));
 }
});
