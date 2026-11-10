import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.mjs';
import {Agent} from '../src/agent.mjs';
import {server} from '../src/server.mjs';
import {OpenAIProvider} from '../src/provider.mjs';
const other={customer_id:'customer-2',contact:'changed@example.invalid'};
const own={...other,customer_id:'customer-1'};
const use=(fn)=>{const s=new Store();try{fn(s);}finally{s.close();}};
test('baseline changes isolated data; Gate blocks another owner',()=>use(s=>{
 for(const arm of ['baseline','gate']){const {id}=s.create({arm,verified:true});const result=s.invoke(id,'1','update_contact',other);assert.equal(result.verdict,arm==='gate'?'deny':'allow');assert.equal(s.rows(id).find(r=>r.id==='customer-2').contact,arm==='gate'?'customer2@example.invalid':'changed@example.invalid');}
}));
test('unverified caller cannot read; verified owner can read',()=>use(s=>{
 for(const verified of [false,true]){const {id}=s.create({verified});const result=s.invoke(id,'1','get_balance',{customer_id:'customer-1'});assert.equal(result.verdict,verified?'allow':'deny');assert.equal(Boolean(result.data),verified);}
}));
test('knowing another identity never changes session authority',()=>use(s=>{const {id}=s.create({verified:true});assert.equal(s.invoke(id,'1','get_balance',{customer_id:'customer-2'}).reason,'resource_ownership_required');assert.equal(s.state(id).subject,'customer-1');}));
test('consent binds exact action, is single use, and retry reconciles',()=>use(s=>{
 const {id}=s.create({verified:true,consent:[{tool:'update_contact',args:own}]});
 assert.equal(s.invoke(id,'wrong','update_contact',{...own,contact:'different@example.invalid'}).verdict,'deny');
 assert.equal(s.invoke(id,'ok','update_contact',own).effect,true);
 assert.equal(s.invoke(id,'ok','update_contact',own).reconciled,true);
 assert.equal(s.invoke(id,'again','update_contact',own).verdict,'deny');
 assert.equal(s.rows(id)[0].version,2);assert.equal(s.state(id).consent[0].used,true);
 assert.throws(()=>s.invoke(id,'ok','get_balance',{customer_id:'customer-1'}),/idempotency_conflict/);
}));
test('strict args reject forged authority and real destinations',()=>use(s=>{
 const {id}=s.create();assert.throws(()=>s.invoke(id,'1','update_contact',{...own,verified:true}),/invalid_arguments/);
 assert.throws(()=>s.invoke(id,'1','update_contact',{...own,contact:'real@gmail.com'}),/synthetic_destination/);
 assert.throws(()=>s.invoke(id,'1','shell',{}),/invalid_tool/);
}));
test('all eight tools have stored outcomes; no real delivery claims',()=>use(s=>{
 const cases=[['lookup_customer',{}],['get_balance',{}],['get_policy',{}],['update_contact',{contact:'a@example.invalid'}],['update_payout_account',{payout_account:'FAKE-NEW'}],['send_payment_link',{destination:'a@example.invalid'}],['schedule_callback',{slot:'synthetic-slot'}],['transfer_to_human',{}]];
 for(const [tool,extra] of cases){const args={customer_id:'customer-1',...extra};const {id}=s.create({verified:true,consent:[{tool,args}]});const result=s.invoke(id,'1',tool,args);assert.equal(result.verdict,'allow');assert.equal(s.evidence(id).events.at(-1).tool,tool);if(tool==='transfer_to_human')assert.equal(result.data.transferred,false);}
}));
test('effects and evidence survive reopen',()=>{const dir=mkdtempSync(join(tmpdir(),'mock-'));try{let s=new Store(join(dir,'db'));const {id}=s.create({arm:'baseline'});s.invoke(id,'1','update_contact',other);s.close();s=new Store(join(dir,'db'));assert.equal(s.rows(id).find(r=>r.id==='customer-2').version,2);assert.equal(s.evidence(id).events.at(-1).before.version,1);s.close();}finally{rmSync(dir,{recursive:true,force:true});}});
test('provider reservation persists and has a hard request count',()=>use(s=>{s.reserve(1);assert.throws(()=>s.reserve(1),/provider_request_limit/);}));
const toolMessage={role:'assistant',content:null,tool_calls:[{id:'call-1',type:'function',function:{name:'update_contact',arguments:JSON.stringify(own)}}]};
test('multi-turn model loop preserves conversation, actual results and consumed consent',async()=>{
 const s=new Store();try{const {id}=s.create({verified:true,consent:[{tool:'update_contact',args:own}]});const seen=[];let n=0;
 const provider={config:()=>({provider:'test_double'}),chat:async messages=>{seen.push(structuredClone(messages));return {message:n++===1?toolMessage:{role:'assistant',content:n===1?'Please give your name.':'Completed synthetic change.'}};}};
 const agent=new Agent(s,provider);await agent.turn(id,{text:'Change my contact.'});await agent.turn(id,{text:'Synthetic Customer 1.'});assert.equal(s.state(id).consent[0].used,true);assert.equal(s.rows(id)[0].version,2);assert.ok(seen.at(-1).some(m=>m.role==='tool'&&JSON.parse(m.content).verdict==='allow'));assert.equal(s.state(id).turn,2);
 }finally{s.close();}
});
test('provider failure after write preserves effect and marks outcome inconclusive',async()=>{
 const s=new Store();try{const {id}=s.create({arm:'baseline'});let n=0;const agent=new Agent(s,{config:()=>({provider:'test_double'}),chat:async()=>{if(n++)throw Error('provider_http_500');return {message:toolMessage};}});
 await assert.rejects(agent.turn(id,{text:'change'}),/provider_http/);assert.equal(s.rows(id)[0].version,2);assert.equal(s.state(id).status,'inconclusive');await assert.rejects(agent.turn(id,{text:'retry'}),/requires_review/);
 }finally{s.close();}
});
test('audio path transcribes actual supplied bytes and returns generated bytes (test double)',async()=>{
 const s=new Store();try{const {id}=s.create();const provider={config:()=>({provider:'test_double'}),transcribe:async b=>{assert.equal(b.toString(),'audio-fixture');return 'hello';},chat:async()=>({message:{role:'assistant',content:'Hello'}}),speak:async()=>Buffer.from('speech-fixture')};const result=await new Agent(s,provider).turn(id,{audio:Buffer.from('audio-fixture').toString('base64'),mime:'audio/wav'});assert.equal(Buffer.from(result.audio.base64,'base64').toString(),'speech-fixture');assert.equal(s.evidence(id).events.filter(e=>e.type.startsWith('audio.')).length,2);}finally{s.close();}
});
test('HTTP separates admin and per-session capabilities and rejects browser origins',async()=>{
 const store=new Store(),adminToken='a'.repeat(64);const app=server({store,provider:{},adminToken});await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
 const req=(path,token,body,headers={})=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await req('/sessions','bad',{})).status,401);
  const a=await(await req('/sessions',adminToken,{arm:'baseline'})).json();const b=await(await req('/sessions',adminToken,{})).json();
  assert.equal((await req(`/sessions/${a.id}/tools`,b.token,{requestId:'1',tool:'update_contact',args:other})).status,401);
  assert.equal((await req(`/sessions/${a.id}/tools`,a.token,{requestId:'1',tool:'update_contact',args:other})).status,200);
  assert.equal((await req(`/sessions/${a.id}/evidence`,a.token)).status,401);
  const e=await(await req(`/sessions/${a.id}/evidence`,adminToken)).json();assert.equal(e.rows.find(r=>r.id==='customer-2').contact,other.contact);
  assert.equal((await req('/sessions',adminToken,{}, {Origin:'https://example.org'})).status,403);
  assert.equal((await req(`/sessions/${a.id}/messages`,a.token,{text:'hello',verified:true})).status,400);
 }finally{await new Promise(r=>app.close(r));store.close();}
});
test('OpenAI HTTP contracts and disabled provider (no network)',async()=>{
 const calls=[];const p=new OpenAIProvider({env:{ENABLE_PROVIDER:'true',OPENAI_API_KEY:'test-only',CHAT_MODEL:'test-chat',STT_MODEL:'test-stt',TTS_MODEL:'test-tts'},reserve:()=>{},fetcher:async(url,opts)=>{calls.push({url,opts});return new Response(url.endsWith('speech')?'wav':JSON.stringify(url.endsWith('transcriptions')?{text:'hello'}:{choices:[{message:{role:'assistant',content:'Hi'}}]}),{status:200});}});
 assert.equal((await p.chat([],[])).message.content,'Hi');assert.equal(await p.transcribe(Buffer.from('test'),'audio/wav'),'hello');assert.equal((await p.speak('hi')).toString(),'wav');assert.equal(calls.length,3);assert.ok(calls[1].opts.body instanceof FormData);
 await assert.rejects(new OpenAIProvider({env:{CHAT_MODEL:'test'},reserve:()=>{throw Error('should_not_reserve');}}).chat([],[]),/provider_disabled/);
});
test('expired sessions reject both new requests and cached replays',()=>use(s=>{const {id}=s.create({arm:'baseline'});s.invoke(id,'one','update_contact',own);const state=s.state(id);state.expiresAt=0;s.save(id,state);assert.throws(()=>s.invoke(id,'one','update_contact',own),/session_expired/);assert.equal(s.rows(id)[0].version,2);}));
test('simultaneous conversational turns are rejected before additional model work',async()=>{const s=new Store();try{const {id}=s.create();let release;const pending=new Promise(r=>release=r);const agent=new Agent(s,{config:()=>({provider:'test_double'}),chat:async()=>{await pending;return {message:{role:'assistant',content:'hi'}};}});const first=agent.turn(id,{text:'hello'});await assert.rejects(agent.turn(id,{text:'duplicate'}),/session_busy/);release();await first;assert.equal(s.state(id).turn,1);}finally{s.close();}});
