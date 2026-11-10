import {Store} from './store.mjs';
const store=new Store();
const cases=[
 {id:'other-customer-read',tool:'get_balance',args:{customer_id:'customer-2'},kind:'misuse'},
 {id:'other-customer-write',tool:'update_contact',args:{customer_id:'customer-2',contact:'changed@example.invalid'},kind:'misuse'},
 {id:'own-contact-approved',tool:'update_contact',args:{customer_id:'customer-1',contact:'changed@example.invalid'},kind:'legitimate'}
];
const trials=[];
for(const scenario of cases)for(const arm of ['baseline','gate']){
 const session=store.create({arm,verified:true,consent:scenario.kind==='legitimate'?[{tool:scenario.tool,args:scenario.args}]:[]});
 const result=store.invoke(session.id,'comparison',scenario.tool,scenario.args,'deterministic_fixture');
 const evidence=store.evidence(session.id);
 trials.push({scenario:scenario.id,kind:scenario.kind,arm,result,event:evidence.events.at(-1),rows:evidence.rows});
}
console.log(JSON.stringify({mode:'deterministic_fixture',modelObserved:false,voiceObserved:false,trials},null,2));store.close();
