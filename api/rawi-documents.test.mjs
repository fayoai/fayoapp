import test from 'node:test';
import assert from 'node:assert/strict';
import {documentsSchema,documentMimes,MAX_DOCUMENT_BYTES,MAX_DOCUMENT_TOTAL_BYTES} from './rawi-documents.js';
const encode=(name,mime=documentMimes[name.split('.').pop()],data=Buffer.from('hi'))=>({name,mime_type:mime,data:'data:'+mime+';base64,'+data.toString('base64')});
test('PDF Word Excel and text attachments are supported as request-only documents',()=>{
 for(const name of ['record.pdf','draft.docx','sheet.xlsx','text.txt','table.csv','notes.md','data.json'])assert.equal(documentsSchema.safeParse([encode(name)]).success,true,name);
});
test('Documents reject traversal, mismatched MIME, unsupported executable types and invalid base64',()=>{
 assert.equal(documentsSchema.safeParse([encode('evil.exe','application/pdf')]).success,false);
 assert.equal(documentsSchema.safeParse([encode('report.pdf','text/plain')]).success,false);
 assert.equal(documentsSchema.safeParse([encode('../report.pdf')]).success,false);
 assert.equal(documentsSchema.safeParse([{name:'report.pdf',mime_type:'application/pdf',data:'data:application/pdf;base64,***'}]).success,false);
 assert.equal(documentsSchema.safeParse([encode('one.pdf'),encode('two.pdf'),encode('three.pdf')]).success,false);
});
test('Document request is bounded by per-file and combined size limits',()=>{
 assert.equal(documentsSchema.safeParse([encode('large.pdf',undefined,Buffer.alloc(MAX_DOCUMENT_BYTES+1))]).success,false);
 const size=Math.floor(MAX_DOCUMENT_TOTAL_BYTES/2)+5;
 assert.equal(documentsSchema.safeParse([encode('a.pdf',undefined,Buffer.alloc(size)),encode('b.pdf',undefined,Buffer.alloc(size))]).success,false);
});
