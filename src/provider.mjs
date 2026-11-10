export class OpenAIProvider {
 constructor({env=process.env,reserve,fetcher=fetch}={}){this.env=env;this.reserve=reserve;this.fetcher=fetcher;}
 config(){return {provider:'openai',model:this.env.CHAT_MODEL,stt:this.env.STT_MODEL,tts:this.env.TTS_MODEL,voice:this.env.TTS_VOICE??'alloy'};}
 async request(path,body,form=false){
  if(this.env.ENABLE_PROVIDER!=='true'||!this.env.OPENAI_API_KEY)throw Error('provider_disabled');
  this.reserve();
  const r=await this.fetcher('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+this.env.OPENAI_API_KEY,...(form?{}:{'Content-Type':'application/json'})},body:form?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('provider_http_'+r.status);return r;
 }
 async chat(messages,tools){if(!this.env.CHAT_MODEL)throw Error('chat_model_required');const r=await this.request('chat/completions',{model:this.env.CHAT_MODEL,messages,tools,max_completion_tokens:1000});const b=await r.json();if(!b.choices?.[0]?.message)throw Error('invalid_provider_response');return {message:b.choices[0].message,usage:b.usage??null};}
 async transcribe(bytes,mime){if(!this.env.STT_MODEL)throw Error('stt_model_required');const f=new FormData();f.set('model',this.env.STT_MODEL);f.set('file',new Blob([bytes],{type:mime}),'input.'+({'audio/wav':'wav','audio/mpeg':'mp3','audio/webm':'webm'}[mime]));const r=await this.request('audio/transcriptions',f,true);return (await r.json()).text;}
 async speak(text){if(!this.env.TTS_MODEL)throw Error('tts_model_required');const r=await this.request('audio/speech',{model:this.env.TTS_MODEL,voice:this.env.TTS_VOICE??'alloy',input:text,response_format:'wav'});return Buffer.from(await r.arrayBuffer());}
}
