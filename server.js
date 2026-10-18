/**
 * Language Bridge server for Render / Node 20+
 * Uses Google Cloud Translation when GOOGLE_TRANSLATE_API_KEY is configured.
 * Otherwise routes requests through MyMemory's limited, public translation service.
 * Keep credentials in Render environment settings, never in index.html.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const KEY = process.env.GOOGLE_TRANSLATE_API_KEY || '';
// Install eSpeak NG in the Docker image. Classic eSpeak is supported for local testing.
const SPEECH_BIN = ['espeak-ng','espeak'].find(bin => {try{return spawnSync(bin,['--voices'],{encoding:'utf8',timeout:3000}).status === 0}catch{return false}}) || null;
const SPEECH_VOICES = new Set(SPEECH_BIN ? spawnSync(SPEECH_BIN,['--voices'],{encoding:'utf8',timeout:3000}).stdout.split('\n').slice(1).map(line => line.trim().split(/\s+/)[1]).filter(Boolean) : []);
const SPEECH_ALIASES = { 'zh-CN':['cmn','zh'], 'zh-TW':['cmn','zh'], 'yue':['yue','zh-yue'], 'pa-Arab':[], 'no':['nb','no'], 'tl':['fil','tl'], 'ckb':['ckb'], 'pt':['pt','pt-pt','pt-br'], 'fr':['fr-fr','fr'], 'en':['en-gb','en'], 'pa':['pa'] };
function voiceForLanguage(lang) {
  if(typeof lang!=='string'||! /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,5})?$/.test(lang))return null;
  const choices = Object.prototype.hasOwnProperty.call(SPEECH_ALIASES,lang) ? SPEECH_ALIASES[lang] : [lang.toLowerCase(),lang.toLowerCase().split('-')[0]];
  const exact=choices.find(voice=>SPEECH_VOICES.has(voice));
  if(exact)return exact;
  if(['zh-CN','zh-TW','yue','pa-Arab'].includes(lang))return null;
  const base=lang.toLowerCase().split('-')[0];
  return [...SPEECH_VOICES].find(voice=>voice.startsWith(base+'-'))||null;
}
let speechInProgress=0;
function generateWav(text,voice,speed) {
  return new Promise((resolve,reject)=>{
    if(speechInProgress>=4)return reject(Error('Voice system is busy. Please try again.'));
    speechInProgress++;
    let settled=false;
    const child=spawn(SPEECH_BIN,['-v',voice,'-s',String(speed),'--stdout'],{stdio:['pipe','pipe','pipe']});
    const chunks=[]; let size=0; let err='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
    const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);speechInProgress--;error?reject(error):resolve(data)};
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){child.kill('SIGKILL');return}chunks.push(chunk)});
    child.stderr.on('data',chunk=>{if(err.length<500)err+=chunk.toString().slice(0,500)});
    child.on('error',error=>finish(error));
    child.on('close',code=>{if(code!==0||size<44||size>8*1024*1024)finish(Error('Speech generation failed: '+(err||'voice system not available')));else finish(null,Buffer.concat(chunks))});
    child.stdin.on('error',()=>{});
    child.stdin.end(text,'utf8');
  });
}
const EXTENSIONS = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function respond(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
async function readBody(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>25000)throw Error('Message is too large')}return JSON.parse(data)}
function decode(s){return String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&(?:amp|lt|gt|quot|apos|#39);/g,t=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[t]))}
async function translateGoogle(texts,source,target){
  const response=await fetch('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:texts,source,target,format:'text'}),signal:AbortSignal.timeout(18000)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error?.message||'Google Cloud Translation is unavailable');
  const translations=data.data?.translations?.map(x=>decode(x.translatedText));
  if(!Array.isArray(translations)||translations.length!==texts.length)throw Error('Translation response was incomplete');
  return translations;
}
async function freeOne(text,source,target){
  const u=new URL('https://api.mymemory.translated.net/get');u.searchParams.set('q',text);u.searchParams.set('langpair',source+'|'+target);
  const response=await fetch(u,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Free translation provider unavailable');
  const data=await response.json();const out=decode(data.responseData?.translatedText);
  if(Number(data.responseStatus||200)!==200||!out||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out))throw Error(data.responseDetails||'This language pair is not supported by the free provider');
  return out;
}
function splitText(text,max=410){const chunks=[];let left=text;while(left.length>max){let at=Math.max(left.lastIndexOf(' ',max),left.lastIndexOf('\n',max));if(at<max*.6)at=max;chunks.push(left.slice(0,at));left=left.slice(at).trimStart()}if(left)chunks.push(left);return chunks}
async function translateFree(texts,source,target){
  const results=[];
  // The free service has a strict text length limit and is unsuitable for large volumes.
  for(const text of texts){const chunks=splitText(text);const parts=[];for(const chunk of chunks)parts.push(await freeOne(chunk,source,target));results.push(parts.join(' '))}
  return results;
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/api/status'&&req.method==='GET')return respond(res,200,{app:'language-bridge',provider:KEY?'google':'free',speechAvailable:!!SPEECH_BIN,voiceCodes:[...SPEECH_VOICES]});
  if(url.pathname==='/api/speech'){
    if(req.method!=='POST')return respond(res,405,{error:'Use POST'});
    try{
      const {text,language,speed}=await readBody(req);
      if(typeof text!=='string'||!text.trim()||text.length>500)return respond(res,400,{error:'Enter a message of up to 500 characters.'});
      const voice=voiceForLanguage(language);
      if(!voice||!SPEECH_BIN)return respond(res,422,{error:'No app-hosted voice is available for this language.'});
      const safeSpeed=Math.max(105,Math.min(230,Number(speed)||150));
      const wav=await generateWav(text,voice,Math.round(safeSpeed));
      // eSpeak streams provisional RIFF lengths (0x7ffff024). Correct them for iPad/Safari audio decoding.
      if(wav.subarray(0,4).toString()==='RIFF'&&wav.subarray(8,12).toString()==='WAVE'){
        wav.writeUInt32LE(wav.length-8,4);
        if(wav.subarray(36,40).toString()==='data')wav.writeUInt32LE(wav.length-44,40);
      }
      res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(wav);
    }catch(e){return respond(res,503,{error:String(e.message||'Speech could not be generated')})}
  }
  if(url.pathname==='/api/translate'){
    if(req.method!=='POST')return respond(res,405,{error:'Use POST'});
    try{
      const body=await readBody(req);const {texts,source,target}=body;
      if(!Array.isArray(texts)||texts.length<1||texts.length>60||texts.some(t=>typeof t!=='string'||t.length>1800)||texts.join('').length>8000)return respond(res,400,{error:'Enter a short message to translate.'});
      if(typeof source!=='string'||typeof target!=='string'|| !/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,5})?$/.test(source)|| !/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,5})?$/.test(target))return respond(res,400,{error:'Invalid language selection.'});
      const translations=source===target?texts:KEY?await translateGoogle(texts,source,target):await translateFree(texts,source,target);
      return respond(res,200,{translations,provider:KEY?'google':'free'});
    }catch(e){return respond(res,502,{error:String(e.message||'Translation unavailable')})}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Method not allowed'});
  let rel=decodeURIComponent(url.pathname);
  if(rel==='/'||rel==='')rel='/index.html';
  // Whitelisted public files only. No directory browsing / hidden files / server.js.
  if(!(/^\/(?:index\.html|manifest\.webmanifest|styles\.css|app\.js|languages\.js|talker-data\.js|assets\/[\w.\-]+)$/.test(rel)))return respond(res,404,{error:'Not found'});
  const file=path.join(ROOT,rel);
  fs.readFile(file,(err,data)=>{
    if(err){respond(res,404,{error:'Not found'});return}
    res.writeHead(200,{'Content-Type':EXTENSIONS[path.extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?'':data);
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Language Bridge running on http://localhost:${PORT} (${KEY?'Google Cloud':'free translator'}, ${SPEECH_BIN||'no speech engine'}: ${SPEECH_VOICES.size} voices)`));
