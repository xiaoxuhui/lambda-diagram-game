(function () {
  'use strict';
  const C=window.LambdaCore, D=window.LambdaDiagram, P=window.LambdaPresets;
  const $=id=>document.getElementById(id);
  const input=$('expression');
  const state={ term:null, original:null, history:[], paths:null, dirty:false, running:false, timer:null,
    mode:'free', level:0, completed:new Set(), halt:'', scale:1, autoFit:true, model:null, speed:600, strategy:'normal', direction:'left',numberEncoding:'decimal',decimalPlaces:6,fast:false };
  let toastTimer,workspace,viewer,historySource=null,renderedCount=0,diagramTerm=null,diagramRoute=null;
  const decodedTerms=new WeakMap(),TRUE=C.parse(P.TRUE),FALSE=C.parse(P.FALSE),IDENTITY=C.parse(P.I);
  const diagramView=window.LambdaDiagramView.init($('diagram-mount'));
  function save() { workspace?.queueSave(); }
  function capture() {
    return {draft:input.value,completed:[...state.completed],mode:state.mode,level:state.level,
      session:{original:state.original,steps:Math.max(0,state.history.length-1),dirty:state.dirty,halt:state.halt,...(state.paths?{paths:state.paths}:{} )},
      view:{speed:state.speed,strategy:state.strategy,direction:state.direction,numberEncoding:state.numberEncoding,decimalPlaces:state.decimalPlaces,scale:state.scale,autoFit:state.autoFit,panX:$('diagram-viewport').scrollLeft,panY:$('diagram-viewport').scrollTop,historyOpen:$('history-details').open,helpOpen:!$('help-panel').hidden,hintOpen:!$('hint').hidden},
      selection:{start:input.selectionStart,end:input.selectionEnd},error:$('error-message').hidden?'':$('error-message').textContent};
  }
  function applySnapshot(s) {
    $('example-info').hidden=true;
    stop();input.value=s.draft;state.completed=new Set(s.completed);state.mode=s.mode;state.level=s.level;
    state.original=s.session.original;state.term=s.term;state.history=s.history;state.paths=s.session.paths??null;state.dirty=s.session.dirty;state.halt=s.session.halt;
    state.scale=s.view.scale;state.autoFit=s.view.autoFit;state.speed=s.view.speed;state.strategy=s.view.strategy??'normal';state.direction=s.view.direction??'left';renderSpeed();
    state.numberEncoding=s.view.numberEncoding??'decimal';state.decimalPlaces=s.view.decimalPlaces??6;
    $('history-details').open=s.view.historyOpen;$('help-panel').hidden=!s.view.helpOpen;$('help-toggle').setAttribute('aria-expanded',String(s.view.helpOpen));
    $('hint').hidden=!s.view.hintOpen;$('hint-toggle').textContent=s.view.hintOpen?'收起提示':'显示提示';$('hint-toggle').setAttribute('aria-expanded',String(s.view.hintOpen));
    $('challenge-feedback').textContent='';$('next-level').hidden=true;$('error-message').textContent=s.error;$('error-message').hidden=!s.error;
    renderMode();if(s.hasSession)render();else convert();input.setSelectionRange(s.selection.start,s.selection.end);
    if(!state.term){$('zoom-label').textContent=`${Math.round(state.scale*100)}%`;$('fit').setAttribute('aria-pressed',String(state.autoFit));}
    $('diagram-viewport').scrollLeft=s.view.panX;$('diagram-viewport').scrollTop=s.view.panY;
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false;
    toastTimer=setTimeout(()=>$('toast').hidden=true,2400);
  }
  function stop() { clearTimeout(state.timer); state.timer=null; state.running=false;state.fast=false; }
  function changed() {
    $('example-info').hidden=true;
    stop(); state.dirty=true; state.halt=''; $('error-message').hidden=true;
    $('challenge-feedback').textContent=''; $('next-level').hidden=true;
    $('char-count').textContent=`${input.value.length} 字符`;
    save(); render();
  }
  function insert(text) {
    const start=input.selectionStart,end=input.selectionEnd;
    input.setRangeText(text,start,end,'end');
    input.focus();
    changed();
  }
  function convert() {
    stop(); $('error-message').hidden=true; state.halt='';
    $('challenge-feedback').textContent=''; $('next-level').hidden=true;
    try {
      if(state.numberEncoding==='decimal'&&!$('decimal-places').checkValidity())throw new C.LambdaError('除法小数位数需为非负整数。');
      const parsed=state.numberEncoding==='decimal'?C.parseInput(input.value):C.parse(input.value),expanded=workspace?workspace.expand(parsed):parsed;
      const term=expanded;
      state.term=term; state.original=term; state.history=[{term,change:null}]; state.paths=null;state.dirty=false;
      state.autoFit=true; render(); save(); return true;
    } catch(e) {
      state.term=null; state.original=null; state.history=[];state.paths=null; state.dirty=true;
      $('error-message').textContent=(e.position!==null&&e.position!==undefined?`第 ${e.position+1} 个字符：`:'')+e.message;
      $('error-message').hidden=false; render(); input.focus();
      if(e.position!==null&&e.position!==undefined) input.setSelectionRange(e.position,e.position+1);
      return false;
    }
  }
  function renderDiagram(redex) {
    const mount=$('diagram-mount');
    const route=state.dirty?null:redex?.path??null;
    diagramView.setEnabled(!state.dirty);
    mount.style.opacity=state.dirty?'0.35':'1';
    if(state.term&&diagramTerm===state.term&&(route===diagramRoute||(route&&diagramRoute&&route.length===diagramRoute.length&&route.every((part,i)=>part===diagramRoute[i])))){
      applyScale();return;
    }
    diagramTerm=state.term;diagramRoute=route;
    const anchor=state.autoFit?null:viewer?.anchor();
    if(!state.term) { diagramView.clear(); $('diagram-empty').hidden=false; state.model=null; return; }
    $('diagram-empty').hidden=true;
    state.model=D.layout(state.term,route);diagramView.render(state.model);
    mount.style.opacity=state.dirty?'0.35':'1';
    applyScale();
    viewer?.restore(anchor);
  }
  function applyScale() {
    if(!state.model) return;
    const viewport=$('diagram-viewport'),m=state.model;
    if(state.autoFit) state.scale=Math.min(2.2,(viewport.clientWidth-48)/m.width,(viewport.clientHeight-48)/m.height);
    state.scale=Math.max(.02,Math.min(16,state.scale));
    const svg=$('diagram-mount').querySelector('svg');
    svg.setAttribute('width',Math.round(m.width*state.scale)); svg.setAttribute('height',Math.round(m.height*state.scale));
    $('zoom-label').textContent=`${Math.round(state.scale*100)}%`;
    $('fit').setAttribute('aria-pressed',String(state.autoFit));
  }
  function decode(t) {
    if(decodedTerms.has(t))return decodedTerms.get(t);
    const decimal=window.LambdaDecimal.read(t);if(decimal){const text=decimal.error?`错误：${decimal.error}`:`小数 ${window.LambdaDecimal.format(decimal)}`;decodedTerms.set(t,text);return text;}
    const number=C.churchNumber(t);let text;
    if(C.equal(t,FALSE))text='FALSE / Church 数 0';
    else if(C.equal(t,TRUE))text='TRUE · 选择第一个';
    else if(number!==null)text=`Church 数 ${number}`;
    else if(C.equal(t,IDENTITY))text='I · 恒等函数';
    else{
      const M=window.LambdaPolynomial,rational=M.readRational(t),polynomial=rational?null:M.readPolynomial(t);
      if(rational)text=`有理数 ${M.formatRational(rational)}`;
      else if(polynomial?.length)text=`多项式：${M.formatPolynomial(polynomial)}`;
      else{const free=C.freeVars(t);text=free.size?`${free.size} 个自由变量`:'闭合表达式';}
    }
    decodedTerms.set(t,text);return text;
  }
  function code(text) { const el=document.createElement('code'); el.textContent=text; return el; }
  function render() {
    $('number-encoding').value=state.numberEncoding;$('decimal-places').value=state.decimalPlaces;
    $('number-note').textContent=state.numberEncoding==='decimal'?`列表小数：支持负数。四则示例直接填入完整 λ 表达式。除法示例生成 ${state.decimalPlaces} 位小数，未除尽标≈；改位数后请重新选择示例，已有文本保持不变。`:'丘奇兼容模式：只接受自然数，保留旧示例与存档的编码；可切回列表小数。';
    const ready=state.term&&!state.dirty, redex=state.term?C.findRedex(state.term,[],state.strategy,state.direction):null;
    $('reduction-order').value=state.strategy;
    $('reduction-direction').value=state.direction;
    const side=state.direction==='right'?'右':'左';
    $('strategy-hint').textContent=state.strategy==='normal'?`先替换最${side}侧外层项，再处理内部。`:`先归约最${side}侧内部项，再做外层替换。`;
    const count=Math.max(0,state.history.length-1);
    $('char-count').textContent=`${input.value.length} 字符`;
    $('step-count').textContent=count; $('run-label').textContent=state.running?'暂停':'运行';
    $('run').firstElementChild.textContent=state.running?'Ⅱ':'▶';
    $('run').disabled=!ready;
    $('fast-run').disabled=!ready;$('fast-run').textContent=state.running&&state.fast?'暂停快速运行':'快速运行';
    $('step').disabled=!ready||state.running;
    $('back').disabled=!ready||count===0||state.running;
    $('reset').disabled=!ready||state.running||count===0;
    $('export-svg').disabled=!ready; $('zoom-in').disabled=!state.term; $('zoom-out').disabled=!state.term; $('fit').disabled=!state.term;$('actual-size').disabled=!state.term;
    const badge=$('state-badge'); badge.className='state-badge';
    if(!state.term) { badge.textContent='等待输入'; badge.classList.add('dirty'); }
    else if(state.dirty) { badge.textContent='已编辑 · 请转换'; badge.classList.add('dirty'); }
    else if(state.running) badge.textContent='正在归约';
    else if(state.halt) { badge.textContent='已暂停'; badge.classList.add('error'); }
    else if(!redex) badge.textContent='已到正规形';
    else badge.textContent='可以归约';
    $('run-status').textContent=!state.term?'输入有效表达式后，就能开始运行。':state.dirty?'输入已改变。重新转换后开始新的归约。':
      state.halt|| (state.running?'自动运行中；粉色线路标记下一次函数替换。':!redex?'已到 β 正规形；可点击单步或运行再次尝试，不能归约时保持当前式。':count?'可以继续单步，或回退查看上一帧。':'准备好了。点击单步，观察一次函数替换。');
    $('current-expression').textContent=state.term?C.format(state.term):'—';
    $('decoded').textContent=ready?decode(state.term):'';
    const next=$('next-explanation'); next.replaceChildren();
    if(ready&&redex) {
      next.append('下一步：用 ',code(C.format(redex.term.arg)),' 替换函数体中自由出现的 ',code(redex.term.fn.param),'。必要时自动改名，避免变量捕获。');
    } else if(ready) next.textContent='归约会检查函数、参数和 λ 函数体。整个表达式都不能归约时，当前式保持不变。';
    $('history-count').textContent=`${count} 次替换`;
    const history=$('history-list');
    if(historySource!==state.history){history.replaceChildren();renderedCount=0;historySource=state.history;}
    while(renderedCount>state.history.length){history.lastElementChild.remove();renderedCount--;}
    for(let i=renderedCount;i<state.history.length;i++){
      const entry=state.history[i];
      const li=document.createElement('li'),num=document.createElement('span'),body=document.createElement('div');
      num.textContent=String(i).padStart(2,'0');body.append(code(C.format(entry.term)));
      if(entry.change) { const note=document.createElement('small'); note.textContent=`${entry.change.param} ← ${C.format(entry.change.argument)}`;body.append(note); }
      li.append(num,body);history.append(li);renderedCount++;
    }
    renderDiagram(redex);
    save();
  }
  function advance(path=null,display=true) {
    if(!state.term||state.dirty) return false;
    try {
      const selected=Array.isArray(path),result=selected?C.stepAt(state.term,path):C.step(state.term,state.strategy,state.direction); if(!result){stop();if(display)render();return false;}
      const recordPath=selected||state.strategy==='applicative'||state.direction==='right';
      if(recordPath&&!state.paths)state.paths=Array(state.history.length-1).fill(null);
      if(state.paths)state.paths.push(recordPath?result.path:null);
      state.term=result.term;state.history.push({term:result.term,change:result});state.halt='';
      // The preview is only a hint: confirm with an actual attempt before stopping.
      if(state.running&&!C.findRedex(state.term,[],state.strategy,state.direction)&&C.step(state.term,state.strategy,state.direction)===null)stop();
      if(display)render(); return true;
    } catch(e) {stop();state.halt=e.message;if(display)render();return false;}
  }
  function captureTap(target){const selection=diagramView.selection(target);return !state.dirty&&selection?{...selection,term:state.term}:null;}
  function manualStep(selection){if(!selection||state.dirty||selection.term!==state.term)return;stop();advance(selection.path);}
  function schedule() {
    state.timer=setTimeout(()=>{if(!state.running)return;
      if(state.fast){const started=performance.now();do{if(!advance(null,false))break;}while(state.running&&performance.now()-started<8);render();if(state.running)schedule();}
      else{const more=advance();if(more&&state.running)schedule();}
    },state.fast?0:state.speed);
  }
  function renderSpeed() {
    $('speed').value=[1200,600,180,10].includes(state.speed)?String(state.speed):'custom';
    $('speed-ms').value=state.speed;$('speed-error').hidden=true;
  }
  function setSpeed(value) {
    if(!Number.isInteger(value)||value<1||value>60000){$('speed-error').textContent='每步间隔请输入 1–60000 的整数毫秒；当前仍使用上次有效速度。';$('speed-error').hidden=false;return;}
    state.speed=value;renderSpeed();if(state.running){clearTimeout(state.timer);schedule();}save();
  }
  function run() {
    if(state.running){stop();render();return;}
    if(!state.term||state.dirty) return;
    state.halt='';state.running=true;render();
    if(!C.findRedex(state.term,[],state.strategy,state.direction)){advance();if(!state.running)return;}
    schedule();
  }
  function setSource(source) { input.value=source; changed(); convert(); }
  function renderLevels() {
    const l=P.levels[state.level],stage=P.stages.find(s=>s.levelIds.includes(l.id));
    const select=$('stage-select');select.replaceChildren();
    for(const s of P.stages){
      const option=document.createElement('option'),done=s.levelIds.filter(id=>state.completed.has(id)).length;
      option.value=String(s.id);option.textContent=`第 ${s.id} 阶段 · ${s.name}（${done}/${s.levelIds.length}）`;select.append(option);
    }
    select.value=String(stage.id);
    $('stage-progress').textContent=`本阶段 ${stage.levelIds.filter(id=>state.completed.has(id)).length} / ${stage.levelIds.length} 关`;
    $('challenge-count').textContent=String(P.levels.length);
    const list=$('level-list');list.replaceChildren();
    P.levels.forEach((level,index)=>{
      if(!stage.levelIds.includes(level.id))return;
      const b=document.createElement('button');b.textContent=`${level.id} ${level.name}`;
      b.className=(index===state.level?'active ':'')+(state.completed.has(level.id)?'completed':'');
      b.setAttribute('aria-pressed',String(index===state.level));b.addEventListener('click',()=>selectLevel(index));list.append(b);
    });
    $('level-topic').textContent=`CHALLENGE ${String(l.id).padStart(2,'0')} / ${l.topic}`;
    $('level-title').textContent=l.name; $('level-description').textContent=l.description;
    $('target-label').textContent=l.targetLabel;$('target-expression').textContent=l.target;$('hint').textContent=l.hint;
    $('target-kind').textContent=l.targetType?'目标结果（归约至正规形）':'目标正规形';
    $('progress-text').textContent=state.mode==='challenge'?`${state.completed.size} / ${P.levels.length} 关已完成`:'探索 · 输入 · 归约';
  }
  function renderMode() {
    const challenge=state.mode==='challenge';$('challenge-panel').hidden=!challenge;
    $('mode-free').classList.toggle('active',!challenge);$('mode-challenge').classList.toggle('active',challenge);
    $('mode-free').setAttribute('aria-pressed',String(!challenge));$('mode-challenge').setAttribute('aria-pressed',String(challenge));
    renderLevels();
  }
  function selectLevel(index) {
    const level=P.levels[index];state.numberEncoding=level.encoding??'church';
    if(level.decimalPlaces!==undefined)state.decimalPlaces=level.decimalPlaces;
    if(level.strategy)state.strategy=level.strategy;
    if(level.direction)state.direction=level.direction;
    state.level=index;state.mode='challenge';$('hint').hidden=true;$('hint-toggle').textContent='显示提示';$('hint-toggle').setAttribute('aria-expanded','false');
    renderMode();setSource(P.sourceFor(level,state.decimalPlaces));save();
  }
  function checkAnswer() {
    const feedback=$('challenge-feedback');
    if(!state.term||state.dirty){feedback.textContent='先把当前输入转换成图示，再运行和验证。';return;}
    if(state.running){feedback.textContent='正在运行，等归约完成后再验证。';return;}
    if(C.findRedex(state.term,[],state.strategy,state.direction)){feedback.textContent='还有可归约的部分。先运行到正规形，再验证答案。';return;}
    const l=P.levels[state.level];
    if(!window.LambdaChallenges.matches(l,state.term)){feedback.textContent='这还不是目标结果。可以修改表达式，或显示提示再试一次。';return;}
    state.completed.add(l.id);save();renderLevels();
    const stage=P.stages.find(s=>s.levelIds.includes(l.id)),stageDone=stage.levelIds.every(id=>state.completed.has(id));
    feedback.textContent=state.completed.size===P.levels.length?`${P.levels.length} 关全部完成！现在可以自由实验，组合你自己的函数。`:`第 ${l.id} 关完成！${stageDone?`「${stage.name}」阶段全部完成。`:'结果与目标等价。'}`;
    $('next-level').hidden=state.level===P.levels.length-1;
    $('next-level').textContent=l.id===stage.levelIds.at(-1)?'下一阶段 →':'下一关 →';
    toast(`✓ ${l.name} · 挑战完成`);
  }
  input.addEventListener('input',changed);
  input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();convert();}});
  document.querySelectorAll('[data-insert]').forEach(b=>{
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>insert(b.dataset.insert));
  });
  const exampleGroups=new Map();
  P.examples.forEach((e,i)=>{
    const category=e.category||'入门';
    if(!exampleGroups.has(category)){const group=document.createElement('optgroup');group.label=category;exampleGroups.set(category,group);$('examples').append(group);}
    const option=document.createElement('option');option.value=i;option.textContent=e.name;exampleGroups.get(category).append(option);
  });
  $('examples').addEventListener('change',()=>{
    const value=$('examples').value;if(value==='')return;const example=P.examples[Number(value)];if(!example)return;
    state.numberEncoding=example.encoding||'church';setSource(P.sourceFor(example,state.decimalPlaces));$('examples').value='';
    const expected=example.expectedType==='decimal'?`小数 ${example.expected}`:example.expectedType==='polynomial'?`多项式：${example.expected}`:example.expectedType==='rational'?`有理数 ${example.expected}`:example.expected===undefined?'':decode(C.parse(example.expected));
    $('example-info').textContent=example.description?`${example.description} 预期结果：${expected}。`:'';
    $('example-info').hidden=!example.description;
  });
  $('convert').addEventListener('click',convert);$('step').addEventListener('click',advance);$('run').addEventListener('click',run);
  $('fast-run').addEventListener('click',()=>{if(state.running){stop();render();return;}if(!state.term||state.dirty)return;state.running=true;state.fast=true;state.halt='';render();schedule();});
  $('number-encoding').addEventListener('change',()=>{state.numberEncoding=$('number-encoding').value;changed();});
  $('decimal-places').addEventListener('input',()=>{const n=$('decimal-places').valueAsNumber;if(!Number.isSafeInteger(n)||n<0){$('decimal-places').setCustomValidity('请输入非负整数');return;}$('decimal-places').setCustomValidity('');state.decimalPlaces=n;if(state.numberEncoding==='decimal')changed();else save();});
  $('back').addEventListener('click',()=>{if(state.history.length>1){stop();state.history.pop();state.paths?.pop();state.term=state.history.at(-1).term;state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;render();}});
  $('reset').addEventListener('click',()=>{if(state.original){stop();state.term=state.original;state.history=[{term:state.original,change:null}];state.paths=null;state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;render();}});
  $('speed').addEventListener('change',()=>{if($('speed').value==='custom'){$('speed-ms').focus();$('speed-ms').select();}else setSpeed(Number($('speed').value));});
  $('speed-ms').addEventListener('input',()=>setSpeed($('speed-ms').value===''?NaN:Number($('speed-ms').value)));
  function setReductionPreference(key,value,allowed){
    if(!allowed.includes(value))return;
    state[key]=value;state.halt='';if(state.running){clearTimeout(state.timer);state.timer=null;}
    render();if(state.running)schedule();
  }
  $('reduction-order').addEventListener('change',()=>setReductionPreference('strategy',$('reduction-order').value,C.STRATEGIES));
  $('reduction-direction').addEventListener('change',()=>setReductionPreference('direction',$('reduction-direction').value,C.DIRECTIONS));
  $('diagram-mount').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){const selection=captureTap(e.target);if(selection){e.preventDefault();manualStep(selection);}}});
  viewer=window.LambdaViewport.init({getScale:()=>state.scale,canInteract:()=>!!state.model,onChange:save,captureTap,onTap:manualStep,
    setScale:scale=>{state.autoFit=false;state.scale=scale;applyScale();},fit:()=>{state.autoFit=true;applyScale();}});
  window.addEventListener('resize',applyScale);
  $('export-svg').addEventListener('click',()=>{
    if(!state.term||state.dirty)return;
    const content=D.svg(state.term,null,{export:true}).markup;
    window.LambdaDownload.save('lambda-diagram.svg',content,'image/svg+xml');toast('SVG 图示已导出');
  });
  $('mode-free').addEventListener('click',()=>{stop();state.mode='free';renderMode();render();save();});
  $('mode-challenge').addEventListener('click',()=>selectLevel(state.level));
  $('stage-select').addEventListener('change',()=>{
    const stage=P.stages.find(s=>String(s.id)===$('stage-select').value);
    selectLevel(P.levels.findIndex(l=>l.id===stage.levelIds[0]));
  });
  $('hint-toggle').addEventListener('click',()=>{const show=$('hint').hidden;$('hint').hidden=!show;$('hint-toggle').textContent=show?'收起提示':'显示提示';$('hint-toggle').setAttribute('aria-expanded',String(show));save();});
  $('check-answer').addEventListener('click',checkAnswer);
  $('next-level').addEventListener('click',()=>selectLevel(Math.min(state.level+1,P.levels.length-1)));
  $('help-toggle').addEventListener('click',()=>{const show=$('help-panel').hidden;$('help-panel').hidden=!show;$('help-toggle').setAttribute('aria-expanded',String(show));save();});
  $('history-details').addEventListener('toggle',save);
  $('speed').addEventListener('change',save);
  workspace=window.LambdaWorkspace.init({capture,apply:applySnapshot,toast,
    getNumberEncoding:()=>state.numberEncoding,getDecimalPlaces:()=>state.decimalPlaces,
    currentExpression:()=>state.term&&!state.dirty?C.format(state.term):input.value,
    insertFunction:name=>{const start=input.selectionStart,end=input.selectionEnd;
      const before=start&&/[A-Za-z0-9_']/.test(input.value[start-1])?' ':'';
      const after=end<input.value.length&&/[A-Za-z0-9_']/.test(input.value[end])?' ':'';
      insert(before+name+after);
    }});
  if(!workspace.restoreInitial()){renderMode();convert();}
  workspace.persist();
})();
