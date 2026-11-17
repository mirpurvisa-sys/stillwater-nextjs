export type Member={id:string;email:string;role:string;case_id:string};
export const staff=(m:Member)=>['admin','coordinator'].includes(m.role);
export const kinds=['case','enquiry','consultation','memorial','tribute','rsvp','task','event','document','message','invoice','service','package','article','location','team','settings','flower'];
const shared=['settings','service','package','article','location','team'];
export function canRead(m:Member,r:{kind:string;case_id:string}){if(m.role==='disabled')return false;if(staff(m))return true;if(m.role==='finance')return ['invoice','case'].includes(r.kind);return shared.includes(r.kind)||!!m.case_id&&r.case_id===m.case_id;}
export function canWrite(m:Member,kind:string,caseId:string){if(m.role==='disabled')return false;if(m.role==='admin')return true;if(m.role==='coordinator')return !['settings','team'].includes(kind);if(m.role==='finance')return kind==='invoice';return !!m.case_id&&caseId===m.case_id&&['memorial','tribute','task','rsvp','document','message'].includes(kind);}
export function safeURL(value:unknown){return typeof value==='string'&&/^https?:\/\//i.test(value)?value:''}
