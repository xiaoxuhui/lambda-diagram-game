(function(root) {
  'use strict';
  const C=root.LambdaCore||require('./core.js'),L=root.LambdaLibrary||require('./library.js');
  const MAX_BYTES=2*1024*1024;
  const fail=message=>{throw new C.LambdaError(`存档无效：${message}`);};
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function ast(raw) {
    let count=0;
    function walk(t,depth) {
      ++count;
      if(!object(t))fail('表达式结构不完整。');
      const name=n=>{if(typeof n!=='string'||n.length>C.LIMITS.nameChars||!/^[A-Za-z][A-Za-z0-9_']*$/.test(n))fail('变量名不合法。');return n;};
      if(t.type==='var')return C.V(name(t.name));
      if(t.type==='abs')return C.L(name(t.param),walk(t.body,depth+1));
      if(t.type==='app')return C.A(walk(t.fn,depth+1),walk(t.arg,depth+1));
      fail('未知表达式类型。');
    }
    const term=walk(raw,1);C.inspect(term);return term;
  }
  function validate(raw) {
    if(!object(raw)||raw.version!==2)fail('不支持这个存档版本。');
    if(typeof raw.draft!=='string'||raw.draft.length>10000)fail('草稿过长或缺失。');
    if(!Array.isArray(raw.functions))fail('函数库不合法。');
    const functions=raw.functions.map(f=>{if(!object(f))fail('函数定义不完整。');return {name:f.name,term:ast(f.term)};});L.validate(functions);
    if(!Array.isArray(raw.completed)||raw.completed.length>5||raw.completed.some(i=>!Number.isInteger(i)||i<1||i>5))fail('通关进度不合法。');
    if(raw.mode!=='free'&&raw.mode!=='challenge')fail('游戏模式不合法。');
    if(!Number.isInteger(raw.level)||raw.level<0||raw.level>4)fail('关卡编号不合法。');
    const s=raw.session;if(!object(s)||!Number.isSafeInteger(s.steps)||s.steps<0||typeof s.dirty!=='boolean')fail('归约状态不合法。');
    const original=s.original===null?null:ast(s.original);if(!original&&s.steps!==0)fail('没有起始表达式，无法恢复归约。');
    if(typeof s.halt!=='string'||s.halt.length>500)fail('暂停信息不合法。');
    const v=raw.view;if(!object(v)||!Number.isInteger(v.speed)||v.speed<1||v.speed>60000||!Number.isFinite(v.scale)||v.scale<.02||v.scale>16)fail('视图设置不合法。');
    const panX=v.panX??0,panY=v.panY??0;
    if(!Number.isFinite(panX)||!Number.isFinite(panY)||panX<0||panY<0||panX>5000000||panY>5000000)fail('图示位置不合法。');
    for(const field of ['autoFit','historyOpen','helpOpen','hintOpen'])if(typeof v[field]!=='boolean')fail('视图开关不合法。');
    const selection=raw.selection;if(!object(selection)||!Number.isInteger(selection.start)||!Number.isInteger(selection.end)||selection.start<0||selection.start>selection.end||selection.end>raw.draft.length)fail('光标位置不合法。');
    if(typeof raw.error!=='string'||raw.error.length>2000)fail('错误信息不合法。');
    const functionDraft=raw.functionDraft??{name:'',source:''};
    if(!object(functionDraft)||typeof functionDraft.name!=='string'||functionDraft.name.length>32||typeof functionDraft.source!=='string'||functionDraft.source.length>10000)fail('函数编辑草稿不合法。');
    return {version:2,savedAt:typeof raw.savedAt==='string'&&Number.isFinite(Date.parse(raw.savedAt))?raw.savedAt:new Date().toISOString(),draft:raw.draft,
      functions,completed:[...new Set(raw.completed)],mode:raw.mode,level:raw.level,
      session:{original,steps:s.steps,dirty:s.dirty,halt:s.halt},view:{speed:v.speed,scale:v.scale,autoFit:v.autoFit,panX,panY,historyOpen:v.historyOpen,helpOpen:v.helpOpen,hintOpen:v.hintOpen},
      selection:{start:selection.start,end:selection.end},error:raw.error,functionDraft:{name:functionDraft.name,source:functionDraft.source}};
  }
  function replay(s) {
    const history=s.session.original?[{term:s.session.original,change:null}]:[];let term=s.session.original;
    for(let i=0;i<s.session.steps;i++){const result=C.step(term);if(!result)fail('步数超过实际可归约次数。');term=result.term;history.push({term,change:result});}
    return {...s,term,history,hasSession:true};
  }
  function encode(raw) {
    const text=JSON.stringify(validate(raw));
    if(new TextEncoder().encode(text).length>MAX_BYTES)fail('文件超过 2 MiB 上限。');return text;
  }
  function decode(text) {
    if(typeof text!=='string'||text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)fail('文件超过 2 MiB 上限。');
    let raw;try{raw=JSON.parse(text);}catch{fail('不是有效的 JSON 文件。');}
    if(object(raw)&&raw.version===1) {
      const draft=typeof raw.draft==='string'&&raw.draft.length<=10000?raw.draft:'(λx.x) (λy.y)';
      const migrated={version:2,savedAt:new Date().toISOString(),draft,functions:[],completed:Array.isArray(raw.completed)?[...new Set(raw.completed.filter(i=>Number.isInteger(i)&&i>0&&i<6))]:[],
        mode:raw.mode==='challenge'?'challenge':'free',level:Number.isInteger(raw.level)&&raw.level>=0&&raw.level<5?raw.level:0,
        session:{original:null,steps:0,dirty:true,halt:''},view:{speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
      return {...validate(migrated),history:[],term:null,hasSession:false};
    }
    return replay(validate(raw));
  }
  const API={MAX_BYTES,ast,validate,encode,decode};root.LambdaSnapshot=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
