(function () {
  'use strict';
  const C=window.LambdaCore, D=window.LambdaDiagram, P=window.LambdaPresets,E=window.LambdaDataEncoding;
  const Palette=window.LambdaPalette,Trace=window.LambdaTrace,F=window.LambdaFunctionReduction;
  let functionReducer=F.create();
  function findReduction(term=state.term){return state.unfoldFunctions?functionReducer.find(term,state.strategy,state.direction):C.findRedex(term,[],state.strategy,state.direction);}
  function reductionStep(){return state.unfoldFunctions?functionReducer.step(state.term,state.strategy,state.direction):C.step(state.term,state.strategy,state.direction);}
  const $=id=>document.getElementById(id);
  const input=$('expression');
  const Definitions=window.LambdaDefinitions,definitionFeedback=$('inline-definition-feedback');
  const prepareDefinitions=(source,functions,options={})=>Definitions.prepare(source,functions,{collision:workspace?.collisionPolicy()??'skip',encodings:dataEditor.entries(),encoding:state.numberEncoding,numberFormats:state.numberFormats,prepareTerm:(term,entries)=>window.LambdaGuide.compileInterpreterCall(term,entries,value=>window.LambdaLibrary.expand(value,entries)),...options});
  function showDefinitions(result){definitionFeedback.textContent=window.LambdaLibrary.importFeedback(result);definitionFeedback.hidden=false;}
  function exampleFreeNames(source){
    const text=source.trim();for(const example of P.examples.filter(example=>example.metaInterpreter||example.name==='防止变量捕获'))if([P.inputSourceFor(example,state.decimalPlaces),window.LambdaGuide.lesson(example,state.decimalPlaces).compact].some(value=>value?.trim()===text))return [...C.freeVars(C.parse(example.metaInput??example.term))];return [];
  }
  window.LambdaCombinatorCompiler.initCatalog($('combinator-catalog'));
  const valueButton=$('decimal-value'),valueResult=$('decimal-value-result'),valueDetails=$('normal-form');
  const interpretedDetails=$('interpreted-result'),interpretedExpression=$('interpreted-expression');
  let valueJob=null,valueSource=null,normalForm=null,valueResume=null;
  let interpretedSource=null,interpretedTerm=null;
  let repeatedTerm=null,runGuard=null;
  const Guard=window.LambdaRunGuard;
  let labPan=null;
  const state={ term:null, original:null, inputCall:null, history:Trace.create(), dirty:false, running:false, timer:null,
    mode:'free', level:0, completed:new Set(), halt:'', scale:1, autoFit:true, model:null, speed:600, strategy:'normal', direction:'left',numberEncoding:'church',numberFormats:{},decimalPlaces:6,decimalDigitsOrder:'forward',growthWindowMs:Guard.DEFAULT_MS,unfoldFunctions:false,dataAsFunctions:true,compilerSpecial:true,functionDefinitions:[],fast:false,encodings:null,encodingBusy:false };
  let toastTimer,workspace,viewer,dataEditor,formatEditor,guide,sequenceEditor=null,conversionController=null,compilingDefinitions=null,preparationTimer=null,historySource=null,renderedCount=0,diagramTerm=null,diagramRoute=null;
  const RUN_PAINT_INTERVAL=120;
  // 用 λ 解释 λ 时，解释器程序本身就得上万步，且在构造正常形的过程中栈一定持续变长。
  // 观察窗口默认 1 秒会把这类有限但很长的解释过程误判成"持续增长"而暂停，
  // 所以程序模式至少用界面允许的最大窗口（30 秒）：发散仍会被拦下，只是不再秒级误伤。
  const PROGRAM_GROWTH_WINDOW=30000;
  const INLINE_HISTORY_NODES=256;
  const HISTORY_PAGE_SIZE=32;
  let historyPage=null,shownStart=0,rewindJob=null,historyJob=null,openHistoryEntry=null;
  let lastRunPaint=0,diagramHistoryIndex=-1,diagramHistory=null,diagramPalette=null;
  let palette=Palette.defaults,paletteFrame=null;
  let decodedTerms=new WeakMap();
  const TRUE=C.parse(P.TRUE),FALSE=C.parse(P.FALSE),IDENTITY=C.parse(P.I);
  const diagramView=window.LambdaDiagramView.init($('diagram-mount'));
  const paletteEditor=Palette.init($('diagram-palette'),colors=>{
    applyPalette(colors);
    if(paletteFrame===null)paletteFrame=requestAnimationFrame(()=>{
      paletteFrame=null;
      renderDiagram(state.term&&!state.dirty?findReduction():null,0);
    });
    save();
  });
  function applyPalette(colors){
    palette=colors;
    const style=$('diagram-palette').closest('.diagram-card').style;
    style.setProperty('--diagram-binding',colors.binders[0]);
    style.setProperty('--diagram-highlight',colors.highlight);
  }
  const encodingProgress=document.createElement('p');encodingProgress.className='syntax-note';encodingProgress.id='encoding-progress';encodingProgress.setAttribute('role','status');encodingProgress.hidden=true;
  const cancelEncoding=document.createElement('button');cancelEncoding.type='button';cancelEncoding.id='cancel-encoding';cancelEncoding.className='button';cancelEncoding.textContent='取消数字编码';cancelEncoding.hidden=true;$('convert').after(encodingProgress,cancelEncoding);
  function cancelConversion(){clearTimeout(preparationTimer);preparationTimer=null;conversionController?.abort();conversionController=null;compilingDefinitions=null;state.encodingBusy=false;encodingProgress.hidden=true;cancelEncoding.hidden=true;}
  function queueLiteralPreparation(){clearTimeout(preparationTimer);if(E.isLiteral(input.value,dataEditor.entries(),state.numberFormats))preparationTimer=setTimeout(prepareLiteral,180);}
  async function prepareLiteral(){
    cancelConversion();const controller=new AbortController();conversionController=controller;compilingDefinitions=new Map(dataEditor.entries().map(entry=>[entry.name,entry]));
    try{
      const compiled=await E.compile(input.value,dataEditor.entries(),state.numberEncoding,{numberFormats:state.numberFormats,signal:controller.signal,onProgress:literal=>{encodingProgress.hidden=false;cancelEncoding.hidden=false;encodingProgress.textContent=`正在准备数字编码 ${literal.number}_${literal.name} · ${literal.steps} 步`;}});
      if(controller.signal.aborted||conversionController!==controller)return;
      if(compiled.mappings.some(mapping=>!dataEditor.entries().some(entry=>entry.name===mapping.name&&entry.term===mapping.definition)))return;
      dataEditor.remember(compiled.mappings);encodingProgress.hidden=false;encodingProgress.textContent=compiled.partial.length?'已按设定步数归约，剩余表达式可在图示中继续运行。':compiled.deferred.length?'自定义编码保留未归约表达式，点击「转换成图示」后运行。':'数字编码已归约就绪，点击「转换成图示」后显示。';cancelEncoding.hidden=true;save();
    }catch(error){if(!controller.signal.aborted){encodingProgress.hidden=false;encodingProgress.textContent=error.message;cancelEncoding.hidden=true;}}
    finally{if(conversionController===controller){conversionController=null;compilingDefinitions=null;cancelEncoding.hidden=true;}}
  }
  cancelEncoding.addEventListener('click',()=>{cancelConversion();render();});
  function save() { workspace?.queueSave(); }
  function capture() {
    return {...dataEditor.capture(),draft:input.value,completed:[...state.completed],mode:state.mode,level:state.level,
      session:{original:state.original,...(state.functionDefinitions.length?{functionDefinitions:state.functionDefinitions}:{}),steps:Math.max(0,state.history.length-1),dirty:state.dirty,halt:state.halt,...(state.encodings===null?{}:{encodings:state.encodings}),...(state.history.choices.length?{choices:state.history.choices}:{})},
      view:{...(sequenceEditor?{sequenceDraft:sequenceEditor.capture()}:{}),growthWindowMs:state.growthWindowMs,speed:state.speed,strategy:state.strategy,direction:state.direction,unfoldFunctions:state.unfoldFunctions,dataAsFunctions:state.dataAsFunctions,compilerSpecial:state.compilerSpecial,numberEncoding:state.numberEncoding,numberFormats:state.numberFormats,inputFormatDraft:formatEditor.capture(),guideExample:guide.capture(),decimalPlaces:state.decimalPlaces,decimalDigitsOrder:state.decimalDigitsOrder,...(palette===Palette.defaults?{}:{palette}),scale:state.scale,autoFit:state.autoFit,panX:labPan?.x??$('diagram-viewport').scrollLeft,panY:labPan?.y??$('diagram-viewport').scrollTop,historyOpen:$('history-details').open,helpOpen:!$('help-panel').hidden,hintOpen:!$('hint').hidden},
      selection:{start:input.selectionStart,end:input.selectionEnd},error:$('error-message').hidden?'':$('error-message').textContent};
  }
  function applySnapshot(s) {
    state.inputCall=window.LambdaGuide.pendingCall(s.draft,s.functions);
    cancelRewind();
    cancelConversion();
    viewer?.cancelZoom();
    diagramView.cancelTransition();
    $('example-info').hidden=true;
    stop();input.value=s.draft;state.completed=new Set(s.completed);state.mode=s.mode;state.level=s.level;
    revealAnswer(false);
    state.functionDefinitions=s.session.functionDefinitions??[];functionReducer=F.create(state.functionDefinitions);
    state.original=s.session.original;state.term=s.term;state.history=s.trace??Trace.create(s.session.original,state.functionDefinitions);state.dirty=s.session.dirty;state.halt=s.session.halt;
    state.scale=s.view.scale;state.autoFit=s.view.autoFit;state.speed=s.view.speed;state.strategy=s.view.strategy??'normal';state.direction=s.view.direction??'left';state.unfoldFunctions=s.view.unfoldFunctions??false;state.dataAsFunctions=s.view.dataAsFunctions??true;state.compilerSpecial=s.view.compilerSpecial??true;renderSpeed();
    const implicitFunctions=!state.unfoldFunctions&&state.functionDefinitions.length>0;
    if(implicitFunctions)state.dirty=true;
    state.growthWindowMs=s.view.growthWindowMs??Guard.DEFAULT_MS;$('growth-window').value=String(state.growthWindowMs);
    labPan=['guide','library'].includes(s.mode)?{x:s.view.panX,y:s.view.panY}:null;
    state.numberEncoding=s.view.numberEncoding??'church';state.numberFormats=s.view.numberFormats??{};state.decimalPlaces=s.view.decimalPlaces??6;
    state.decimalDigitsOrder=s.view.decimalDigitsOrder??'reverse';
    decodedTerms=new WeakMap();interpretedSource=null;
    state.encodings=s.session.encodings??null;dataEditor.restore(s);formatEditor.restore(s.view.inputFormatDraft);
    guide.restore(s.view.guideExample);
    sequenceEditor?.restore(s.view.sequenceDraft);
    applyPalette(s.view.palette??Palette.defaults);paletteEditor.restore(palette);
    $('history-details').open=s.view.historyOpen;$('help-panel').hidden=!s.view.helpOpen;$('help-toggle').setAttribute('aria-expanded',String(s.view.helpOpen));
    $('hint').hidden=!s.view.hintOpen;$('hint-toggle').textContent=s.view.hintOpen?'收起提示':'显示提示';$('hint-toggle').setAttribute('aria-expanded',String(s.view.hintOpen));
    $('challenge-feedback').textContent='';$('next-level').hidden=true;$('error-message').textContent=s.error;$('error-message').hidden=!s.error;
    let definitionDraft=false;try{definitionDraft=!E.isLiteral(input.value,dataEditor.entries(),state.numberFormats)&&Definitions.parseProgram(input.value).definitions.length>0;}catch{definitionDraft=true;}
    if(!s.hasSession&&definitionDraft)state.dirty=true;
    renderMode();if(s.hasSession||definitionDraft)render();else convert();input.setSelectionRange(s.selection.start,s.selection.end);
    if(implicitFunctions)toast('旧会话的隐式函数定义与历史已保留。点击「转换成图示」即可按关闭状态生成普通 λ 表达式。');
    if(!state.term){$('zoom-label').textContent=`${Math.round(state.scale*100)}%`;$('fit').setAttribute('aria-pressed',String(state.autoFit));}
    $('diagram-viewport').scrollLeft=s.view.panX;$('diagram-viewport').scrollTop=s.view.panY;
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false;
    toastTimer=setTimeout(()=>$('toast').hidden=true,2400);
  }
  function stop() { clearTimeout(state.timer); state.timer=null; state.running=false;state.fast=false;repeatedTerm=null;runGuard=null; }
  function cancelRewind(){rewindJob?.abort();rewindJob=null;}
  function changed() {
    definitionFeedback.hidden=true;
    cancelRewind();
    cancelConversion();
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
  async function convert() {
    cancelRewind();
    cancelConversion();const controller=new AbortController();conversionController=controller;let showedProgress=false;
    diagramView.cancelTransition();
    compilingDefinitions=new Map(dataEditor.entries().map(entry=>[entry.name,entry]));
    stop(); $('error-message').hidden=true; state.halt='';state.dirty=true;
    $('challenge-feedback').textContent=''; $('next-level').hidden=true;
    try {
      if(state.numberEncoding==='decimal'&&!$('decimal-places').checkValidity())throw new C.LambdaError('输出小数位数需为非负整数。');
      const before=workspace?.functionEntries()??[],policy=workspace?.collisionPolicy()??'skip',staged=await prepareDefinitions(input.value,before,{signal:controller.signal,onProgress:literal=>{if(!showedProgress){state.encodingBusy=true;render();showedProgress=true;}encodingProgress.hidden=false;cancelEncoding.hidden=false;encodingProgress.textContent=`正在自动编码 ${literal.number}_${literal.name} · ${literal.steps} 步`;}}),compiled=staged.compiled;
      if(controller.signal.aborted||conversionController!==controller)return false;
      if(staged.mappings.some(mapping=>!dataEditor.entries().some(entry=>entry.name===mapping.name&&entry.term===mapping.definition)))return false;
      if(!compiled){workspace.commitFunctions(staged.functions,before,policy);dataEditor.remember(staged.mappings);showDefinitions(staged.result);definitionFeedback.textContent+=' 末行可追加要运行的算式。';render();save();return true;}
      state.inputCall=window.LambdaGuide.pendingCall(compiled.term,staged.functions);
      const preserve=staged.program.definitions.length?[]:exampleFreeNames(input.value),expanded=term=>window.LambdaLibrary.expand(term,staged.functions,{preserve});
      const interpreted=window.LambdaGuide.compileInterpreterCall(compiled.term,staged.functions,expanded);
      const parsed=window.LambdaMeta.repair(interpreted,expanded);
      if(interpreted!==compiled.term)toast('解释器输入已自动编码，环境已封装；运行时执行解释并还原表达式。');
      else if(parsed!==compiled.term){
        input.value=C.format(parsed);
        toast('解释器表达式已更新，待计算表达式会在解释器内部执行。');
      }
      const base=state.unfoldFunctions&&parsed===compiled.term?{term:parsed,definitions:F.capture(parsed,staged.functions.filter(fn=>!preserve.includes(fn.name)))}:{term:parsed===compiled.term?expanded(parsed):parsed,definitions:[]};
      const linked=state.unfoldFunctions?P.prepare(base.term,base.definitions):{term:P.preparePlain(base.term),definitions:[]};
      const prepared=state.unfoldFunctions&&state.dataAsFunctions?F.prepare(linked.term,linked.definitions,staged.dataTerms):linked;
      if(staged.program.definitions.length){workspace.commitFunctions(staged.functions,before,policy);showDefinitions(staged.result);}
      dataEditor.remember(staged.mappings);
      state.functionDefinitions=prepared.definitions;
      functionReducer=F.create(state.functionDefinitions);
      const term=prepared.term;
      viewer?.cancelZoom();
      workspace?.beginSession();
      state.decimalDigitsOrder='forward';
      decodedTerms=new WeakMap();
      state.term=term; state.original=term; state.history=Trace.create(term,state.functionDefinitions);state.dirty=false;state.encodingBusy=false;state.encodings=[...new Set([...compiled.encodings,...window.LambdaLibrary.encodingsFor(parsed,staged.functions)])];
      state.autoFit=true; render(); save(); return true;
    } catch(e) {
      if(e.name==='AbortError'||controller.signal.aborted)return false;
      viewer?.cancelZoom();
      state.term=null; state.original=null; state.history=Trace.create();state.dirty=true;state.encodings=null;state.encodingBusy=false;
      $('error-message').textContent=(e.position!==null&&e.position!==undefined?`第 ${e.position+1} 个字符：`:'')+e.message;
      $('error-message').hidden=false; render(); input.focus();
      if(e.position!==null&&e.position!==undefined) input.setSelectionRange(e.position,e.position+1);
      return false;
    } finally {
      if(conversionController===controller){conversionController=null;compilingDefinitions=null;state.encodingBusy=false;encodingProgress.hidden=true;cancelEncoding.hidden=true;if(showedProgress&&state.dirty)render();}
    }
  }
  function renderDiagram(redex, duration, undone) {
    if(['guide','library'].includes(state.mode))return;
    const mount=$('diagram-mount');
    const route=state.dirty?null:redex?.path??null;
    diagramView.setEnabled(!state.dirty);
    mount.style.opacity=state.dirty?'0.35':'1';
    const historyIndex=state.history.length-1;
    const sameHistory=duration>0&&diagramHistory===state.history;
    const reverse=sameHistory&&undone&&historyIndex===diagramHistoryIndex-1;
    const change=reverse?undone:sameHistory&&historyIndex===diagramHistoryIndex+1
      ?state.history.peek(historyIndex).change:null;
    diagramHistory=state.history;diagramHistoryIndex=historyIndex;
    if(!change&&state.term&&diagramTerm===state.term&&diagramPalette===palette&&(route===diagramRoute||(route&&diagramRoute&&route.length===diagramRoute.length&&route.every((part,i)=>part===diagramRoute[i])))){
      applyScale();restoreLabPan();return;
    }
    diagramTerm=state.term;diagramRoute=route;diagramPalette=palette;
    const anchor=state.autoFit?null:viewer?.anchor();
    if(!state.term) { diagramView.clear(); $('diagram-empty').hidden=false; state.model=null; return; }
    $('diagram-empty').hidden=true;
    const previous=duration>0?diagramView.captureFrame():null;
    state.model=D.layout(state.term,route,palette,state.unfoldFunctions?state.functionDefinitions.map(fn=>fn.name):[]);diagramView.render(state.model);
    mount.style.opacity=state.dirty?'0.35':'1';
    applyScale();
    viewer?.restore(anchor);
    diagramView.transitionFrom(previous,duration,change,reverse);
    restoreLabPan();
  }
  function restoreLabPan(){
    if(!labPan)return;
    $('diagram-viewport').scrollLeft=labPan.x;$('diagram-viewport').scrollTop=labPan.y;labPan=null;
  }
  function applyScale() {
    if(!state.model||['guide','library'].includes(state.mode)) return;
    const viewport=$('diagram-viewport'),m=state.model;
    if(state.autoFit) state.scale=Math.min(2.2,(viewport.clientWidth-48)/m.width,(viewport.clientHeight-48)/m.height);
    state.scale=Math.max(.02,Math.min(16,state.scale));
    const svg=$('diagram-mount').querySelector('svg');
    const width=String(Math.round(m.width*state.scale)),height=String(Math.round(m.height*state.scale));
    if(svg.getAttribute('width')!==width||svg.getAttribute('height')!==height){
      diagramView.cancelTransition();
      svg.setAttribute('width',width);svg.setAttribute('height',height);
    }
    $('zoom-label').textContent=`${Math.round(state.scale*100)}%`;
    $('fit').setAttribute('aria-pressed',String(state.autoFit));
  }
  function describeInterpretation(term){
    const decimal=window.LambdaDecimal.read(term,{legacyOnly:state.numberEncoding!=='decimal'&&!state.encodings?.includes('decimal'),digitsOrder:state.decimalDigitsOrder});
    if(decimal)return decimal.error?`错误：${decimal.error}`:`小数 ${window.LambdaDecimal.format(decimal)}`;
    const integer=E.readBuiltin(term,'int',{legacyOnly:state.numberEncoding!=='int'&&!state.encodings?.includes('int')});
    if(integer!==null)return integer;
    const number=C.churchNumber(term);
    return number===null?E.readChurchList(term)??C.format(term):`丘奇数 ${number}`;
  }
  function renderInterpretation(source){
    if(source===interpretedSource)return;
    interpretedSource=source;
    interpretedTerm=source?(window.LambdaMeta.readTerm(source)??(state.original&&window.LambdaMeta.isPipeline(state.original)?source:null)):null;
    interpretedDetails.hidden=!interpretedTerm;
    if(!interpretedTerm)interpretedDetails.open=false;
    interpretedExpression.textContent=interpretedTerm&&interpretedDetails.open?C.format(interpretedTerm):'';
  }
  interpretedDetails.addEventListener('toggle',()=>{
    interpretedExpression.textContent=interpretedTerm&&interpretedDetails.open?C.format(interpretedTerm):'';
  });
  function decode(t, showFreeVariables=true) {
    const interpreted=window.LambdaMeta.readTerm(t)??(state.original&&window.LambdaMeta.isPipeline(state.original)&&!C.hasRedex(t)?t:null);
    if(interpreted)return `解释器结果：${describeInterpretation(interpreted)}`;
    if(decodedTerms.has(t))return decodedTerms.get(t);
    if(state.numberEncoding==='bool'){
      const output=window.LambdaBooleanCircuits.read(t);
      if(output!==null){const text='布尔输出 '+output;decodedTerms.set(t,text);return text;}
    }
    const decimal=window.LambdaDecimal.read(t,{legacyOnly:state.numberEncoding!=='decimal'&&!state.encodings?.includes('decimal'),digitsOrder:state.decimalDigitsOrder});if(decimal){const text=decimal.error?`错误：${decimal.error}`:`小数 ${window.LambdaDecimal.format(decimal)}`;decodedTerms.set(t,text);return text;}
    const integer=E.readBuiltin(t,'int',{legacyOnly:state.numberEncoding!=='int'&&!state.encodings?.includes('int')});
    if(integer!==null){decodedTerms.set(t,integer);return integer;}
    const body=t.type==='abs'?t.body:null;
    if(body?.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='app'){
      const {fn:head,arg:tag}=body.fn.fn;
      if(head.type==='var'&&head.name===t.param&&C.equal(tag,TRUE)){
        const remainder=C.churchNumber(body.fn.arg),quotient=C.churchNumber(body.arg);
        if(remainder!==null&&quotient!==null){
          const text=`余数 ${remainder}，商 ${quotient}`;
          decodedTerms.set(t,text);return text;
        }
      }
    }
    const number=C.churchNumber(t);let text;
    if(C.equal(t,FALSE))text='FALSE / Church 数 0';
    else if(C.equal(t,TRUE))text='TRUE · 选择第一个';
    else if(number!==null)text=`Church 数 ${number}`;
    else if(C.equal(t,IDENTITY))text='I · 恒等函数';
    else{
      const M=window.LambdaPolynomial,rational=M.readRational(t),polynomial=rational?null:M.readPolynomial(t);
      if(rational)text=`有理数 ${M.formatRational(rational)}`;
      else if(polynomial?.length)text=`多项式：${M.formatPolynomial(polynomial)}`;
      else{
        text=!C.hasRedex(t)?E.readChurchList(t):null;
        if(text===null&&!showFreeVariables)return '已求得正规形';
        if(text===null){const free=C.freeVars(t);text=free.size?`${free.size} 个自由变量`:'闭合表达式';}
      }
    }
    decodedTerms.set(t,text);return text;
  }
  function code(text) { const el=document.createElement('code'); el.textContent=text; return el; }
  function updateValueButtons(){
    valueButton.textContent=valueJob?'取消求值':'快速求值';
    $('run-label').textContent=state.running?'暂停':'运行';
    $('run').title='按设定间隔逐步归约，不受快速计算增长观察窗口影响。';
  }
  function clearValue(){
    valueJob?.abort();valueJob=null;valueSource=null;normalForm=null;
    valueResume?.(false);valueResume=null;$('continue-value').hidden=true;
    valueResult.hidden=true;valueDetails.hidden=true;valueDetails.open=false;
    $('normal-form-expression').textContent='';updateValueButtons();
  }
  async function evaluateValue(){
    if(valueJob){clearValue();return;}
    if(!state.term||state.dirty||state.running||rewindJob)return;
    clearValue();
    const controller=new AbortController();valueJob=controller;valueSource=state.term;
    updateValueButtons();valueResult.hidden=false;valueResult.textContent='正在求值…';
    try{
      const result=await window.LambdaLazyEval.normalize(valueSource,{signal:controller.signal,growthWindowMs:0,waitWindowMs:()=>state.growthWindowMs,functions:state.unfoldFunctions?state.functionDefinitions:[],onPause:progress=>{
        if(valueJob!==controller||controller.signal.aborted)return false;
        valueResult.textContent=progress.message;$('continue-value').hidden=false;
        return new Promise(resolve=>{valueResume=resolve;});
      }});
      if(valueJob===controller){
        normalForm=result;
        valueResult.textContent=state.inputCall?.message??decode(result,false);
        valueDetails.hidden=false;
      }
    }catch(error){
      if(valueJob===controller)valueResult.textContent=error.message;
    }finally{
      if(valueJob===controller){valueJob=null;$('continue-value').hidden=true;valueResume=null;updateValueButtons();}
    }
  }
  valueButton.addEventListener('click',evaluateValue);
  $('continue-value').addEventListener('click',()=>{const resume=valueResume;valueResume=null;$('continue-value').hidden=true;valueResult.textContent='继续求值中…';resume?.(true);});
  $('growth-window').addEventListener('change',()=>{state.growthWindowMs=Number($('growth-window').value);runGuard?.reset(C.inspect(state.term).nodes);save();});
  valueDetails.addEventListener('toggle',()=>{
    const expression=$('normal-form-expression');
    if(normalForm&&valueDetails.open&&!expression.textContent)expression.textContent=C.format(window.LambdaMeta.readTerm(normalForm)??normalForm);
  });
  function showHistoryEntry(body,entry) {
    body.replaceChildren(code(C.format(entry.term)));
    if(entry.change){
      const note=document.createElement('small');
      note.textContent=`${entry.change.param} ← ${C.format(entry.change.argument)}`;
      body.append(note);
    }
  }
  function historyButton(index){
    const button=document.createElement('button');button.type='button';button.textContent='查看此步';
    button.dataset.historyStep=index;
    return button;
  }
  $('history-list').addEventListener('click',async event=>{
    const button=event.target.closest('[data-history-step]');
    if(!button)return;
    historyJob?.abort();
    const trace=state.history,index=Number(button.dataset.historyStep),controller=new AbortController();
    historyJob=controller;
    button.disabled=true;button.textContent='正在重算…';
    try{
      const entry=trace.peek(index)??await trace.replay(index,{signal:controller.signal});
      if(controller.signal.aborted||!button.isConnected)return;
      if(openHistoryEntry?.body.isConnected)openHistoryEntry.body.replaceChildren(historyButton(openHistoryEntry.index));
      const body=button.parentElement;
      showHistoryEntry(body,entry);
      openHistoryEntry={body,index};
    }catch(error){if(!controller.signal.aborted)toast(error.message);}
    finally{
      button.disabled=false;button.textContent='查看此步';
      if(historyJob===controller)historyJob=null;
    }
  });
  function renderHistory(){
    const trace=state.history,history=$('history-list'),lastPage=Math.max(0,Math.floor((trace.length-1)/HISTORY_PAGE_SIZE));
    const changed=historySource!==trace;
    if(changed)historyPage=null;
    if(historyPage!==null&&historyPage>=lastPage)historyPage=null;
    const page=historyPage??lastPage,start=page*HISTORY_PAGE_SIZE,end=Math.min(trace.length,start+HISTORY_PAGE_SIZE);
    if(changed||shownStart!==start){
      historyJob?.abort();openHistoryEntry=null;
      history.replaceChildren();renderedCount=start;shownStart=start;historySource=trace;
    }
    while(renderedCount>end){history.lastElementChild.remove();renderedCount--;}
    if(openHistoryEntry&&!openHistoryEntry.body.isConnected)openHistoryEntry=null;
    const interpreter=state.original&&window.LambdaMeta.isProgram(state.original);
    const rows=document.createDocumentFragment();
    for(;renderedCount<end;renderedCount++){
      const entry=trace.peek(renderedCount);
      const li=document.createElement('li'),num=document.createElement('span'),body=document.createElement('div');
      num.textContent=String(renderedCount).padStart(2,'0');
      const nodes=entry?C.inspect(entry.term).nodes+(entry.change?C.inspect(entry.change.argument).nodes:0):Infinity;
      if(interpreter||nodes>INLINE_HISTORY_NODES)body.append(historyButton(renderedCount));
      else showHistoryEntry(body,entry);
      li.append(num,body);rows.append(li);
    }
    if(rows.firstChild)history.append(rows);
    $('history-pages').hidden=lastPage===0;
    $('history-range').textContent=`第 ${start}–${end-1} 步`;
    $('history-older').disabled=page===0;
    $('history-newer').disabled=page===lastPage;
    $('history-jump').max=Math.max(0,trace.length-1);
  }
  $('history-older').addEventListener('click',()=>{historyPage=shownStart/HISTORY_PAGE_SIZE-1;renderHistory();});
  $('history-newer').addEventListener('click',()=>{historyPage=shownStart/HISTORY_PAGE_SIZE+1;renderHistory();});
  $('history-jump').addEventListener('change',event=>{
    const input=event.target;
    if(input.validity.valid&&!Number.isNaN(input.valueAsNumber)){
      historyPage=Math.floor(input.valueAsNumber/HISTORY_PAGE_SIZE);renderHistory();
    }
  });
  function render(duration=0,undone=null) {
    formatEditor?.render();
    $('number-encoding').value=state.numberEncoding;$('decimal-places').value=state.decimalPlaces;
    const builtinNotes={
      church:'当前编码：丘奇自然数。直接写3，也可写3_church或3_丘奇数。带后缀的数字使用指定编码，例如0.1_decimal。',
      decimal:`当前编码：列表小数。数位按书写顺序排列，例如0.125 = λk.k true [0,1,2,5] 3；true为正，false为负。可写0.1、-2或0.1_decimal。除法、根号和三角函数的第一个参数指定输出小数位数；默认${state.decimalPlaces}位。`,
      list:'当前编码：丘奇列表。123 编码成数位列表 [1, 2, 3]。可以直接写 [12, 3] 或 []。',
      bool:'当前编码：丘奇布尔。0 表示假，1 表示真，也可以写 0_bool 或 1_bool。',
      int:'当前编码：丘奇整数。结构为 λk.k 正负标记 绝对值，不含ID；true为正，false为负。可以写-3或-3_int。'
    };
    $('number-note').textContent=builtinNotes[state.numberEncoding]??`当前编码：${state.numberEncoding.slice(7)}。直接写3即可转换，也可写3_${state.numberEncoding.slice(7)}；用3_church或3_丘奇数指定丘奇数。`;
    const ready=state.term&&!state.dirty, redex=state.term?findReduction():null;
    if(valueSource&&(valueSource!==state.term||!ready||state.running))clearValue();
    valueButton.hidden=!ready;
    valueButton.disabled=!!state.running||!!rewindJob;
    $('reduction-order').value=state.strategy;
    $('reduction-direction').value=state.direction;
    $('unfold-functions').checked=state.unfoldFunctions;
    $('data-functions-control').hidden=!state.unfoldFunctions;
    $('data-as-functions').checked=state.dataAsFunctions;
    $('compiler-special').checked=state.compilerSpecial;
    $('data-as-functions').disabled=!state.unfoldFunctions;
    const side=state.direction==='right'?'右':'左';
    $('strategy-hint').textContent=state.strategy==='normal'?`先替换最${side}侧外层项，再处理内部。`:`先归约最${side}侧内部项，再做外层替换。`;
    const count=Math.max(0,state.history.length-1);
    $('char-count').textContent=`${input.value.length} 字符`;
    $('step-count').textContent=count;updateValueButtons();
    $('run').firstElementChild.textContent=state.running?'Ⅱ':'▶';
    $('run').disabled=!ready||!!rewindJob;
    $('fast-run').disabled=!ready||!!rewindJob;$('fast-run').textContent=state.running&&state.fast?'暂停快速运行':'快速运行';
    $('step').disabled=!ready||state.running||!!rewindJob;
    $('back').disabled=!ready||count===0||state.running||!!rewindJob;
    $('reset').disabled=!ready||state.running||count===0;
    $('export-svg').disabled=!ready; $('zoom-in').disabled=!state.term; $('zoom-out').disabled=!state.term; $('fit').disabled=!state.term;$('actual-size').disabled=!state.term;
    const badge=$('state-badge'); badge.className='state-badge';
    if(state.encodingBusy)badge.textContent='数字编码中';
    else if(!state.term) { badge.textContent='等待输入'; badge.classList.add('dirty'); }
    else if(state.dirty) { badge.textContent='已编辑 · 请转换'; badge.classList.add('dirty'); }
    else if(state.running) badge.textContent='正在归约';
    else if(state.halt) { badge.textContent='已暂停'; badge.classList.add('error'); }
    else if(!redex) badge.textContent=state.inputCall?'等待参数':'已到正规形';
    else badge.textContent='可以归约';
    $('run-status').textContent=rewindJob?'正在重算上一帧…':state.encodingBusy?'正在自动归约数字编码，完成后显示图示。':!state.term?'输入有效表达式后，就能开始运行。':state.dirty?'输入已改变。重新转换后开始新的归约。':
      state.halt|| (state.running?'自动运行中。高亮线路标记下一次函数替换。':state.inputCall?state.inputCall.message:!redex?'已到 β 正规形；可点击单步或运行再次尝试，不能归约时保持当前式。':count?'可以继续单步，或回退查看上一帧。':'准备好了。点击单步，观察一次函数替换。');
    $('current-expression').textContent=state.term?C.format(state.term):'—';
    $('expression-encoding').textContent=!state.term?'':state.encodings===null?'编码：旧存档保留原表达式':state.encodings.length?`数字来源编码：${state.encodings.map(E.label).join('、')}${state.encodings.includes('decimal')&&state.decimalDigitsOrder==='reverse'?'（旧数位顺序，原表达式保留）':''}`:'编码：纯 λ 表达式（无数字字面量）';
    const customNames=state.encodings?.filter(name=>!E.isBuiltin(name))??[];
    const hasCustomData=customNames.length>0;
    for(const name of state.encodings??[])if(E.isBuiltin(name)&&dataEditor.entries().some(entry=>entry.name===name))customNames.push(name);
    if(!state.encodings?.length&&state.numberEncoding.startsWith('custom:'))customNames.push(state.numberEncoding.slice(7));
    const matches=ready&&!redex?E.lookup(state.term,dataEditor.entries(),customNames):[];
    const selectedBuiltin=state.encodings?.length===1?state.encodings[0]:!state.encodings?.length?state.numberEncoding:null;
    const builtInResult=ready&&!redex
      ?E.readBuiltin(state.term,selectedBuiltin)??(state.encodings?.includes('list')?E.readChurchList(state.term):null)
      :null;
    renderInterpretation(ready&&!redex?state.term:null);
    $('decoded').textContent=ready&&state.inputCall?state.inputCall.message:interpretedTerm?`解释器结果：${describeInterpretation(interpretedTerm)}`:ready&&!(state.running&&redex)?(matches.length?matches.map(match=>`${match.number}_${match.name}`).join(' / ')+(matches.length>1?'（多项匹配）':''):builtInResult??(hasCustomData?'自定义数据':decode(state.term))):'';
    const next=$('next-explanation'); next.replaceChildren();
    if(ready&&redex?.kind==='unfold'){
      next.append('下一步：展开函数 ',code(redex.term.name),'，随后继续按所选顺序归约。');
    }else if(ready&&redex) {
      next.append('下一步：用 ',code(C.format(redex.term.arg)),' 替换函数体中自由出现的 ',code(redex.term.fn.param),'。必要时自动改名，避免变量捕获。');
    } else if(ready) next.textContent='归约会检查函数、参数和 λ 函数体。整个表达式都不能归约时，当前式保持不变。';
    $('history-count').textContent=`${count} 次替换`;
    renderHistory();
    renderDiagram(redex,duration,undone);
    save();
  }
  function advance(path=null,display=true,kind=null) {
    if(!state.term||state.dirty||rewindJob) return false;
    try {
      const selected=Array.isArray(path),result=selected?(kind==='unfold'?functionReducer.unfoldAt(state.term,path):C.stepAt(state.term,path)):reductionStep(); if(!result){stop();if(display)render();return false;}
      const choice=result.kind==='unfold'?{unfold:result.path}:selected||state.unfoldFunctions?result.path:state.strategy==='normal'&&state.direction==='left'?null:`${state.strategy}:${state.direction}`;
      state.term=result.term;state.history.append(result,choice);state.halt='';
      // The preview is only a hint: confirm with an actual attempt before stopping.
      if(state.running&&!findReduction()&&reductionStep()===null)stop();
      else if(repeatedTerm?.(state.term,result)){
        const growth=repeatedTerm.reason==='growth';
        stop();state.halt=growth?'检测到递归展开无限增长，自动运行已停止。可以回退、单步或调整归约顺序。':'检测到重复归约循环，自动运行已停止。可以回退、单步或调整归约顺序。';
      }
      else if(state.fast&&runGuard?.check(C.inspect(state.term).nodes)){
        stop();state.halt=Guard.message+' 点击快速运行可从当前步骤继续。';
      }
      if(display)render(180); return true;
    } catch(e) {stop();state.halt=e.message;if(display)render();return false;}
  }
  function captureTap(target){const selection=diagramView.selection(target);return !state.dirty&&selection?{...selection,term:diagramTerm}:null;}
  function manualStep(selection){if(!selection||state.dirty||selection.term!==state.term)return;stop();advance(selection.path,true,selection.kind);}
  function schedule(delay=0) {
    state.timer=setTimeout(()=>{if(!state.running)return;
      const started=performance.now();
      const interval=state.fast?RUN_PAINT_INTERVAL:Math.max(state.speed,RUN_PAINT_INTERVAL);
      do {
        if(!advance(null,false))break;
      } while(state.running&&state.fast&&performance.now()-started<8);
      if(!state.running||performance.now()-lastRunPaint>=interval-4){
        if(state.running&&state.fast&&window.LambdaMeta.isProgram(state.original)){
          $('step-count').textContent=state.history.length-1;
          save();
        }else render(Math.min(180,interval*.8));
        lastRunPaint=performance.now();
      }
      if(state.running)schedule((performance.now()-started)*1.5);
    },Math.max(delay,state.fast?12:state.speed));
  }
  function renderSpeed() {
    $('speed').value=[1200,600,180,10].includes(state.speed)?String(state.speed):'custom';
    $('speed-ms').value=state.speed;$('speed-error').hidden=true;
  }
  function setSpeed(value) {
    if(!Number.isInteger(value)||value<1||value>60000){$('speed-error').textContent='每步间隔请输入 1–60000 的整数毫秒；当前仍使用上次有效速度。';$('speed-error').hidden=false;return;}
    state.speed=value;renderSpeed();if(state.running){clearTimeout(state.timer);schedule();}save();
  }
  async function run(fast=false) {
    if(state.running){stop();render(100);return;}
    if(!state.term||state.dirty||rewindJob) return;
    if(window.LambdaMeta.needsRepair(state.original)&&!await convert())return;
    const interpreter=window.LambdaMeta.isProgram(state.original);
    if(interpreter){
      if(state.strategy!=='normal'||state.direction!=='left')toast('解释器已切换到从左到右的正规序。');
      state.strategy='normal';state.direction='left';
    }
    state.halt='';state.running=true;state.fast=fast;repeatedTerm=C.cycleCheck(state.term);
    // 快速运行解释器程序时，一个观察窗口内会推进上万步且栈必然变长；
    // 默认 1 秒窗口会把有限但很长的解释误判成持续增长，程序模式至少用界面允许的最大窗口。
    runGuard=state.fast?Guard.create({windowMs:()=>window.LambdaMeta.isProgram(state.original)?Math.max(state.growthWindowMs,PROGRAM_GROWTH_WINDOW):state.growthWindowMs,initial:C.inspect(state.term).nodes}):null;
    lastRunPaint=performance.now();render();
    if(!findReduction()){advance();if(!state.running)return;}
    schedule();
  }
  function setSource(source) { input.value=source; changed(); return convert(); }
  const teachingText=text=>window.LambdaGuide.catalog().text(text);
  function revealAnswer(show) {
    const level=P.levels[state.level];$('challenge-target').hidden=!show;
    $('answer-toggle').textContent=show?'收起答案':'查看答案';$('answer-toggle').setAttribute('aria-expanded',String(show));
    $('target-label').textContent=show?teachingText(level.targetLabel):'';$('target-expression').textContent=show?level.target:'';
  }
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
    $('level-topic').textContent=`CHALLENGE ${String(l.id).padStart(2,'0')} / ${teachingText(l.topic)}`;
    $('level-title').textContent=l.name; $('level-description').textContent=teachingText(l.description);
    revealAnswer(!$('challenge-target').hidden);$('hint').textContent=teachingText(l.hint);
    $('target-kind').textContent=l.targetType?'目标结果（归约至正规形）':'目标正规形';
    $('progress-text').textContent=state.mode==='challenge'?`${state.completed.size} / ${P.levels.length} 关已完成`:state.mode==='guide'?`${P.examples.length} 个示例原理`:state.mode==='library'?'按示例 · 按章节 · 全部加入':'探索 · 输入 · 归约';
  }
  function renderMode() {
    const reading=['guide','library'].includes(state.mode);
    if(reading&&!$('lab-screen').hidden){
      viewer?.cancelZoom();diagramView.cancelTransition();
      labPan??={x:$('diagram-viewport').scrollLeft,y:$('diagram-viewport').scrollTop};
    }
    $('lab-screen').hidden=reading;document.querySelector('.save-bar').hidden=reading;
    document.querySelector('.intro').hidden=reading;
    document.body.classList.toggle('guide-reading',reading);
    const challenge=state.mode==='challenge';$('challenge-panel').hidden=!challenge;
    $('guide-panel').hidden=state.mode!=='guide';
    $('library-panel').hidden=state.mode!=='library';
    for(const [id,mode] of [['mode-free','free'],['mode-challenge','challenge'],['mode-guide','guide'],['mode-library','library']]){
      const active=state.mode===mode;$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));
    }
    if(state.mode==='guide')guide.refresh();
    renderLevels();
  }
  function selectLevel(index) {
    const level=P.levels[index];state.numberEncoding=level.encoding??'church';
    if(level.decimalPlaces!==undefined)state.decimalPlaces=level.decimalPlaces;
    if(level.strategy)state.strategy=level.strategy;
    if(level.direction)state.direction=level.direction;
    state.level=index;state.mode='challenge';revealAnswer(false);$('hint').hidden=false;$('hint-toggle').textContent='收起提示';$('hint-toggle').setAttribute('aria-expanded','true');
    renderMode();setSource(P.inputSourceFor(level,state.decimalPlaces));save();
  }
  function checkAnswer() {
    const feedback=$('challenge-feedback');
    if(!state.term||state.dirty){feedback.textContent='先把当前输入转换成图示，再运行和验证。';return;}
    if(state.running||valueJob){feedback.textContent='正在运行，等归约完成后再验证。';return;}
    const result=normalForm??state.term;
    if(findReduction(result)){feedback.textContent='还有可归约的部分。先运行到正规形，再验证答案。';return;}
    const l=P.levels[state.level];
    if(!window.LambdaChallenges.matches(l,result)){feedback.textContent='这还不是目标结果。可以修改表达式，或显示提示再试一次。';return;}
    state.completed.add(l.id);save();renderLevels();
    const stage=P.stages.find(s=>s.levelIds.includes(l.id)),stageDone=stage.levelIds.every(id=>state.completed.has(id));
    feedback.textContent=state.completed.size===P.levels.length?`${P.levels.length} 关全部完成！现在可以自由实验，组合你自己的函数。`:`第 ${l.id} 关完成！${stageDone?`「${stage.name}」阶段全部完成。`:'结果与目标等价。'}`;
    $('next-level').hidden=state.level===P.levels.length-1;
    $('next-level').textContent=l.id===stage.levelIds.at(-1)?'下一阶段 →':'下一关 →';
    toast(`✓ ${l.name} · 挑战完成`);
  }
  input.addEventListener('input',event=>{changed();if(!event.isComposing)queueLiteralPreparation();});
  input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();convert();}});
  async function compileCombinators(basis='optimized'){
    const specialize=state.compilerSpecial,simplify=specialize&&basis==='sk',collision=workspace.collisionPolicy();
    stop();cancelConversion();
    const controller=new AbortController(),entries=dataEditor.entries(),source=input.value,functions=workspace.functionEntries(),buttons=[$('compile-combinators'),$('compile-sk'),$('compile-bckw')];
    conversionController=controller;compilingDefinitions=new Map(entries.map(entry=>[entry.name,entry]));buttons.forEach(button=>button.disabled=true);$('compiler-special').disabled=true;
    try{
      const staged=await prepareDefinitions(source,functions,{signal:controller.signal}),parsed=staged.compiled;
      if(!parsed)throw new C.LambdaError('请在定义后写出要编译的算式；只保存函数可点“保存等号定义”。');
      const preserve=staged.program.definitions.length?[]:exampleFreeNames(source),expanded=term=>window.LambdaLibrary.expand(term,staged.functions,{preserve}),syntax=window.LambdaGuide.compileInterpreterCall(parsed.term,staged.functions,expanded);
      const result=await window.LambdaCombinatorCompiler.compileTerm(syntax===parsed.term?expanded(parsed.term):syntax,{basis,simplify,specialize,collision,functions:staged.functions,signal:controller.signal,onProgress:()=>{
        encodingProgress.hidden=false;cancelEncoding.hidden=false;encodingProgress.textContent='正在外部编译组合子…';
      }});
      if(controller.signal.aborted||conversionController!==controller||input.value!==source)return;
      const current=workspace.functionEntries();
      if(current.length!==functions.length||current.some((fn,index)=>fn!==functions[index]))throw new C.LambdaError('函数库已修改，请重新编译。');
      if(workspace.collisionPolicy()!==collision)throw new C.LambdaError('重名处理方式已改变，请重新编译。');
      const imported=window.LambdaLibrary.importDefinitions(staged.functions,result.definitions,null,{collision});workspace.commitFunctions(imported.functions,functions,collision);dataEditor.remember(staged.mappings);
      input.value=result.source;changed();workspace.persist();
      if(staged.program.definitions.length)showDefinitions(staged.result);
      $('combinator-status').hidden=false;$('combinator-status').textContent=result.used.length?`已在外部编译${basis==='sk'?'为 SK':basis==='bckw'?'为 BCKW':''}；算式使用 ${result.used.join('、')}。缺少的定义已加入函数库，可编辑和删除。`:'编译完成，输入不需要组合子。';
      if(result.ready.length)$('combinator-status').textContent+=' 已有相同定义，已准备好：'+result.ready.join('、')+'。';
      if(result.reused.length)$('combinator-status').textContent+=' 已直接使用同名函数：'+result.reused.join('、')+'（沿用现有定义）。';
      if(imported.replaced.length)$('combinator-status').textContent+=' 重名已替换：'+imported.replaced.join('、')+'。';
      $('combinator-status').textContent+=specialize?' 当前使用特殊化简。':' 当前使用普通转换（无特殊化简）。';
      input.focus();input.setSelectionRange(input.value.length,input.value.length);
      toast('编译完成，点击「转换成图示」后运行。');
    }catch(error){
      if(controller.signal.aborted)return;
      $('error-message').textContent=error.message;$('error-message').hidden=false;
      $('combinator-status').textContent=error.message;$('combinator-status').hidden=false;
    }finally{buttons.forEach(button=>button.disabled=false);$('compiler-special').disabled=false;if(conversionController===controller)cancelConversion();}
  }
  $('compile-combinators').addEventListener('click',()=>compileCombinators());
  $('compile-sk').addEventListener('click',()=>compileCombinators('sk'));
  $('compile-bckw').addEventListener('click',()=>compileCombinators('bckw'));
  $('compiler-special').addEventListener('change',()=>{state.compilerSpecial=$('compiler-special').checked;save();});
  $('compile-meta-lambda').addEventListener('click',async()=>{
    cancelConversion();
    const controller=new AbortController(),entries=dataEditor.entries();
    conversionController=controller;compilingDefinitions=new Map(entries.map(entry=>[entry.name,entry]));
    try{
      const compiled=await E.compile(input.value,entries,state.numberEncoding,{
        numberFormats:state.numberFormats,signal:controller.signal,onProgress:literal=>{
          encodingProgress.hidden=false;cancelEncoding.hidden=false;
          encodingProgress.textContent=`正在准备解释器输入 ${literal.number}_${literal.name} · ${literal.steps} 步`;
        }
      });
      if(controller.signal.aborted||conversionController!==controller)return;
      const named=window.LambdaGuide.compileInterpreterCall(compiled.term,workspace.functionEntries(),term=>workspace.expand(term));
      const program=named!==compiled.term?named:window.LambdaMeta.compileTerm(compiled.term,term=>workspace.expand(term));
      dataEditor.remember(compiled.mappings);
      input.value=C.format(program);changed();
      toast('解释器表达式已生成，请点击「转换成图示」。');
    }catch(error){
      if(controller.signal.aborted)return;
      $('error-message').textContent=error.message;
      $('error-message').hidden=false;
      input.focus();
      if(error.position!=null)input.setSelectionRange(error.position,error.position+1);
    }finally{
      if(conversionController===controller)cancelConversion();
    }
  });
  $('edit-meta-source').addEventListener('click',()=>{
    try{
      const parsed=E.parse(input.value,dataEditor.entries(),Infinity,state.numberEncoding,state.numberFormats).term;
      const named=window.LambdaGuide.compileInterpreterCall(parsed,workspace.functionEntries(),term=>workspace.expand(term));
      const example=P.examples.find(item=>item.metaInterpreter&&P.inputSourceFor(item,state.decimalPlaces)===input.value);
      const source=example?example.metaInput:window.LambdaMeta.sourceOf(named!==parsed?C.format(named):input.value);
      if(source!==input.value){input.value=source;changed();}
      input.focus();
    }catch(error){
      $('error-message').textContent=error.message;
      $('error-message').hidden=false;
      input.focus();
      if(error.position!=null)input.setSelectionRange(error.position,error.position+1);
    }
  });
  document.querySelectorAll('[data-insert]').forEach(b=>{
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>insert(b.dataset.insert));
  });
  const exampleGroups=new Map();
  P.examples.forEach((e,i)=>{
    const category=e.category||'入门';
    if(!exampleGroups.has(category)){const group=document.createElement('optgroup');group.label=category;exampleGroups.set(category,group);$('examples').append(group);}
    const option=document.createElement('option');option.value=i;option.textContent=window.LambdaGuide.titleFor(e);exampleGroups.get(category).append(option);
  });
  function loadExample(){
    const value=$('examples').value;if(value==='')return;const example=P.examples[Number(value)];if(!example)return;
    state.numberEncoding=example.encoding||'church';const converted=setSource(P.inputSourceFor(example,state.decimalPlaces));
    const truncated=window.LambdaDecimal.precisionOperations.has(example.decimalOperation)&&state.decimalPlaces!==6;
    const expected=example.expectedType==='decimal'?(truncated?'按设置的小数位数截断':`小数 ${example.expected}`):example.expectedType==='polynomial'?`多项式：${example.expected}`:example.expectedType==='rational'?`有理数 ${example.expected}`:example.expected===undefined?'':decode(C.parse(example.expected));
    const info=$('example-info'),parameters=P.parametersFor(example,state.decimalPlaces);
    info.replaceChildren();
    if(parameters.length){
      const guide=document.createElement('strong');
      guide.textContent=`式子末尾从左到右是${parameters.join('、')}。改参数时保留前面的 λ 程序。`;
      info.append(guide,document.createElement('br'));
    }
    if(example.description)info.append(`${window.LambdaGuide.lesson(example).purpose} 预期结果为${example.expectedLabel||expected}。`);
    const doc=window.LambdaGuide.lesson(example,state.decimalPlaces),selectedNames=window.LambdaGuide.libraryNames(doc);
    if(selectedNames.length){
      const add=document.createElement('button'),feedback=document.createElement('span');
      add.type='button';add.id='example-add-library';add.className='button';add.textContent='将此示例函数加入函数库';
      feedback.id='example-library-feedback';feedback.setAttribute('role','status');
      const exactNote=document.createElement('p');exactNote.className='syntax-note';exactNote.textContent='逐个导入示例原始定义，并逐字核对；同名原文不一致会停止，选择“重名替换”才覆盖。';info.append(exactNote);
      add.addEventListener('click',()=>{
        try{
          const result=workspace.importDefinitions(doc.symbols,null,{exact:true});
          feedback.textContent=window.LambdaLibrary.importFeedback(result);
          const calls=selectedNames.map(name=>result.bindings[name]??name).filter(name=>result.added.includes(name)||result.replaced.includes(name)||result.ready.includes(name)||result.reused.includes(name));
          if(calls.length)feedback.textContent+=' 可调用：'+calls.join('、')+'。';
        }catch(error){feedback.textContent='加入失败：'+error.message;}
      });
      workspace.attachCollisionControls(info);info.append(document.createElement('br'),add,document.createElement('br'),feedback);
    }
    info.hidden=!info.hasChildNodes();
    return converted;
  }
  $('examples').addEventListener('change',()=>{
    $('example-fast-run').disabled=$('examples').value==='';loadExample();
  });
  $('example-fast-run').addEventListener('click',async()=>{
    const value=$('examples').value,example=value===''?null:P.examples[Number(value)];if(!example)return;
    const button=$('example-fast-run');button.disabled=true;
    try{
      state.mode='free';renderMode();
      if(await loadExample())await run(true);
    }finally{button.disabled=$('examples').value==='';}
  });
  $('convert').addEventListener('click',convert);$('step').addEventListener('click',advance);$('run').addEventListener('click',()=>run());
  $('save-inline-definitions').addEventListener('click',async()=>{
    cancelConversion();const controller=new AbortController();conversionController=controller;const source=input.value,before=workspace.functionEntries(),policy=workspace.collisionPolicy(),button=$('save-inline-definitions');button.disabled=true;$('error-message').hidden=true;
    try{
      if(!Definitions.parseProgram(source).definitions.length)throw new C.LambdaError('请先在输入框写“名称 = 表达式”，每行一个定义。');
      const staged=await prepareDefinitions(source,before,{compileExpression:false,signal:controller.signal,onProgress:literal=>{encodingProgress.hidden=false;cancelEncoding.hidden=false;encodingProgress.textContent=`正在准备函数中的数字编码 ${literal.number}_${literal.name} · ${literal.steps} 步`;}});
      if(controller.signal.aborted||conversionController!==controller||input.value!==source)return;
      workspace.commitFunctions(staged.functions,before,policy);dataEditor.remember(staged.mappings);showDefinitions(staged.result);workspace.persist();
    }catch(error){if(!controller.signal.aborted){$('error-message').textContent=error.message;$('error-message').hidden=false;}}
    finally{button.disabled=false;if(conversionController===controller)cancelConversion();}
  });
  $('fast-run').addEventListener('click',()=>run(true));
  $('number-encoding').addEventListener('change',()=>{const previous=state.numberEncoding;state.numberEncoding=$('number-encoding').value;dataEditor.select(state.numberEncoding);if(previous!==state.numberEncoding){changed();queueLiteralPreparation();}else{render();save();}});
  $('decimal-places').addEventListener('input',()=>{const n=$('decimal-places').valueAsNumber;if(!Number.isSafeInteger(n)||n<0){$('decimal-places').setCustomValidity('请输入非负整数');return;}$('decimal-places').setCustomValidity('');state.decimalPlaces=n;if(state.numberEncoding==='decimal')changed();else save();});
  $('back').addEventListener('click',async()=>{
    const trace=state.history;
    if(trace.length<=1||rewindJob)return;
    stop();
    historyJob?.abort();
    const target=trace.length-2,{change}=trace.peek(target+1);
    let frames;
    if(!trace.peek(target)){
      const controller=new AbortController();rewindJob=controller;render();
      try{frames=await trace.replay(target,{signal:controller.signal,keepRecent:true});}
      catch(error){if(!controller.signal.aborted){rewindJob=null;toast(error.message);render();}return;}
      if(controller.signal.aborted)return;
      rewindJob=null;
    }
    state.term=trace.rewind(frames).term;
    state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;
    render(180,change);
  });
  $('reset').addEventListener('click',()=>{if(state.original){cancelRewind();stop();state.term=state.original;state.history=Trace.create(state.original,state.functionDefinitions);state.halt='';$('challenge-feedback').textContent='';$('next-level').hidden=true;render(180);}});
  $('speed').addEventListener('change',()=>{if($('speed').value==='custom'){$('speed-ms').focus();$('speed-ms').select();}else setSpeed(Number($('speed').value));});
  $('speed-ms').addEventListener('input',()=>setSpeed($('speed-ms').value===''?NaN:Number($('speed-ms').value)));
  function setReductionPreference(key,value,allowed){
    if(!allowed.includes(value))return;
    if(state.running&&window.LambdaMeta.isProgram(state.original)){
      $(key==='strategy'?'reduction-order':'reduction-direction').value=state[key];
      return;
    }
    state[key]=value;state.halt='';if(state.running){clearTimeout(state.timer);state.timer=null;repeatedTerm=C.cycleCheck(state.term);}
    render();if(state.running)schedule();
  }
  $('unfold-functions').addEventListener('change',()=>{state.unfoldFunctions=$('unfold-functions').checked;changed();});
  $('data-as-functions').addEventListener('change',()=>{state.dataAsFunctions=$('data-as-functions').checked;changed();});
  $('reduction-order').addEventListener('change',()=>setReductionPreference('strategy',$('reduction-order').value,C.STRATEGIES));
  $('reduction-direction').addEventListener('change',()=>setReductionPreference('direction',$('reduction-direction').value,C.DIRECTIONS));
  $('diagram-mount').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){const selection=captureTap(e.target);if(selection){e.preventDefault();manualStep(selection);}}});
  viewer=window.LambdaViewport.init({getScale:()=>state.scale,canInteract:()=>!!state.model,onChange:save,captureTap,onTap:manualStep,
    setScale:scale=>{state.autoFit=false;state.scale=scale;applyScale();},fit:()=>{state.autoFit=true;applyScale();}});
  window.addEventListener('resize',applyScale);
  $('export-svg').addEventListener('click',()=>{
    if(!state.term||state.dirty)return;
    const content=D.svg(state.term,null,{export:true,palette}).markup;
    window.LambdaDownload.save('lambda-diagram.svg',content,'image/svg+xml');toast('SVG 图示已导出');
  });
  $('mode-free').addEventListener('click',()=>{stop();state.mode='free';renderMode();render();save();});
  $('mode-challenge').addEventListener('click',()=>selectLevel(state.level));
  $('mode-guide').addEventListener('click',()=>{
    stop();cancelRewind();cancelConversion();historyJob?.abort();if(valueJob)clearValue();
    state.mode='guide';renderMode();render();save();
  });
  $('guide-back').addEventListener('click',()=>{state.mode='free';renderMode();render();save();$('mode-guide').focus();});
  $('mode-library').addEventListener('click',()=>{
    stop();cancelRewind();cancelConversion();historyJob?.abort();if(valueJob)clearValue();
    state.mode='library';renderMode();render();save();
  });
  $('library-back').addEventListener('click',()=>{state.mode='free';renderMode();render();save();$('mode-library').focus();});
  $('stage-select').addEventListener('change',()=>{
    const stage=P.stages.find(s=>String(s.id)===$('stage-select').value);
    selectLevel(P.levels.findIndex(l=>l.id===stage.levelIds[0]));
  });
  $('hint-toggle').addEventListener('click',()=>{const show=$('hint').hidden;$('hint').hidden=!show;$('hint-toggle').textContent=show?'收起提示':'显示提示';$('hint-toggle').setAttribute('aria-expanded',String(show));save();});
  $('answer-toggle').addEventListener('click',()=>revealAnswer($('challenge-target').hidden));
  $('check-answer').addEventListener('click',checkAnswer);
  $('next-level').addEventListener('click',()=>selectLevel(Math.min(state.level+1,P.levels.length-1)));
  $('help-toggle').addEventListener('click',()=>{const show=$('help-panel').hidden;$('help-panel').hidden=!show;$('help-toggle').setAttribute('aria-expanded',String(show));save();});
  $('history-details').addEventListener('toggle',save);
  $('speed').addEventListener('change',save);
  dataEditor=window.LambdaDataEncodingEditor.init({getSelection:()=>state.numberEncoding,setSelection:value=>{state.numberEncoding=value;},getNumberFormats:()=>state.numberFormats,expand:term=>workspace?workspace.expand(term):term,queueSave:save,onChange:()=>{if(compilingDefinitions&&(compilingDefinitions.size!==dataEditor.entries().length||dataEditor.entries().some(entry=>compilingDefinitions.get(entry.name)!==entry))){changed();queueLiteralPreparation();}else{render();save();}},currentTerm:()=>state.term&&!state.dirty?F.expand(state.term,state.functionDefinitions):null,loadTerm:(term,name)=>{state.numberEncoding=`custom:${name}`;setSource(C.format(term));},toast});
  formatEditor=window.LambdaInputFormatEditor.init({getSelection:()=>state.numberEncoding,getEntries:()=>dataEditor.entries(),getNumberFormats:()=>state.numberFormats,setNumberFormats:formats=>{state.numberFormats=formats;},setCustomFormat:(name,template)=>dataEditor.setInputFormat(name,template),onChange:()=>{changed();queueLiteralPreparation();},queueSave:save,toast});
  guide=window.LambdaGuide.init({precision:()=>state.decimalPlaces,save,addFunctions:(definitions,selected,options)=>workspace.importDefinitions(definitions,selected,options),load:example=>{
    stop();state.mode='free';state.numberEncoding=example.encoding??'church';
    renderMode();setSource(P.inputSourceFor(example,state.decimalPlaces));save();
    input.focus();input.scrollIntoView({block:'center'});
  }});
  workspace=window.LambdaWorkspace.init({capture,apply:applySnapshot,toast,
    pauseForRestore:()=>{
      const busy=state.running||rewindJob||valueJob||conversionController;
      if(busy){stop();cancelRewind();cancelConversion();if(valueJob)clearValue();render();}
    },
    getNumberEncoding:()=>state.numberEncoding,getDecimalPlaces:()=>state.decimalPlaces,getDataEncodings:()=>dataEditor.entries(),
    compileSource:async(source,signal)=>{const compiled=await E.compile(source,dataEditor.entries(),state.numberEncoding,{signal,numberFormats:state.numberFormats});const term=window.LambdaGuide.compileInterpreterCall(compiled.term,workspace.functionEntries(),value=>workspace.expand(value));dataEditor.remember(compiled.mappings);return {...compiled,term};},
    currentExpression:()=>state.term&&!state.dirty?C.format(F.expand(state.term,state.functionDefinitions)):input.value,
    insertFunction:name=>{const start=input.selectionStart,end=input.selectionEnd;
      const before=start&&!/[\sλ\\.(\[]/.test(input.value[start-1])?' ':'';
      const after=end<input.value.length&&!/[\s.)\],]/.test(input.value[end])?' ':'';
      insert(before+C.formatName(name)+after);
    }});
  workspace.attachCollisionControls($('library-collision-options'));
  window.LambdaExampleLibrary.init({precision:()=>state.decimalPlaces,collisionPolicy:()=>workspace.collisionPolicy(),addFunctions:(definitions,selected,options)=>workspace.importDefinitions(definitions,selected,options)});
  sequenceEditor=window.LambdaSequences.init({functions:()=>workspace.functionEntries(),queueSave:()=>workspace.queueSave(),
    load:source=>{stop();state.mode='free';state.numberEncoding='church';renderMode();input.value=source;changed();save();},
    saveRule:async(name,source)=>{
      const functions=workspace.functionEntries(),compiled=await E.compile(source,dataEditor.entries(),'church',{numberFormats:state.numberFormats});
      const current=workspace.functionEntries();if(current.length!==functions.length||current.some((fn,index)=>fn!==functions[index]))throw new C.LambdaError('函数库已修改，请重新保存规则。');
      const unknown=[...C.freeVars(workspace.expand(compiled.term))];if(unknown.length)throw new C.LambdaError('规则含未定义名称：'+unknown.join('、')+'。请先保存依赖函数。');
      workspace.saveDefinition(name,source,compiled);dataEditor.remember(compiled.mappings);save();
    },
    guide:id=>{
      const example=P.examples.find(example=>example.sequenceId===id)??P.examples.find(example=>example.sequenceId==='A001477');
      guide.restore(example.name);stop();state.mode='guide';renderMode();render();save();
      if(example.sequenceId!==id)toast('此编号使用个人规则，当前打开的是无限列表通用原理。');
    }});
  workspace.restoreInitial().then(restored=>{
    if(!restored)sequenceEditor.refresh();
    if(!restored){renderMode();convert();workspace.persist();}
  });
})();
