(function(root) {
  'use strict';
  const C=root.LambdaCore||require('./core.js'),L=root.LambdaLibrary||require('./library.js'),P=root.LambdaPresets||require('./presets.js'),E=root.LambdaDataEncoding||require('./data-encoding.js');
  const Palette=root.LambdaPalette||require('./palette.js');
  const Trace=root.LambdaTrace||require('./trace.js');
  const Guard=root.LambdaRunGuard||require('./run-guard.js');
  const LEVEL_IDS=new Set(P.levels.map(l=>l.id));
  const MAX_BYTES=2*1024*1024;
  const fail=message=>{throw new C.LambdaError(`存档无效：${message}`);};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function ast(raw) {
    let count=0;
    function walk(t,depth) {
      ++count;
      if(!object(t))fail('表达式结构不完整。');
      const name=n=>{if(!C.validName(n))fail('变量名不合法。');return n;};
      if(t.type==='var')return C.V(name(t.name));
      if(t.type==='abs')return C.L(name(t.param),walk(t.body,depth+1));
      if(t.type==='app')return C.A(walk(t.fn,depth+1),walk(t.arg,depth+1));
      fail('未知表达式类型。');
    }
    const term=walk(raw,1);C.inspect(term);return term;
  }
  function validate(raw) {
    if(!object(raw)||![2,3,4].includes(raw.version))fail('不支持这个存档版本。');
    if(typeof raw.draft!=='string')fail('草稿缺失或不是文本。');
    if(!Array.isArray(raw.functions))fail('函数库不合法。');
    const functions=raw.functions.map(f=>{
      if(!object(f))fail('函数定义不完整。');
      if(f.source!==undefined&&typeof f.source!=='string')fail('函数原始定义需为文本。');
      const term=ast(f.term),retired=f.sourceSyntax==='math';
      // Keep functions saved by the removed input mode usable without its parser.
      return {name:f.name,term,...(retired?{source:C.format(term)}:f.source===undefined?{}:{source:f.source}),...(f.encodings===undefined?{}:{encodings:f.encodings}),...(retired?{sourceFree:[...C.freeVars(term)]}:f.sourceFree===undefined?{}:{sourceFree:f.sourceFree})};
    });L.validate(functions);
    if(raw.dataEncodings!==undefined&&!Array.isArray(raw.dataEncodings))fail('数据编码列表不合法。');
    const dataEncodings=(raw.dataEncodings??[]).map(entry=>{
      if(!object(entry))fail('数据转换函数不完整。');
      if(entry.table!==undefined&&!Array.isArray(entry.table))fail('数字表达式对照表不合法。');
      const table=entry.table?.map(row=>{if(!object(row))fail('对照项不完整。');return {number:row.number,term:ast(row.term)};});
      return {name:entry.name,source:entry.source,term:ast(entry.term),...(entry.inputFormat===undefined?{}:{inputFormat:entry.inputFormat}),...(table===undefined?{}:{table})};
    });E.validate(dataEncodings);
    const encodingDraft=raw.encodingDraft??{name:'',source:''};
    if(!object(encodingDraft)||typeof encodingDraft.name!=='string'||typeof encodingDraft.source!=='string')fail('数据编码草稿不合法。');
    const encodingEditing=encodingDraft.editing??null;
    if(encodingEditing!==null&&!dataEncodings.some(entry=>entry.name===encodingEditing))fail('正在编辑的数据编码不存在。');
    if(!Array.isArray(raw.completed)||raw.completed.length>P.levels.length||raw.completed.some(i=>!LEVEL_IDS.has(i)))fail('通关进度不合法。');
    if(!['free','challenge','guide'].includes(raw.mode))fail('游戏模式不合法。');
    if(!Number.isInteger(raw.level)||raw.level<0||raw.level>=P.levels.length)fail('关卡编号不合法。');
    const s=raw.session;if(!object(s)||!Number.isSafeInteger(s.steps)||s.steps<0||typeof s.dirty!=='boolean')fail('归约状态不合法。');
    const original=s.original===null?null:ast(s.original);if(!original&&s.steps!==0)fail('没有起始表达式，无法恢复归约。');
    const encodings=s.encodings??[];
    if(!Array.isArray(encodings)||encodings.some(name=>!C.validName(name)))fail('表达式编码标记不合法。');
    const getChoice=(choice,allowOrder)=>{
      if(choice===null||allowOrder&&Trace.isOrder(choice))return choice;
      if(!Array.isArray(choice)||choice.some(part=>!['body','fn','arg'].includes(part)))fail('归约路径不合法。');
      return choice.slice();
    };
    let paths,choices,version=raw.version;
    if(s.paths!==undefined){
      if(!Array.isArray(s.paths)||s.paths.length!==s.steps)fail('归约路径数量与步数不一致。');
      paths=s.paths.map(path=>getChoice(path,false));
      if(version===2)version=3;
    }
    if(s.choices!==undefined){
      if(paths||!Array.isArray(s.choices))fail('归约记录不合法。');
      let last=-1;
      choices=s.choices.map(entry=>{
        if(!Array.isArray(entry)||entry.length!==2||!Number.isSafeInteger(entry[0])||entry[0]<=last||entry[0]>=s.steps)fail('归约记录步号不合法。');
        last=entry[0];
        return [last,getChoice(entry[1],true)];
      });
      version=4;
    }
    if(typeof s.halt!=='string'||s.halt.length>500)fail('暂停信息不合法。');
    const v=raw.view;if(!object(v)||!Number.isInteger(v.speed)||v.speed<1||v.speed>60000||!Number.isFinite(v.scale)||v.scale<.02||v.scale>16)fail('视图设置不合法。');
    const growthWindowMs=v.growthWindowMs??Guard.DEFAULT_MS;if(![0,1000,3000,10000,30000].includes(growthWindowMs))fail('运行增长观察窗口不合法。');
    const strategy=v.strategy===undefined?'normal':v.strategy;if(!C.STRATEGIES.includes(strategy))fail('归约顺序不合法。');
    const direction=v.direction===undefined?'left':v.direction;if(!C.DIRECTIONS.includes(direction))fail('归约方向不合法。');
    const numberEncoding=v.numberEncoding===undefined?'decimal':v.numberEncoding;if(!E.isBuiltin(numberEncoding)&&!dataEncodings.some(entry=>numberEncoding===`custom:${entry.name}`))fail('数字编码不合法。');
    const numberFormats=v.numberFormats??{};E.validateFormats(dataEncodings,numberFormats);
    const inputFormatDraft=v.inputFormatDraft;
    if(v.guideExample!==undefined&&typeof v.guideExample!=='string')fail('讲解示例不合法。');
    if(inputFormatDraft!==undefined&&(!object(inputFormatDraft)||typeof inputFormatDraft.encoding!=='string'||typeof inputFormatDraft.text!=='string'))fail('输入形式草稿不合法。');
    const decimalPlaces=v.decimalPlaces===undefined?6:v.decimalPlaces;if(!Number.isSafeInteger(decimalPlaces)||decimalPlaces<0)fail('小数位数不合法。');
    const panX=v.panX??0,panY=v.panY??0;
    const palette=v.palette===undefined?undefined:Palette.validate(v.palette);
    if(palette===null)fail('图示颜色不合法。');
    if(!Number.isFinite(panX)||!Number.isFinite(panY)||panX<0||panY<0||panX>5000000||panY>5000000)fail('图示位置不合法。');
    for(const field of ['autoFit','historyOpen','helpOpen','hintOpen'])if(typeof v[field]!=='boolean')fail('视图开关不合法。');
    const selection=raw.selection;if(!object(selection)||!Number.isInteger(selection.start)||!Number.isInteger(selection.end)||selection.start<0||selection.start>selection.end||selection.end>raw.draft.length)fail('光标位置不合法。');
    if(typeof raw.error!=='string'||raw.error.length>2000)fail('错误信息不合法。');
    const functionDraft=raw.functionDraft??{name:'',source:''};
    if(!object(functionDraft)||typeof functionDraft.name!=='string'||functionDraft.name.length>32||typeof functionDraft.source!=='string')fail('函数编辑草稿不合法。');
    const editing=functionDraft.editing??null;
    if(editing!==null&&(!L.validName(editing)||!functions.some(fn=>fn.name===editing)))fail('正在编辑的函数不存在或不合法。');
    const retiredDraft=v.inputSyntax==='math',draft=retiredDraft&&original&&!s.dirty?C.format(original):raw.draft;
    const unconverted=retiredDraft&&(!original||s.dirty);
    const draftFunction=raw.functions.find(fn=>fn.name===editing);
    const functionSource=functionDraft.syntax==='math'&&draftFunction?.sourceSyntax==='math'&&functionDraft.source===draftFunction.source?C.format(functions.find(fn=>fn.name===editing).term):functionDraft.source;
    return {version,savedAt:typeof raw.savedAt==='string'&&Number.isFinite(Date.parse(raw.savedAt))?raw.savedAt:new Date().toISOString(),draft,
      functions,dataEncodings,encodingDraft:{name:encodingDraft.name,source:encodingDraft.source,...(encodingEditing===null?{}:{editing:encodingEditing})},completed:[...new Set(raw.completed)],mode:raw.mode,level:raw.level,
      session:{original,steps:s.steps,dirty:s.dirty,halt:s.halt,...(s.encodings===undefined?{}:{encodings:[...new Set(encodings)]}),...(paths===undefined?{}:{paths}),...(choices===undefined?{}:{choices})},view:{growthWindowMs,speed:v.speed,strategy,direction,numberEncoding,decimalPlaces,...(v.guideExample===undefined?{}:{guideExample:v.guideExample}),...(v.numberFormats===undefined?{}:{numberFormats:{...numberFormats}}),...(inputFormatDraft===undefined?{}:{inputFormatDraft:{encoding:inputFormatDraft.encoding,text:inputFormatDraft.text}}),...(palette===undefined?{}:{palette}),scale:v.scale,autoFit:v.autoFit,panX,panY,historyOpen:v.historyOpen,helpOpen:v.helpOpen,hintOpen:v.hintOpen},
      selection:{start:Math.min(selection.start,draft.length),end:Math.min(selection.end,draft.length)},error:raw.error||(unconverted?'数学写法已移除。原草稿已保留，请改写为 λ 表达式。':''),functionDraft:{name:functionDraft.name,source:functionSource,...(editing===null?{}:{editing})}};
  }
  function* replay(s,compact) {
    let term=s.session.original,choice=null,next=0;
    const trace=compact?Trace.create(term):null;
    const history=!compact&&term?[{term,change:null}]:[];
    for(let i=0;i<s.session.steps;i++){
      if(s.session.paths)choice=s.session.paths[i];
      else if(s.session.choices?.[next]?.[0]===i)choice=s.session.choices[next++][1];
      const result=Trace.step(term,choice);
      if(!result)fail(Array.isArray(choice)?'归约路径未指向可归约项。':'步数超过实际可归约次数。');
      term=result.term;
      if(trace)trace.append(result,choice);else history.push({term,change:result});
      yield i+1;
    }
    return {...s,term,...(trace?{trace}:{history}),hasSession:true};
  }
  function encode(raw) {
    const text=JSON.stringify(validate(raw));
    if(new TextEncoder().encode(text).length>MAX_BYTES)fail('文件超过 2 MiB 上限。');return text;
  }
  function encodeBackup(raw,checkpointText) {
    const backup={...JSON.parse(encode(raw)),checkpoint:checkpointText===null?null:JSON.parse(encode(JSON.parse(checkpointText)))};
    const text=JSON.stringify(backup);
    if(new TextEncoder().encode(text).length>MAX_BYTES)fail('文件超过 2 MiB 上限。');
    return text;
  }
  function parseArchive(text) {
    if(typeof text!=='string'||text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)fail('文件超过 2 MiB 上限。');
    let raw;try{raw=JSON.parse(text);}catch{fail('不是有效的 JSON 文件。');}
    if(object(raw)&&raw.version===1) {
      const draft=typeof raw.draft==='string'?raw.draft:'(λx.x) (λy.y)';
      const migrated={version:2,savedAt:new Date().toISOString(),draft,functions:[],completed:Array.isArray(raw.completed)?[...new Set(raw.completed.filter(i=>Number.isInteger(i)&&i>0&&i<6))]:[],
        mode:raw.mode==='challenge'?'challenge':'free',level:Number.isInteger(raw.level)&&raw.level>=0&&raw.level<5?raw.level:0,
        session:{original:null,steps:0,dirty:true,halt:''},view:{numberEncoding:'church',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
      return {snapshot:validate(migrated),legacy:true};
    }
    const snapshot=validate(raw),archive={snapshot,legacy:false};
    if(Object.prototype.hasOwnProperty.call(raw,'checkpoint')) {
      archive.checkpoint=raw.checkpoint===null?null:validate(raw.checkpoint);
    }
    return archive;
  }
  function finish(iterator){
    let next=iterator.next();while(!next.done)next=iterator.next();return next.value;
  }
  function decode(text,{compact=false}={}) {
    const {snapshot,legacy,checkpoint}=parseArchive(text);
    if(legacy)return {...snapshot,history:[],term:null,hasSession:false};
    const result=finish(replay(snapshot,compact));
    if(checkpoint!==undefined)result.checkpointText=checkpoint===null?null:encode(finish(replay(checkpoint,true)));
    return result;
  }
  async function decodeAsync(text,{signal,onProgress}={}){
    const {snapshot,legacy,checkpoint}=parseArchive(text);
    if(legacy)return {...snapshot,history:[],term:null,hasSession:false};
    const total=snapshot.session.steps+(checkpoint?.session.steps??0);
    const result=await replayAsync(replay(snapshot,true),signal,step=>onProgress?.(step,total));
    if(checkpoint!==undefined){
      result.checkpointText=checkpoint===null?null:encode(await replayAsync(replay(checkpoint,true),signal,
        step=>onProgress?.(snapshot.session.steps+step,total)));
    }
    return result;
  }
  async function replayAsync(iterator,signal,onProgress){
    let started=performance.now();
    try{
      for(;;){
        signal?.throwIfAborted();
        const next=iterator.next();
        if(next.done)return next.value;
        if(performance.now()-started>=8){
          onProgress(next.value);
          await new Promise(resolve=>setTimeout(resolve,12));
          started=performance.now();
        }
      }
    }finally{iterator.return();}
  }
  function decodeStartingState(text,{draftOnly=false}={}){
    const {snapshot,legacy}=parseArchive(text),{original,encodings}=snapshot.session;
    const term=draftOnly?null:original;
    return {...snapshot,session:{original:term,encodings,steps:0,dirty:draftOnly||snapshot.session.dirty,halt:''},
      term,trace:Trace.create(term),hasSession:draftOnly||!legacy};
  }
  const API={MAX_BYTES,ast,validate,encode,encodeBackup,decode,decodeAsync,decodeStartingState};root.LambdaSnapshot=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
