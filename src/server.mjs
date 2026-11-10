import http from 'node:http';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {Store} from './store.mjs';
import {tools} from './tools.mjs';
import {Agent} from './agent.mjs';
import {OpenAIProvider} from './provider.mjs';
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function server({store,provider,adminToken}){
 if(!adminToken||adminToken.length<32)throw Error('ADMIN_TOKEN must contain at least 32 characters');
 const agent=new Agent(store,provider);
 return http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??'')||req.headers.origin) return send(403,{error:'loopback_client_required'});
   const url=new URL(req.url,'http://127.0.0.1');const token=req.headers.authorization?.replace(/^Bearer /,'');
   const admin=equal(token,adminToken);const parts=url.pathname.split('/').filter(Boolean);
   if(req.method==='GET'&&url.pathname==='/health')return send(200,{status:'ok',fixture:'synthetic',providerEnabled:process.env.ENABLE_PROVIDER==='true'});
   if(req.method==='GET'&&url.pathname==='/tools'&&admin)return send(200,{tools});
   if(parts[0]!=='sessions')return send(404,{error:'not_found'});
   const id=parts[1];const creating=req.method==='POST'&&parts.length===1;
   const evidence=req.method==='GET'&&parts.length===3&&parts[2]==='evidence';
   if(creating||evidence){if(!admin)return send(401,{error:'admin_required'});}
   else if(!id||!store.auth(id,token))return send(401,{error:'session_token_required'});
   if(evidence)return send(200,store.evidence(id));
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>6500000)return send(413,{error:'body_too_large'});}
   const body=JSON.parse(raw||'{}');
   if(creating){if(Object.keys(body).some(k=>!['arm','subject','verified','consent','notes'].includes(k)))throw Error('invalid_session_field');return send(201,store.create(body));}
   if(req.method==='POST'&&parts.length===3&&parts[2]==='messages'){
    if(Object.keys(body).some(k=>!['text','audio','mime'].includes(k)))throw Error('invalid_message_field');
    return send(200,await agent.turn(id,body));
   }
   if(req.method==='POST'&&parts.length===3&&parts[2]==='tools'){
    if(Object.keys(body).sort().join(',')!=='args,requestId,tool')throw Error('invalid_tool_field');
    return send(200,store.invoke(id,body.requestId,body.tool,body.args));
   }
   return send(404,{error:'not_found'});
  }catch(e){const known=/^(invalid_|provide_|synthetic_|unknown_|session_|turn_|model_|tool_|idempotency_|provider_|chat_|stt_|tts_)/.test(e.message);send(400,{error:known?e.message:'request_failed',note:'Inspect evidence before retrying. Stored effects may exist.'});}
 });
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const dir=resolve(process.env.DATA_DIR??'.data');mkdirSync(dir,{recursive:true,mode:0o700});
 const store=new Store(resolve(dir,'target.sqlite'));
 const limit=Number(process.env.MAX_PROVIDER_REQUESTS??100);if(!Number.isSafeInteger(limit)||limit<1)throw Error('invalid_request_limit');
 const provider=new OpenAIProvider({reserve:()=>store.reserve(limit)});
 const app=server({store,provider,adminToken:process.env.ADMIN_TOKEN});
 app.listen(Number(process.env.PORT??4310),'127.0.0.1',()=>console.log('Synthetic target listening on http://127.0.0.1:'+app.address().port));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close(()=>{store.close();process.exit();}));
}
