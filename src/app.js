(function () {
  'use strict';
  const C=window.LambdaCore, D=window.LambdaDiagram, P=window.LambdaPresets;
  const $=id=>document.getElementById(id);
  const input=$('expression');
  const state={ term:null, original:null, history:[], dirty:false, running:false, timer:null,
    mode:'free', level:0, completed:new Set(), halt:'', scale:1, autoFit:true, model:null, speed:600 };
  let toastTimer,workspace,viewer,renderedHistory=[];
  function save() { workspace?.queueSave(); }
  function capture() {
    return {draft:input.value,completed:[...state.completed],mode:state.mode,level:state.level,
      session:{original:state.original,steps:Math.max(0,state.history.length-1),dirty:state.dirty,halt:state.halt},
      view:{speed:state.speed,scale:state.scale,autoFit:state.autoFit,panX:$('diagram-viewport').scrollLeft,panY:$('diagram-viewport').scrollTop,historyOpen:$('history-details').open,helpOpen:!$('help-panel').hidden,hintOpen:!$('hint').hidden},
      selection:{start:input.selectionStart,end:input.selectionEnd},error:$('error-message').hidden?'':$('error-message').textContent};
  }
  function applySnapshot(s) {
    stop();input.value=s.draft;state.completed=new Set(s.completed);state.mode=s.mode;state.level=s.level;
    state.original=s.session.original;state.term=s.term;state.history=s.history;state.dirty=s.session.dirty;state.halt=s.session.halt;
    state.scale=s.view.scale;state.autoFit=s.view.autoFit;state.speed=s.view.speed;renderSpeed();
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
  function stop() { clearTimeout(state.timer); state.timer=null; state.running=false; }
  function changed() {
    stop(); state.dirty=true; state.halt=''; $('error-message').hidden=true;
    $('challenge-feedback').textContent=''; $('next-level').hidden=true;
    $('char-count').textContent=`${input.value.length} / ${C.LIMITS.chars}`;
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
      const term=workspace?workspace.expand(C.parse(input.value)):C.parse(input.value);
      state.term=term; state.original=term; state.history=[{term,change:null}]; state.dirty=false;
      state.autoFit=true; render(); save(); return true;
    } catch(e) {
      state.term=null; state.original=null; state.history=[]; state.dirty=true;
      $('error-message').textContent=(e.position!==null&&e.position!==undefined?`第 ${e.position+1} 个字符：`:'')+e.message;
      $('error-message').hidden=false; render(); input.focus();
      if(e.position!==null&&e.position!==undefined) input.setSelectionRange(e.position,e.position+1);
      return false;
    }
  }
  function renderDiagram(redex) {
    const mount=$('diagram-mount');
    const anchor=state.autoFit?null:viewer?.anchor();
    if(!state.term) { mount.innerHTML=''; $('diagram-empty').hidden=false; state.model=null; return; }
    $('diagram-empty').hidden=true;
    const result=D.svg(state.term,state.dirty?null:redex?.path??null);
    state.model=result.model; mount.innerHTML=result.markup;
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
    const number=C.churchNumber(t), isTrue=C.equal(t,C.parse(P.TRUE)), isFalse=C.equal(t,C.parse(P.FALSE));
    if(isFalse) return 'FALSE / Church 数 0';
    if(isTrue) return 'TRUE · 选择第一个';
    if(number!==null) return `Church 数 ${number}`;
    if(C.equal(t,C.parse(P.I))) return 'I · 恒等函数';
    const free=[...C.freeVars(t)];
    return free.length?`${free.length} 个自由变量`:'闭合表达式';
  }
  function code(text) { const el=document.createElement('code'); el.textContent=text; return el; }
  function render() {
    const ready=state.term&&!state.dirty, redex=state.term?C.findRedex(state.term):null;
    const count=Math.max(0,state.history.length-1);
    $('char-count').textContent=`${input.value.length} / ${C.LIMITS.chars}`;
    $('step-count').textContent=count; $('run-label').textContent=state.running?'暂停':'运行';
    $('run').firstElementChild.textContent=state.running?'Ⅱ':'▶';
    $('run').disabled=!ready;
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
    if(renderedHistory.length>state.history.length||renderedHistory.some((entry,i)=>entry!==state.history[i])) {
      history.replaceChildren();renderedHistory=[];
    }
    state.history.forEach((entry,i)=>{
      if(i<renderedHistory.length)return;
      const li=document.createElement('li'),num=document.createElement('span'),body=document.createElement('div');
      num.textContent=String(i).padStart(2,'0');body.append(code(C.format(entry.term)));
      if(entry.change) { const note=document.createElement('small'); note.textContent=`${entry.change.param} ← ${C.format(entry.change.argument)}`;body.append(note); }
      li.append(num,body);history.append(li);renderedHistory.push(entry);
    });
    renderDiagram(redex);
    save();
  }
  function advance() {
    if(!state.term||state.dirty) return false;
    try {
      const result=C.step(state.term); if(!result){stop();render();return false;}
      state.term=result.term;state.history.push({term:result.term,change:result});state.halt='';
      render(); return true;
    } catch(e) {stop();state.halt=e.message;render();return false;}
  }
  function schedule() {
    state.timer=setTimeout(()=>{if(!state.running)return;const more=advance();if(more&&state.running)schedule();},state.speed);
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
    state.halt='';state.running=true;render();schedule();
  }
  function setSource(source) { input.value=source; changed(); convert(); }
  function renderLevels() {
    const list=$('level-list');list.replaceChildren();
    P.levels.forEach((level,index)=>{
      const b=document.createElement('button');b.textContent=`${level.id} ${level.name}`;
      b.className=(index===state.level?'active ':'')+(state.completed.has(level.id)?'completed':'');
      b.setAttribute('aria-pressed',String(index===state.level));b.addEventListener('click',()=>selectLevel(index));list.append(b);
    });
    const l=P.levels[state.level];
    $('level-topic').textContent=`CHALLENGE ${String(l.id).padStart(2,'0')} / ${l.topic}`;
    $('level-title').textContent=l.name; $('level-description').textContent=l.description;
    $('target-label').textContent=l.targetLabel;$('target-expression').textContent=l.target;$('hint').textContent=l.hint;
    $('progress-text').textContent=state.mode==='challenge'?`${state.completed.size} / ${P.levels.length} 关已完成`:'探索 · 输入 · 归约';
  }
  function renderMode() {
    const challenge=state.mode==='challenge';$('challenge-panel').hidden=!challenge;
    $('mode-free').classList.toggle('active',!challenge);$('mode-challenge').classList.toggle('active',challenge);
    $('mode-free').setAttribute('aria-pressed',String(!challenge));$('mode-challenge').setAttribute('aria-pressed',String(challenge));
    renderLevels();
  }
  function selectLevel(index) {
    state.level=index;state.mode='challenge';$('hint').hidden=true;$('hint-toggle').textContent='显示提示';$('hint-toggle').setAttribute('aria-expanded','false');
    renderMode();setSource(P.levels[index].start);save();
  }
  function checkAnswer() {
    const feedback=$('challenge-feedback');
    if(!state.term||state.dirty){feedback.textContent='先把当前输入转换成图示，再运行和验证。';return;}
    if(state.running){feedback.textContent='正在运行，等归约完成后再验证。';return;}
    if(C.findRedex(state.term)){feedback.textContent='还有可归约的部分。先运行到正规形，再验证答案。';return;}
    const l=P.levels[state.level];
    if(!C.equal(state.term,C.parse(l.target))){feedback.textContent='这还不是目标结果。可以修改表达式，或显示提示再试一次。';return;}
    state.completed.add(l.id);save();renderLevels();
    feedback.textContent=state.completed.size===P.levels.length?'五关全部完成！现在可以自由实验，组合你自己的函数。':`第 ${l.id} 关完成！结果与目标等价。`;
    $('next-level').hidden=state.level===P.levels.length-1;
    toast(`✓ ${l.name} · 挑战完成`);
  }
  input.addEventListener('input',changed);
  input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();convert();}});
  document.querySelectorAll('[data-insert]').forEach(b=>{
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>insert(b.dataset.insert));
  });
  P.examples.forEach((e,i)=>{const option=document.createElement('option');option.value=i;option.textContent=e.name;$('examples').append(option);});
  $('examples').addEventListener('change',()=>{const value=$('examples').value;if(value==='')return;setSource(P.examples[Number(value)].term);$('examples').value='';});
  $('convert').addEventListener('click',convert);$('step').addEventListener('click',advance);$('run').addEventListener('click',run);
  $('back').addEventListener('click',()=>{if(state.history.length>1){stop();state.history.pop();state.term=state.history.at(-1).term;state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;render();}});
  $('reset').addEventListener('click',()=>{if(state.original){stop();state.term=state.original;state.history=[{term:state.original,change:null}];state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;render();}});
  $('speed').addEventListener('change',()=>{if($('speed').value==='custom'){$('speed-ms').focus();$('speed-ms').select();}else setSpeed(Number($('speed').value));});
  $('speed-ms').addEventListener('input',()=>setSpeed($('speed-ms').value===''?NaN:Number($('speed-ms').value)));
  viewer=window.LambdaViewport.init({getScale:()=>state.scale,canInteract:()=>!!state.model,onChange:save,
    setScale:scale=>{state.autoFit=false;state.scale=scale;applyScale();},fit:()=>{state.autoFit=true;applyScale();}});
  window.addEventListener('resize',applyScale);
  $('export-svg').addEventListener('click',()=>{
    if(!state.term||state.dirty)return;
    const content=D.svg(state.term,null,{export:true}).markup;
    window.LambdaDownload.save('lambda-diagram.svg',content,'image/svg+xml');toast('SVG 图示已导出');
  });
  $('mode-free').addEventListener('click',()=>{stop();state.mode='free';renderMode();render();save();});
  $('mode-challenge').addEventListener('click',()=>selectLevel(state.level));
  $('hint-toggle').addEventListener('click',()=>{const show=$('hint').hidden;$('hint').hidden=!show;$('hint-toggle').textContent=show?'收起提示':'显示提示';$('hint-toggle').setAttribute('aria-expanded',String(show));save();});
  $('check-answer').addEventListener('click',checkAnswer);
  $('next-level').addEventListener('click',()=>selectLevel(Math.min(state.level+1,P.levels.length-1)));
  $('help-toggle').addEventListener('click',()=>{const show=$('help-panel').hidden;$('help-panel').hidden=!show;$('help-toggle').setAttribute('aria-expanded',String(show));save();});
  $('history-details').addEventListener('toggle',save);
  $('speed').addEventListener('change',save);
  workspace=window.LambdaWorkspace.init({capture,apply:applySnapshot,toast,
    currentExpression:()=>state.term&&!state.dirty?C.format(state.term):input.value,
    insertFunction:name=>{const start=input.selectionStart,end=input.selectionEnd;
      const before=start&&/[A-Za-z0-9_']/.test(input.value[start-1])?' ':'';
      const after=end<input.value.length&&/[A-Za-z0-9_']/.test(input.value[end])?' ':'';
      insert(before+name+after);
    }});
  if(!workspace.restoreInitial()){renderMode();convert();}
  workspace.persist();
})();
