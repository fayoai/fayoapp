import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Unverified signup must not create a session or workspace',()=>{
 const api=read('api/app.js');
 const signUp=api.slice(api.indexOf("app.post('/api/admin/register'"),api.indexOf("app.post('/api/admin/verify-email'"));
 assert.match(signUp,/deliverVerificationCode/);
 assert.match(signUp,/rawi_pending_signups/);
 assert.doesNotMatch(signUp,/setCookie|INSERT INTO admins|createNeonTenantDatabase/);
 assert.match(api,/company_setup_required:true/);
 assert.match(api,/Complete your company profile first/);
});
test('Company fields and inline send button are present in the responsive onboarding',()=>{
 const ui=read('src/MifSmartShell.jsx');
 for(const part of ['verificationCode','confirmEmail','resendCode','signupStep','submitCompany','selectCompanyLogo'])assert.ok(ui.includes(part));
 for(const field of ['logo_data','name','address','commercial_registration','tax_number','phone','mobile','website','emails','activity','description'])assert.ok(ui.includes('company.'+field),field);
 const form=ui.slice(ui.indexOf('<form className="mif-composer"'),ui.indexOf('</form>',ui.indexOf('<form className="mif-composer"')));
 assert.ok(form.indexOf('rawi-composer-toolbar')>=0);
 assert.ok(form.indexOf('rawi-composer-toolbar')<form.indexOf('className="rawi-send"'));
});
