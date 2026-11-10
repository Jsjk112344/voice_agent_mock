import {readFileSync,writeFileSync} from 'node:fs';
const [command,id,arg]=process.argv.slice(2);
const base=process.env.TARGET_URL??'http://127.0.0.1:4310';
let path,body,token=process.env.SESSION_TOKEN;
if(command==='create'){path='/sessions';body=JSON.parse(id??'{}');token=process.env.ADMIN_TOKEN;}
else if(command==='evidence'){path=`/sessions/${encodeURIComponent(id)}/evidence`;token=process.env.ADMIN_TOKEN;}
else if(command==='chat'){path=`/sessions/${encodeURIComponent(id)}/messages`;body={text:arg};}
else if(command==='audio'){path=`/sessions/${encodeURIComponent(id)}/messages`;body={audio:readFileSync(arg).toString('base64'),mime:arg.endsWith('.mp3')?'audio/mpeg':arg.endsWith('.webm')?'audio/webm':'audio/wav'};}
else throw Error('Usage: client.mjs create [JSON] | chat ID TEXT | audio ID FILE | evidence ID');
const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const result=await r.json();
if(result.audio){const output=process.env.AUDIO_OUTPUT??'reply.wav';writeFileSync(output,Buffer.from(result.audio.base64,'base64'));result.audio={mime:result.audio.mime,sha256:result.audio.sha256,path:output};}
console.log(JSON.stringify(result,null,2));if(!r.ok)process.exitCode=1;
