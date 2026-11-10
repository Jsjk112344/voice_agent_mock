import {prompt,tools} from './tools.mjs';
import {hash} from './store.mjs';
export class Agent {
 constructor(store,provider){this.store=store;this.provider=provider;this.busy=new Set();}
 async turn(id,{text,audio,mime}={}){
  if(this.busy.has(id))throw Error('session_busy');
  if((typeof text==='string')===(typeof audio==='string')||(text!==undefined&&(text.length===0||text.length>8000)))throw Error('provide_text_or_audio');
  if(audio!==undefined&&(!['audio/wav','audio/mpeg','audio/webm'].includes(mime)||!audio.length||audio.length>6000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(audio)))throw Error('invalid_audio');
  let s=this.store.state(id);if(s.expiresAt<Date.now())throw Error('session_expired');if(s.status!=='ready')throw Error('session_requires_review');if(s.turn>=20)throw Error('turn_limit');
  this.busy.add(id);s.status='running';s.turn++;this.store.save(id,s);
  try{
   if(audio){const bytes=Buffer.from(audio,'base64');this.store.event(id,{type:'audio.input',sha256:hash(bytes),bytes:bytes.length,mime});text=await this.provider.transcribe(bytes,mime);}
   if(typeof text!=='string'||!text.length||text.length>8000)throw Error('invalid_transcript');
   s.messages.push({role:'user',content:text});this.store.save(id,s);
   for(let step=0;step<5;step++){
    const {message,usage}=await this.provider.chat([{role:'system',content:prompt},...s.messages],tools);
    this.store.event(id,{type:'model.response',configuration:this.provider.config(),usage,turn:s.turn});
    if(message.role!=='assistant')throw Error('invalid_assistant_message');
    s.messages.push(message);this.store.save(id,s);
    if(!message.tool_calls?.length){
     const answer=message.content??'';let output;
     if(audio&&answer){const bytes=await this.provider.speak(answer);output={mime:'audio/wav',base64:bytes.toString('base64'),sha256:hash(bytes)};this.store.event(id,{type:'audio.output',sha256:output.sha256,bytes:bytes.length,mime:output.mime});}
     s=this.merge(id,s);s.status='ready';this.store.save(id,s);return {text:answer,audio:output,turn:s.turn,origin:'provider_observed'};
    }
    if(message.tool_calls.length>8)throw Error('tool_limit');
    for(const call of message.tool_calls){
     const args=JSON.parse(call.function.arguments);
     const result=this.store.invoke(id,`turn-${s.turn}-${call.id}`,call.function.name,args,'provider_observed');
     s=this.merge(id,s);s.messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});this.store.save(id,s);
    }
   }
   throw Error('model_step_limit');
  }catch(e){s=this.merge(id,s);s.status='inconclusive';this.store.save(id,s);this.store.event(id,{type:'turn.error',reason:e.message,turn:s.turn,note:'Inspect stored effects; errors do not imply no action.'});throw e;}
  finally{this.busy.delete(id);}
 }
 merge(id,s){return {...this.store.state(id),messages:s.messages,turn:s.turn};}
}
