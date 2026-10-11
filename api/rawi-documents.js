import {z} from 'zod';

// Files are supplied to the model for this request, never stored as tenant records.
export const documentMimes=Object.freeze({
 pdf:'application/pdf',
 doc:'application/msword',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:'application/vnd.ms-excel',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 ppt:'application/vnd.ms-powerpoint',
 pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 txt:'text/plain',
 md:'text/markdown',
 csv:'text/csv',
 json:'application/json',
 rtf:'application/rtf'
});
export const MAX_DOCUMENT_BYTES=1572864; // 1.5 MiB each
export const MAX_DOCUMENT_TOTAL_BYTES=2621440; // 2.5 MiB per request
export const MAX_DOCUMENT_COUNT=2;
const byteLength=data=>{
 const encoded=data.slice(data.indexOf(',')+1);
 return Math.floor(encoded.length*3/4)-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0);
};
export const documentSchema=z.object({
 name:z.string().trim().min(1).max(120),
 mime_type:z.string().min(3).max(120),
 data:z.string().min(20).max(2100000)
}).superRefine((value,ctx)=>{
 const extension=value.name.split('.').pop()?.toLowerCase();
 const mime=documentMimes[extension];
 if(!mime||value.mime_type!==mime||!value.data.startsWith('data:'+mime+';base64,')){
  ctx.addIssue({code:'custom',message:'Unsupported document format'});return;
 }
 const encoded=value.data.slice(value.data.indexOf(',')+1);
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||byteLength(value.data)>MAX_DOCUMENT_BYTES){
  ctx.addIssue({code:'custom',message:'Invalid or oversized document'});
 }
});
export const documentsSchema=z.array(documentSchema).max(MAX_DOCUMENT_COUNT).refine(
 documents=>documents.reduce((total,d)=>total+byteLength(d.data),0)<=MAX_DOCUMENT_TOTAL_BYTES,
 'Combined attachments exceed the allowed size'
);
