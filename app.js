'use strict';
/* Language Bridge — separate classroom training app. The original Symbol Talker is not modified. */
const $ = id => document.getElementById(id);
const ALL = window.LANGUAGES || [];
const SETS = window.TALKER_SETS || {};
const LANGUAGE = Object.fromEntries(ALL.map(language => [language.code,language]));
const CATEGORY_IMG = {Daily:'finished.png',Play:'games.png',Chat:'hello.png',News:'question.png',Position:'category_actions.png',Places:'category_community.png',Time:'wait.png',Feelings:'category_feelings.png',Topics:'question.png',School:'work.png',Messages:'hello.png',Spelling:'write.png',People:'category_people.png',Actions:'category_actions.png',Describe:'good.png','Little Words':'write.png',Finish:'finished.png',Questions:'question.png'};
const QUESTION_SECTIONS = {Who:'People',What:'Topics',Why:'Feelings',Where:'Places',When:'Time'};
const QUESTIONS = ['Who','What','Why','Where','When'];
const SIDES = ['Daily','Play','Chat','News','Position','Places','Time','Feelings','Topics','School','Messages','Spelling'];
const BOTTOM = ['People','Finish','Questions','Actions','Describe','Little Words'];
const SMALL = ['now','then','this','that','in','on','a','the','and','with','not'];
const RTL = language => !!language?.rtl;
const WORD_CACHE_KEY = 'powerhouseLanguageBridgeWordTranslations_v1';
let wordCache = {};
try{wordCache=JSON.parse(localStorage.getItem(WORD_CACHE_KEY)||'{}')||{}}catch(e){wordCache={}}
const state = {source:'en',target:'fr',voiceMode:'auto',mode:'talker',section:'Core',question:'Who',tokens:[],translation:'',autoReady:false,server:false,serverProvider:'free',speechServer:false,serverVoices:[],renderTicket:0,translationTicket:0,caps:false};
let toastTimer, speechList=[],translating=false,activeUtterance=null,speechWatchdog=null,speechSession=0;
let audioContext=null,activeAudioNode=null,speechRequest=null,activeSpeechButton=null;
const html = str => String(str ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const hasText = () => getMessage().trim().length>0;
const selectedSource = () => LANGUAGE[state.source];
const selectedTarget = () => LANGUAGE[state.target];
const getMessage = () => state.mode==='type' ? $('messageInput').value : state.tokens.join(' ').replace(/\s+([.,!?;:])/g,'$1').trim();
const displayLabel = (text) => {if(state.source==='en') return String(text);return wordCache[`en|${state.source}|${text}`]||String(text)};
const speechCode = l => l?.speech || 'en-GB';

// Short, familiar controls follow the speaker's chosen language. All other languages
// still show a changing destination name rather than a fixed English button.
const UI_COPY = {
 en:['Keyboard','Talker','Hear my message','Translate to','Speak translation','Copy text','Reply in this language','Back','Clear','Core words'],
 fr:['Clavier','Pictogrammes','Écouter mon message','Traduire en','Écouter la traduction','Copier','Répondre dans cette langue','Retour','Effacer','Mots de base'],
 es:['Teclado','Pictogramas','Escuchar mi mensaje','Traducir al','Escuchar la traducción','Copiar','Responder en este idioma','Atrás','Borrar','Palabras básicas'],
 de:['Tastatur','Symboltafel','Nachricht anhören','Übersetzen in','Übersetzung anhören','Kopieren','In dieser Sprache antworten','Zurück','Löschen','Grundwörter'],
 it:['Tastiera','Simboli','Ascolta il messaggio','Traduci in','Ascolta la traduzione','Copia','Rispondi in questa lingua','Indietro','Cancella','Parole di base'],
 pt:['Teclado','Símbolos','Ouvir a mensagem','Traduzir para','Ouvir a tradução','Copiar','Responder neste idioma','Voltar','Limpar','Palavras básicas'],
 pl:['Klawiatura','Symbole','Odsłuchaj wiadomość','Przetłumacz na','Odsłuchaj tłumaczenie','Kopiuj','Odpowiedz w tym języku','Wstecz','Wyczyść','Podstawowe słowa'],
 ru:['Клавиатура','Символы','Прослушать сообщение','Перевести на','Прослушать перевод','Копировать','Ответить на этом языке','Назад','Очистить','Основные слова'],
 uk:['Клавіатура','Символи','Прослухати повідомлення','Перекласти на','Прослухати переклад','Копіювати','Відповісти цією мовою','Назад','Очистити','Основні слова'],
 ar:['لوحة المفاتيح','الرموز','استمع لرسالتي','ترجمة إلى','استمع للترجمة','نسخ','الرد بهذه اللغة','رجوع','مسح','كلمات أساسية'],
 ur:['کی بورڈ','علامات','میرا پیغام سنیں','ترجمہ کریں','ترجمہ سنیں','کاپی کریں','اس زبان میں جواب دیں','واپس','صاف کریں','بنیادی الفاظ'],
 pa:['ਕੀਬੋਰਡ','ਚਿੰਨ੍ਹ','ਮੇਰਾ ਸੁਨੇਹਾ ਸੁਣੋ','ਇਸ ਵਿੱਚ ਅਨੁਵਾਦ ਕਰੋ','ਅਨੁਵਾਦ ਸੁਣੋ','ਕਾਪੀ ਕਰੋ','ਇਸ ਭਾਸ਼ਾ ਵਿੱਚ ਜਵਾਬ ਦਿਓ','ਵਾਪਸ','ਸਾਫ਼ ਕਰੋ','ਮੁੱਖ ਸ਼ਬਦ'],
 hi:['कीबोर्ड','प्रतीक','मेरा संदेश सुनें','अनुवाद करें','अनुवाद सुनें','कॉपी करें','इस भाषा में जवाब दें','वापस','साफ़ करें','मुख्य शब्द'],
 'zh-CN':['键盘','符号板','播放我的消息','翻译成','朗读译文','复制','用此语言回复','返回','清除','常用词'],
 'zh-TW':['鍵盤','符號板','播放我的訊息','翻譯成','朗讀譯文','複製','用此語言回覆','返回','清除','常用詞'],
 yue:['鍵盤','符號板','讀出我嘅訊息','翻譯做','讀出翻譯','複製','用呢種語言回覆','返回','清除','常用詞'],
 bn:['কিবোর্ড','প্রতীক','আমার বার্তা শুনুন','অনুবাদ করুন','অনুবাদ শুনুন','কপি করুন','এই ভাষায় উত্তর দিন','ফিরুন','মুছুন','প্রয়োজনীয় শব্দ'],
 tr:['Klavye','Semboller','Mesajımı dinle','Şu dile çevir:','Çeviriyi dinle','Kopyala','Bu dilde yanıtla','Geri','Temizle','Temel kelimeler']
};
function displayLanguageInSource(){
  const target=selectedTarget();
  try{return new Intl.DisplayNames([speechCode(selectedSource())],{type:'language'}).of(target.code==='pa-Arab'?'pa':target.code)||target.name}catch(e){return target.name}
}
function refreshButtonLanguage(){
  const c=UI_COPY[state.source]||UI_COPY.en;
  const targetCopy=UI_COPY[state.target]||UI_COPY.en;
  const mapping={keyboardLabel:c[0],talkerLabel:c[1],hearLabel:c[2],translateLabel:`${c[3]} ${displayLanguageInSource()}`,speakLabel:targetCopy[4],copyLabel:targetCopy[5],replyLabel:targetCopy[6],backLabel:c[7],clearLabel:c[8],coreLabel:c[9]};
  for(const [id,value] of Object.entries(mapping)){const el=$(id);if(el)el.textContent=value}
  $('translateBtn').setAttribute('aria-label',`${c[3]} ${displayLanguageInSource()}`);
  $('speakResult').setAttribute('aria-label',`${targetCopy[4]} — ${selectedTarget().name}`);
}

function showToast(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4200)}
function initSelects(){
  for(const id of ['sourceLanguage','targetLanguage']){
    const select=$(id);let currentGroup='';
    for(const l of ALL){
      if(l.group!==currentGroup){currentGroup=l.group;const group=document.createElement('optgroup');group.label=currentGroup;select.appendChild(group)}
      const opt=document.createElement('option');opt.value=l.code;opt.textContent=`${l.name} · ${l.native}`;select.lastElementChild.appendChild(opt);
    }
  }
  try{const pref=JSON.parse(localStorage.getItem('languageBridgePreferences')||'{}');if(LANGUAGE[pref.source]&&LANGUAGE[pref.target]){state.source=pref.source;state.target=pref.target;state.mode=pref.mode==='type'?'type':'talker';state.voiceMode=['auto','device','server'].includes(pref.voiceMode)?pref.voiceMode:'auto'}}catch(e){}
  $('sourceLanguage').value=state.source;$('targetLanguage').value=state.target;$('voiceMode').value=state.voiceMode||'auto';
}
function rememberPrefs(){try{localStorage.setItem('languageBridgePreferences',JSON.stringify({source:state.source,target:state.target,mode:state.mode,voiceMode:state.voiceMode||'auto'}))}catch(e){}}
function markResult(status='READY',type=''){$('resultBadge').textContent=status;$('resultBadge').className='translated-status'+(type?' '+type:'')}
function invalidateResult(){if(activeSpeechButton)stopSpeech();state.translation='';state.translationTicket++;$('translatedText').textContent='Your translation will appear here.';$('translatedText').classList.add('placeholder');$('translationHelp').textContent='Press Translate message when you are ready.';$('speakResult').disabled=true;$('copyResult').disabled=true;$('replyButton').disabled=true;markResult('READY')}
function updateLanguageUI(){
  const source=selectedSource(),target=selectedTarget();
  $('sourceNative').textContent=source.native;$('targetNative').textContent=target.native;
  $('typingLanguageName').textContent=source.name.toUpperCase();$('resultLanguage').textContent=`${target.name.toUpperCase()} · ${target.native}`;
  $('messageInput').setAttribute('lang',speechCode(source));$('messageInput').dir=RTL(source)?'rtl':'ltr';
  $('translatedText').setAttribute('lang',speechCode(target));$('translatedText').dir=RTL(target)?'rtl':'ltr';
  $('builtMessage').dir=RTL(source)?'rtl':'ltr';
  $('keyboardNote').textContent=source.script==='hani'||source.script==='jpan'?'Full typing uses your device keyboard.':'You can also use your device keyboard.';
  $('imeHint').classList.toggle('hidden', !['hani','jpan','hang'].includes(source.script));
  $('imeHint').textContent=source.script==='hani'?'For full Chinese typing, enable a Mandarin or Cantonese input method in your iPad, phone or computer settings. The on-screen keys are common characters, not a full Chinese input method.':source.script==='jpan'?'For full Japanese typing, select a Japanese keyboard in your device settings. The keys shown here are basic hiragana.':'For full Korean typing, select a Korean keyboard in your device settings.';
  renderKeyboard();renderTalker();refreshButtonLanguage();refreshVoiceInfo();rememberPrefs();
}
function changeLanguage(side,code){
  if(activeSpeechButton)stopSpeech();
  if(!LANGUAGE[code])return;
  const old=state[side];if(old===code)return;
  state[side]=code;
  if(state.source===state.target){
    const other=side==='source'?'target':'source';state[other]=old;
    $(other==='source'?'sourceLanguage':'targetLanguage').value=old;
    showToast('The two languages must be different. The other language has been adjusted.');
  }
  state.tokens=[];$('messageInput').value='';invalidateResult();updateLanguageUI();refreshMessage();
}
function swapLanguages(keepText=false){
  if(activeSpeechButton)stopSpeech();
  const from=state.source,to=state.target;
  const existing=state.translation;
  state.source=to;state.target=from;
  $('sourceLanguage').value=to;$('targetLanguage').value=from;
  state.tokens=[];
  // Reversing a translation becomes a typing task so that the existing translation is not lost.
  if(keepText&&existing){state.mode='type';$('messageInput').value=existing}
  else {$('messageInput').value='';}
  invalidateResult();updateLanguageUI();changeMode(state.mode);refreshMessage();
}
function changeMode(mode){
  if(state.mode==='talker'&&mode==='type'&&state.tokens.length&&!$('messageInput').value){$('messageInput').value=getMessage()}
  state.mode=mode;$('typeSection').classList.toggle('hidden',mode!=='type');$('talkerSection').classList.toggle('hidden',mode!=='talker');
  for(const [id,kind] of [['typeMode','type'],['talkerMode','talker']]){$(id).classList.toggle('active',kind===mode);$(id).setAttribute('aria-pressed',kind===mode?'true':'false')}
  rememberPrefs();
  invalidateResult();refreshMessage();
}
function refreshMessage(){
  const count=state.tokens.length;
  $('tokenCount').textContent=`${count} ${count===1?'word':'words'}`;
  const message=state.tokens.join(' ').replace(/\s+([.,!?;:])/g,'$1').trim();
  $('builtMessage').classList.toggle('empty',!message);
  $('builtMessage').textContent=message||'Tap the words below to make a message…';
  $('translateBtn').disabled=!hasText();$('hearSource').disabled=!hasText();
}
function addToken(token){
  const text=String(token||'').trim();if(!text)return;
  state.tokens.push(text);invalidateResult();refreshMessage();
  $('builtMessage').scrollTop=$('builtMessage').scrollHeight;
}
async function addEnglishToken(text){
  if(state.source==='en'){addToken(text);return}
  const key=`en|${state.source}|${text}`;
  if(wordCache[key]){addToken(wordCache[key]);return}
  try{showToast('Finding this word in '+selectedSource().name+'…');const out=await translateTexts([text],'en',state.source);if(out?.[0]){cacheWord(text,state.source,out[0]);addToken(out[0]);renderTalker()}}
  catch(e){showToast('Cannot translate this Talker word yet: '+e.message)}
}
function renderKeyboard(){
  const lang=selectedSource(),script=lang.script;
  const lookup=window.SCRIPT_KEYS;
  let rows = lookup[lang.code] || lookup[script];
  if(script==='arab'&&lang.code==='ur')rows=lookup.ur;
  if(script==='arab'&&lang.code==='pa-Arab')rows=lookup.ur;
  if(script==='hani'&&lang.code==='yue')rows=lookup.yue;
  if(script==='cyrl'&&lang.code==='ru')rows=lookup.ru;
  if(script==='cyrl'&&lang.code==='uk')rows=lookup.uk;
  if(script==='cyrl'&&lang.code==='sr')rows=lookup.sr;
  if(script==='cyrl'&&lang.code==='bg')rows=lookup.bg;
  if(script==='latn'){
    if(lang.code==='fr')rows=['a z e r t y u i o p','q s d f g h j k l m','w x c v b n'];
    else if(lang.code==='de')rows=['q w e r t z u i o p ü','a s d f g h j k l ö ä','y x c v b n ß'];
    else rows=['q w e r t y u i o p','a s d f g h j k l','z x c v b n m'];
  }
  if(!rows)rows=['q w e r t y u i o p','a s d f g h j k l','z x c v b n m'];
  const markup=rows.map(row=>{
    const keys=row.split(/\s+/).filter(Boolean).map(ch=>{
      let key=state.caps?ch.toLocaleUpperCase(lang.code):ch;
      return `<button type="button" class="vkey" data-key="${html(key)}" aria-label="Type ${html(key)}">${html(key)}</button>`;
    }).join('');return `<div class="key-row">${keys}</div>`;
  });
  const accent=window.ACCENTS[lang.code]||'';
  if(accent)markup.push(`<div class="key-row">${accent.split(/\s+/).filter(Boolean).map(ch=>`<button class="vkey" type="button" data-key="${html(ch)}">${html(ch)}</button>`).join('')}</div>`);
  markup.push(`<div class="key-row"><button type="button" class="vkey fn" data-function="caps" title="Uppercase">⇧</button><button type="button" class="vkey space" data-function="space">SPACE</button><button type="button" class="vkey fn" data-key=".">.</button><button type="button" class="vkey fn" data-key="?">?</button><button type="button" class="vkey fn wide" data-function="backspace">⌫</button><button type="button" class="vkey fn" data-function="enter">↵</button></div>`);
  $('keyboard').innerHTML=markup.join('');
}
function insertKeyboard(ch){const el=$('messageInput'),start=el.selectionStart,end=el.selectionEnd;el.setRangeText(ch,start,end,'end');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus({preventScroll:true})}
function keyboardAction(btn){
  const fn=btn.dataset.function;
  if(fn==='caps'){state.caps=!state.caps;renderKeyboard();return}
  if(fn==='space'){insertKeyboard(' ');return}
  if(fn==='enter'){insertKeyboard('\n');return}
  if(fn==='backspace'){const el=$('messageInput');if(el.selectionStart===el.selectionEnd&&el.selectionStart>0){el.setSelectionRange(el.selectionStart-1,el.selectionStart)}insertKeyboard('');return}
  if(btn.dataset.key!==undefined)insertKeyboard(btn.dataset.key);
}
function activeWords(){if(state.section==='Core')return SETS.Core||[];if(state.section.startsWith('Question:'))return SETS[QUESTION_SECTIONS[state.question]]||[];return SETS[state.section]||SETS.Core||[]}
function wordColour(item,section){
  if(item?.colour)return item.colour;
  if(['People'].includes(section))return 'yellow';if(['Questions'].includes(section))return 'purple';if(['Describe','Feelings'].includes(section))return 'blue';if(['Little Words','Position','Time'].includes(section))return 'white';return 'green';
}
function tile(text,color,action,value,opts={}){
  const localized=displayLabel(text);const untranslated=state.source!=='en'&&localized===text;
  return `<button type="button" class="tile ${html(color)} ${opts.active?'active':''} ${opts.plus?'plus':''}" data-action="${html(action)}" data-value="${html(value)}" title="${html(text)}" lang="${html(speechCode(selectedSource()))}" dir="auto">${opts.img?`<img class="tile-icon" alt="" src="${html(window.EMBEDDED_ASSETS?.[opts.img]||'assets/'+opts.img)}">`:''}<span>${html(localized)}</span>${untranslated?'<small>···</small>':''}</button>`;
}
function wordTile(item,section){return tile(item.label,wordColour(item,section),'word',item.speak||item.label)}
function sideTile(section){return tile(section,'teal','section',section,{img:CATEGORY_IMG[section]||'question.png',plus:true,active:state.section===section})}
function bottomTile(section){const color=section==='People'?'yellow':section==='Questions'?'purple':section==='Describe'?'blue':section==='Little Words'?'white':'green';return tile(section,color,'section',section,{plus:section!=='Finish',active:state.section===section,img:section==='Finish'?'finished.png':undefined})}
function renderTalker(){
  state.renderTicket++;
  const grid=$('talkerGrid');if(!grid)return;
  grid.classList.remove('question-grid');
  $('backToCore').classList.toggle('hidden',state.section==='Core');
  $('boardName').textContent=state.section==='Core'?'CORE WORDS':state.section.startsWith('Question:')?'QUESTIONS · '+state.question.toUpperCase():state.section.toUpperCase();
  $('boardLabel').textContent=' · Tell Me board';
  if(state.section.startsWith('Question:')){
    grid.classList.add('question-grid');
    const result=[];for(const q of QUESTIONS)result.push(tile(q,'purple','question',q,{active:q===state.question}));
    for(const item of activeWords().slice(0,20))result.push(wordTile(item,QUESTION_SECTIONS[state.question]));
    grid.innerHTML=result.join('');prepareBoardTranslations([...QUESTIONS,...activeWords().map(item=>item.label)]);return;
  }
  const words=activeWords();
  const cells=[];const visible=[];
  const push=(markup,label)=>{cells.push(markup);visible.push(label)};
  QUESTIONS.forEach(q=>push(tile(q,'purple','question',q,{plus:true}),q));
  SMALL.slice(0,2).forEach(x=>push(tile(x,'white','word',x),x));
  SIDES.slice(0,2).forEach(x=>push(sideTile(x),x));
  for(let row=0;row<4;row++){
    for(let col=0;col<5;col++){
      const item=words[row*5+col]||{label:'',speak:''};push(wordTile(item,state.section),item.label);
    }
    SMALL.slice(2+row*2,4+row*2).forEach(x=>push(tile(x,'white','word',x),x));
    SIDES.slice(2+row*2,4+row*2).forEach(x=>push(sideTile(x),x));
  }
  BOTTOM.forEach(x=>push(bottomTile(x),x));
  push(tile('not','white','word','not'),'not');
  SIDES.slice(10,12).forEach(x=>push(sideTile(x),x));
  grid.innerHTML=cells.join('');
  prepareBoardTranslations(visible);
}
function cacheWord(english,language,translation){
  if(!english||!translation)return;
  wordCache[`en|${language}|${english}`]=translation;
  const keys=Object.keys(wordCache);if(keys.length>1500)keys.slice(0,250).forEach(key=>delete wordCache[key]);
  try{localStorage.setItem(WORD_CACHE_KEY,JSON.stringify(wordCache))}catch(e){}
}
async function prepareBoardTranslations(words){
  const token=state.renderTicket,language=state.source;
  if(language==='en')return;
  const missing=[...new Set(words.filter(x=>x&&x.trim()&&!wordCache[`en|${language}|${x}`]))];
  if(!missing.length)return;
  // Avoid dozens of automatic requests to the limited free public service.
  // When staff enable the Google API, the full board can be localised in batches.
  // In free mode only an explicitly tapped word is translated.
  if(state.serverProvider!=='google')return;
  let failures=0;
  const chunks=[];for(let i=0;i<missing.length;i+=7)chunks.push(missing.slice(i,i+7));
  for(const chunk of chunks){
    if(token!==state.renderTicket||state.source!==language)return;
    try{
      const results=await translateTexts(chunk,'en',language);
      if(!Array.isArray(results)||results.length!==chunk.length)throw Error('Word list mismatch');
      chunk.forEach((word,i)=>cacheWord(word,language,results[i]));
      if(token!==state.renderTicket||state.source!==language)return;
      // Update labels without rebuilding, so users can continue tapping while translation occurs.
      document.querySelectorAll('#talkerGrid .tile').forEach(btn=>{
        const original=btn.title;const translation=wordCache[`en|${language}|${original}`];
        if(translation){btn.querySelector('span').textContent=translation;btn.querySelector('small')?.remove()}
      });
    }catch(e){failures++;if(failures>2)break}
  }
  if(failures>0&&token===state.renderTicket)showToast('Some Talker words could not be localised. The free translator may not support this language.');
}
function setSection(section){
  if(section==='Spelling'){changeMode('type');$('messageInput').value=state.tokens.join(' ');refreshMessage();showToast('Use the keyboard to spell your own words.');return}
  if(section==='Finish'){addEnglishToken('finished');return}
  if(section==='Questions'){state.section='Question:'+state.question;renderTalker();return}
  if(!SETS[section])return;
  state.section=section;renderTalker();
}
function switchQuestion(question){if(!QUESTIONS.includes(question))return;state.question=question;state.section='Question:'+question;renderTalker()}
function decodeEntities(input){const t=document.createElement('textarea');t.innerHTML=String(input);return t.value}
function splitText(text,max=420){
  const parts=[];let remaining=text;
  while(remaining.length>max){let pos=Math.max(remaining.lastIndexOf(' ',max),remaining.lastIndexOf('\n',max));if(pos<Math.floor(max*.6))pos=max;parts.push(remaining.slice(0,pos));remaining=remaining.slice(pos).trimStart()}
  if(remaining)parts.push(remaining);return parts;
}
async function fetchWithTimeout(url,options={},ms=14000){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),ms);try{return await fetch(url,{...options,signal:ctrl.signal})}finally{clearTimeout(t)}}
async function freeOne(text,source,target){
  const params=new URLSearchParams({q:text,langpair:`${source}|${target}`});
  const response=await fetchWithTimeout('https://api.mymemory.translated.net/get?'+params.toString(),{},16000);
  if(!response.ok)throw Error('Free translation service is currently unavailable');
  const data=await response.json();
  const value=decodeEntities(data?.responseData?.translatedText||'');
  if(Number(data.responseStatus||200)!==200||!value||/\b(MYMEMORY WARNING|QUERY LENGTH LIMIT)\b/i.test(value)||data?.responseData?.match===-1){throw Error(data?.responseDetails||'This translation pair may not be supported by the free service')}
  return value;
}
async function freeMany(texts,source,target){
  if(texts.length===1){const chunks=splitText(texts[0]);if(chunks.length===1)return [await freeOne(texts[0],source,target)];const out=[];for(const ch of chunks)out.push(await freeOne(ch,source,target));return [out.join(' ')]}
  // First attempt a batched text with line breaks. Only accept if every line is returned.
  const joined=texts.join('\n');
  if(joined.length<=420){
    try{
      const translated=await freeOne(joined,source,target);
      const lines=translated.replace(/<br\s*\/?\s*>/gi,'\n').split(/\r?\n/).map(s=>s.trim());
      if(lines.length===texts.length&&lines.every(Boolean))return lines;
    }catch(e){}
  }
  // On some language pairs MyMemory merges lines. Fall back to per-word translation.
  const out=[];for(const text of texts)out.push(await freeOne(text,source,target));return out;
}
async function translateTexts(texts,source,target){
  if(source===target)return texts;
  // The hosted app always uses its own server. Do not send a second hidden
  // request directly from the iPad after a server failure or flood the provider.
  // Only the standalone local HTML file uses the public provider in-browser.
  if(location.protocol!=='file:'){
    let response;
    try{
      response=await fetchWithTimeout('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts,source,target})},20000);
    }catch(e){
      if(e.name==='AbortError')throw Error('The translation request timed out. Please try again.');
      throw Error('Cannot reach the translation server. Check that Render is Live and try again.');
    }
    let data={};try{data=await response.json()}catch(e){}
    if(!response.ok){
      if(data?.error)throw Error(data.error);
      if(response.status===429)throw Error('Translation limit reached. Please try again later.');
      throw Error(`The translation service is unavailable (HTTP ${response.status}).`);
    }
    if(!Array.isArray(data.translations)||data.translations.length!==texts.length)throw Error('Translation server sent an incomplete response.');
    return data.translations;
  }
  return freeMany(texts,source,target);
}
function setProviderStatus(){
  $('serviceName').textContent=state.serverProvider==='google'?'Cloud translation':'Limited free translation';
  $('serviceInfo').textContent=state.serverProvider==='google'?'Enhanced language coverage · Online':'Public service · daily limits may apply';
  $('serviceDot').classList.toggle('warning',state.serverProvider!=='google');
}
async function detectServer(){
  if(location.protocol==='file:'){setProviderStatus();return}
  try{
    const res=await fetchWithTimeout('/api/status',{},2600);
    if(res.ok){const data=await res.json();if(data?.app==='language-bridge'){state.server=true;state.serverProvider=data.provider==='google'?'google':'free';state.speechServer=!!data.speechAvailable;state.serverVoices=Array.isArray(data.voiceCodes)?data.voiceCodes:[];refreshVoiceInfo()}}
  }catch(e){}
  setProviderStatus();
}
async function doTranslate(){
  if(translating)return;
  const text=getMessage().trim();if(!text){showToast('Type or build a message first.');return}
  const thisTicket=++state.translationTicket,source=state.source,target=state.target;
  translating=true;$('translateBtn').disabled=true;markResult('TRANSLATING','working');
  $('translatedText').textContent='Translating…';$('translatedText').classList.add('placeholder');$('translationHelp').textContent='Checking your message. Internet connection required.';
  try{
    const out=await translateTexts([text],source,target);
    if(thisTicket!==state.translationTicket||state.source!==source||state.target!==target)return;
    state.translation=out[0];$('translatedText').classList.remove('placeholder');$('translatedText').textContent=out[0];
    $('translationHelp').textContent='Translation ready. Tap the green button to hear it.';
    $('copyResult').disabled=false;$('replyButton').disabled=false;markResult('TRANSLATED');refreshVoiceInfo();
  }catch(e){
    if(thisTicket!==state.translationTicket)return;
    state.translation='';$('translatedText').textContent='Translation unavailable';$('translatedText').classList.add('placeholder');
    $('translationHelp').textContent=e.message||'Translation could not be completed. Please try again.';
    markResult('SERVICE ERROR','error');showToast('Translation did not complete: '+(e.message||'please retry'));
  }finally{translating=false;refreshMessage()}
}
function updateVoices(){
  if(!('speechSynthesis' in window))return;
  try{speechList=window.speechSynthesis.getVoices()||[]}catch(e){speechList=[]}
  refreshVoiceInfo();
}
function findVoice(lang){
  const code=speechCode(lang).toLowerCase().replace(/_/g,'-');
  const base=code.split('-')[0];
  const exact=speechList.find(v=>v.lang.toLowerCase().replace(/_/g,'-')===code);
  if(exact)return exact;
  if(lang.code==='yue')return speechList.find(v=>/^(zh-hk|yue[-_])/i.test(v.lang))||null;
  // Mandarin and Cantonese must not borrow one another's voices.
  if(lang.code==='zh-CN'||lang.code==='zh-TW'||lang.code==='pa-Arab')return null;
  return speechList.find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===base)||null;
}
// The server-side eSpeak NG voices are included in the hosted app, not installed on the iPad.
function hostedVoice(lang){
  if(!state.speechServer)return null;
  const code=lang.code;
  const aliases={'zh-CN':['cmn','zh'],'zh-TW':['cmn','zh'],yue:['yue','zh-yue'],'pa-Arab':[],no:['nb','no'],tl:['fil','tl'],ckb:['ckb'],pt:['pt','pt-pt','pt-br'],fr:['fr-fr','fr'],en:['en-gb','en']};
  const choices=Object.prototype.hasOwnProperty.call(aliases,code)?aliases[code]:[code.toLowerCase(),code.toLowerCase().split('-')[0]];
  const direct=choices.find(v=>state.serverVoices.includes(v));
  if(direct)return direct;
  if(['zh-CN','zh-TW','yue','pa-Arab'].includes(code))return null;
  const base=code.toLowerCase().split('-')[0];
  return state.serverVoices.find(v=>v.startsWith(base+'-'))||null;
}
// Use the iPad's natural-sounding installed voice before eSpeak NG.
// eSpeak is a useful multilingual *backup*, but it deliberately sounds synthetic.
function speechChoice(lang) {
  const pref=state.voiceMode||'auto';
  const device=findVoice(lang),hosted=hostedVoice(lang);
  if(pref==='device')return device?{method:'device',voice:device}:{method:'none'};
  if(pref==='server')return hosted?{method:'server',voice:hosted}:{method:'none'};
  if(device)return {method:'device',voice:device};
  if(hosted)return {method:'server',voice:hosted};
  // getVoices() sometimes starts empty on Safari before voiceschanged.
  // Allow its language-aware engine to attempt speech ONLY while enumeration is pending.
  if(!speechList.length && 'speechSynthesis' in window)return {method:'device-unverified'};
  return {method:'none'};
}
function refreshVoiceInfo(){
  if(!$('voiceInfo'))return;
  const lang=selectedTarget(),speaker=$('speakResult'),chosen=speechChoice(lang);
  if(chosen.method==='device'){
    $('voiceInfo').textContent=`iPad voice · ${chosen.voice.name}`;
    $('voiceHelp').textContent='Using the device voice for clearer speech. If it sounds wrong, choose App backup under Voice.';
  }else if(chosen.method==='device-unverified'){
    $('voiceInfo').textContent='Checking device voices…';
    $('voiceHelp').textContent='If the voice does not start, check that this language has a voice installed on your iPad.';
  }else if(chosen.method==='server'){
    $('voiceInfo').textContent='App backup voice · synthetic';
    $('voiceHelp').textContent='This language is using a free synthetic backup voice. It can sound robotic. A matching iPad voice will sound clearer.';
  }else{
    $('voiceInfo').textContent='No matching voice available';
    $('voiceHelp').textContent=state.voiceMode==='device'?'No matching iPad voice. Choose Best available or install a voice on this device.':state.voiceMode==='server'?'No hosted backup for this language. Choose Best available.':'No compatible voice for this language. You can still use the translated text.';
  }
  speaker.disabled=!state.translation||chosen.method==='none';
  speaker.title=chosen.method==='server'?'Hear speech from the app-hosted synthetic backup':chosen.method==='device'?'Hear a matching voice on this iPad':'Hear translated speech';
}
function speechReset(){
  clearTimeout(speechWatchdog);
  $('speakResult').classList.remove('speaking');
  $('hearSource').classList.remove('speaking');
  activeSpeechButton=null;
  refreshVoiceInfo();
}
function stopSpeech(){
  ++speechSession;
  if(speechRequest){speechRequest.abort();speechRequest=null}
  if(activeAudioNode){try{activeAudioNode.stop(0)}catch(e){}activeAudioNode=null}
  if(window.speechSynthesis){try{speechSynthesis.cancel()}catch(e){}}
  activeUtterance=null;
  speechReset();
}
function startAudioContext(){
  // Important: unlock the audio output synchronously inside the iPad tap.
  try{
    if(!audioContext){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;audioContext=new C()}
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const silent=audioContext.createBufferSource();silent.buffer=audioContext.createBuffer(1,1,22050);silent.connect(audioContext.destination);silent.start(0);
    return audioContext;
  }catch(e){return null}
}
async function sayHosted(text,lang,voice,buttonId,session,ctx){
  const aborter=new AbortController();speechRequest=aborter;
  $(buttonId).classList.add('speaking');
  if(buttonId==='speakResult')$('voiceInfo').textContent='Preparing speech… tap again to stop';
  try{
    const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:lang.code,speed:Math.round(165*Number($('speechRate').value))}),signal:aborter.signal});
    if(!response.ok){let reason='App voice is temporarily unavailable';try{const msg=await response.json();if(msg.error)reason=msg.error}catch(e){}throw Error(reason)}
    const bytes=await response.arrayBuffer();
    if(session!==speechSession)return;
    const decoded=await ctx.decodeAudioData(bytes);
    if(session!==speechSession)return;
    if(ctx.state==='suspended')await ctx.resume();
    if(session!==speechSession)return;
    const node=ctx.createBufferSource();node.buffer=decoded;node.connect(ctx.destination);
    activeAudioNode=node;
    node.onended=()=>{if(session!==speechSession)return;activeAudioNode=null;speechRequest=null;speechReset()};
    node.start(0);
    if(buttonId==='speakResult')$('voiceInfo').textContent='Speaking with app voice · tap to stop';
  }catch(e){
    if(session!==speechSession||e.name==='AbortError')return;
    speechRequest=null;activeAudioNode=null;speechReset();
    console.warn('Hosted speech playback failed:',e);
    showToast('App voice could not play. Try iPad voice under Voice, or check your connection.');
  }
}
function sayOnDevice(text,lang,buttonId,session){
  if(!('speechSynthesis' in window))return showToast('No speech engine is available.');
  try{
    speechList=window.speechSynthesis.getVoices()||[];
    const voice=findVoice(lang),synth=window.speechSynthesis;
    synth.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang=speechCode(lang);
    if(voice)utterance.voice=voice;
    utterance.rate=Number($('speechRate').value)||0.9;
    utterance.pitch=1;
    activeUtterance=utterance;
    let started=false;
    utterance.onstart=()=>{if(session!==speechSession)return;started=true;clearTimeout(speechWatchdog);$(buttonId).classList.add('speaking');if(buttonId==='speakResult')$('voiceInfo').textContent='Speaking · tap again to stop'};
    utterance.onend=()=>{if(session!==speechSession)return;activeUtterance=null;speechReset()};
    utterance.onerror=e=>{if(session!==speechSession)return;activeUtterance=null;speechReset();if(!['interrupted','canceled'].includes(e.error))showToast('This iPad does not seem to have a working voice for '+lang.name+'.')};
    synth.speak(utterance);
    if(synth.paused)synth.resume();
    speechWatchdog=setTimeout(()=>{
      if(session!==speechSession||started||!activeUtterance)return;
      showToast('No speech heard? This language may need a voice on this device. Use the hosted app for built-in voices.');
    },2500);
  }catch(e){activeUtterance=null;speechReset();showToast('The device could not start speech playback.')}
}
function say(text,lang,buttonId='speakResult'){
  if(!text?.trim())return showToast('There is no message to speak.');
  if(activeSpeechButton===buttonId){stopSpeech();return}
  stopSpeech();
  const session=++speechSession;
  activeSpeechButton=buttonId;
  const chosen=speechChoice(lang);
  if(chosen.method==='none'){speechReset();return showToast('No matching '+(state.voiceMode==='device'?'iPad':'app')+' voice for '+lang.name+'. Try Best available under Voice.')}
  // Limit hosted messages to keep playback quick on mobile devices.
  if(chosen.method==='server'){
    if(text.length>500){speechReset();return showToast('Please shorten the message to 500 characters for speech.')}
    const ctx=startAudioContext();
    if(ctx){sayHosted(text,lang,chosen.voice,buttonId,session,ctx);return}
    speechReset();return showToast('The browser could not start audio. Try a device voice.')
  }
  sayOnDevice(text,lang,buttonId,session);
}
function toggleImmersive(){
  const shouldOpen=!document.documentElement.classList.contains('immersive');
  document.documentElement.classList.toggle('immersive',shouldOpen);
  $('fullscreenLabel').textContent=shouldOpen?'Exit full screen':'Full screen';
  $('fullscreenBtn').setAttribute('aria-label',shouldOpen?'Exit full screen':'Full screen');
  $('fullscreenBtn').title=shouldOpen?'Exit full screen':'Full screen';
  // Regular browser fullscreen is inconsistent on iPad; the compact layout always works.
  if(shouldOpen && document.documentElement.requestFullscreen && !document.fullscreenElement){
    try{const call=document.documentElement.requestFullscreen();if(call?.catch)call.catch(()=>{})}catch(e){}
  }else if(!shouldOpen&&document.fullscreenElement){
    try{document.exitFullscreen?.()}catch(e){}
  }
  if(shouldOpen && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.navigator.standalone){
    showToast('For true iPad full screen: Safari Share → Add to Home Screen → Open as Web App.');
  }
}
function setUpEvents(){
  $('sourceLanguage').addEventListener('change',e=>changeLanguage('source',e.target.value));
  $('targetLanguage').addEventListener('change',e=>changeLanguage('target',e.target.value));
  $('swapLanguages').addEventListener('click',()=>swapLanguages(Boolean(state.translation)));
  $('typeMode').addEventListener('click',()=>changeMode('type'));
  $('talkerMode').addEventListener('click',()=>changeMode('talker'));
  $('translateBtn').addEventListener('click',doTranslate);
  $('hearSource').addEventListener('click',()=>say(getMessage(),selectedSource(),'hearSource'));
  $('speakResult').addEventListener('click',()=>say(state.translation,selectedTarget(),'speakResult'));
  $('removeWord').addEventListener('click',()=>{state.tokens.pop();invalidateResult();refreshMessage()});
  $('clearMessage').addEventListener('click',()=>{state.tokens=[];invalidateResult();refreshMessage()});
  $('messageInput').addEventListener('input',()=>{invalidateResult();refreshMessage()});
  $('clearTyped').addEventListener('click',()=>{$('messageInput').value='';invalidateResult();refreshMessage();$('messageInput').focus()});
  $('keyboard').addEventListener('click',e=>{const button=e.target.closest('button');if(button)keyboardAction(button)});
  $('talkerGrid').addEventListener('click',e=>{
    const button=e.target.closest('button[data-action]');if(!button)return;
    const action=button.dataset.action,value=button.dataset.value;
    if(action==='word')addEnglishToken(value);
    else if(action==='section')setSection(value);
    else if(action==='question')switchQuestion(value);
  });
  $('backToCore').addEventListener('click',()=>{state.section='Core';renderTalker()});
  $('copyResult').addEventListener('click',async()=>{
    if(!state.translation)return;
    try{await navigator.clipboard.writeText(state.translation);showToast('Translated text copied.')}catch(e){showToast('Copy is unavailable here. Select and copy the translated text instead.')}
  });
  $('replyButton').addEventListener('click',()=>swapLanguages(true));
  $('voiceMode').addEventListener('change',e=>{state.voiceMode=e.target.value;rememberPrefs();stopSpeech();refreshVoiceInfo()});
  $('speechRate').addEventListener('input',()=>{$('speechRateValue').textContent=Number($('speechRate').value)<.85?'Slow':Number($('speechRate').value)>1.04?'Fast':'Normal'});
  $('fullscreenBtn').addEventListener('click',toggleImmersive);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();doTranslate()}});
}
function boot(){
  initSelects();setUpEvents();changeMode(state.mode);updateLanguageUI();refreshMessage();detectServer();
  updateVoices();if('speechSynthesis'in window){speechSynthesis.addEventListener?.('voiceschanged',updateVoices);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateVoices()});}
}
document.addEventListener('DOMContentLoaded',boot);
