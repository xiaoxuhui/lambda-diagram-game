(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const helpers=[
    ['true','λa.λb.a','选择第一项。'],['false','λa.λb.b','选择第二项。'],
    ['pair','λa.λb.λf.f a b','把两个值交给选择器。'],
    ['succ','λn.λf.λx.f (n f x)','丘奇后继。'],['add','λm.λn.λf.λx.m f (n f x)','丘奇加法。'],
    ['mul','λm.λn.λf.m (n f)','丘奇乘法。'],
    ['pred','λn.λf.λx.n (λg.λh.h (g f)) (λu.x) (λu.u)','丘奇前驱，零保持为零。'],
    ['iszero','λn.n (λx.false) true','判断丘奇数是否为零。'],
    ['sub','λm.λn.n pred m','截断自然数减法。'],['leq','λm.λn.iszero (sub m n)','判断第一个数是否不大于第二个数。'],
    ['fst','λp.p true','读取序对首项。'],['snd','λp.p false','读取序对第二项。'],
    ['nil','λc.λn.n','有限丘奇列表的结束值。'],['cons','λh.λt.λc.λn.c h (t c n)','把一个元素放在有限丘奇列表头部。'],
    ['y','λf.(λx.f (x x)) (λx.f (x x))','显式不动点组合子，提供递归。'],
    ['remainder','λm.λd.m (λr.leq d (succ r) 0 (succ r)) 0','逐次增加余数，达到除数时归零；仅在除数大于零时使用。'],
    ['primecheck','λn.leq 2 n ((pred (pred n)) (λp.pair (succ (fst p)) ((snd p) (iszero (remainder n (fst p)) false true) false)) (pair 2 true) false) false','试除 2 到 n−1；发现整除即把状态中的真假位改为假。'],
    ['nextprime','y (λr.λn.primecheck n n (r (succ n)))','从候选数开始逐个试除，返回第一个素数。'],
    ['stream','λa.y (λr.λn.pair (a n) (r (succ n)))','一个节点保存 a(n) 和从 n+1 开始的后续流；流没有空表分支。'],
    ['take','y (λr.λn.λs.iszero n nil (cons (fst s) (r (pred n) (snd s))))','只读取指定数量的节点，零项时立即返回空表，不再读取尾部。']
  ].map(([name,source,meaning])=>({name,source,meaning}));
  const builtins=[
    [4,'全零',0,'λn.0',[0,0,0,0,0,0],'a(n)=0，忽略下标。'],
    [12,'全一',0,'λn.1',[1,1,1,1,1,1],'a(n)=1，忽略下标。'],
    [27,'正整数',1,'λn.n',[1,2,3,4,5,6],'a(n)=n，从下标 1 开始。'],
    [40,'素数',1,'λn.(pred n) (λp.nextprime (succ p)) 2',[2,3,5,7,11,13],'从素数 2 开始，重复 n−1 次寻找下一个素数。候选数依次增加，以 2 到候选数减一进行试除。'],
    [45,'斐波那契',0,'λn.n (λp.pair (snd p) (add (fst p) (snd p))) (pair 0 1) true',[0,1,1,2,3,5],'状态从 (0,1) 开始，每轮 (a,b) → (b,a+b)。迭代 n 次后读取第一项。'],
    [79,'二的幂',0,'λn.n (mul 2) 1',[1,2,4,8,16,32],'从 1 开始，每轮乘 2；迭代 n 次得到 2ⁿ。'],
    [142,'阶乘',0,'λn.n (λp.pair (succ (fst p)) (mul (succ (fst p)) (snd p))) (pair 0 1) false',[1,1,2,6,24,120],'状态从 (0,1) 开始，每轮 (k,v) → (k+1,(k+1)×v)，最后读取乘积。'],
    [217,'三角数',0,'λn.n (λp.pair (succ (fst p)) (add (succ (fst p)) (snd p))) (pair 0 0) false',[0,1,3,6,10,15],'状态从 (0,0) 开始，每轮把下一个正整数加进累计和，得到 1+…+n。'],
    [290,'平方数',0,'λn.mul n n',[0,1,4,9,16,25],'用丘奇乘法计算 n×n。'],
    [578,'立方数',0,'λn.mul n (mul n n)',[0,1,8,27,64,125],'先计算 n×n，再乘 n。'],
    [1477,'非负整数',0,'λn.n',[0,1,2,3,4,5],'a(n)=n，从下标 0 开始。'],
    [5843,'非负偶数',0,'λn.add n n',[0,2,4,6,8,10],'把下标与自身相加，得到 2n。']
  ].map(([number,title,offset,source,samples,principle])=>({id:'A'+String(number).padStart(6,'0'),title,offset,source,samples,principle}));
  function normalizeId(value){
    const text=String(value).trim().replace(/^a/i,'');
    if(!/^[0-9]{1,6}$/.test(text)||Number(text)<1||Number(text)>401715)throw new C.LambdaError('请输入 1～401715 的编号，例如 45 或 A000045。');
    return 'A'+text.padStart(6,'0');
  }
  function natural(value,label){
    const text=String(value).trim();if(!/^[0-9]+$/.test(text))throw new C.LambdaError(label+'必须是非负整数。');
    return BigInt(text).toString();
  }
  function lookup(value,functions=[]){
    const id=normalizeId(value),builtin=builtins.find(entry=>entry.id===id),custom=functions.find(fn=>fn.name===id.toLowerCase());
    if(custom)return {id,title:'自定义生成规则',offset:builtin?.offset??0,source:C.format(custom.term),custom:true,principle:'按你保存的第 n 项函数生成。此规则由你定义，未核验与 OEIS 原条目是否一致。'};
    if(!builtin)throw new C.LambdaError(`${id} 尚无内置生成规则。请先填写并保存第 n 项的 λ 函数，不会用有限答案表冒充无限生成器。`);
    return builtin;
  }
  function definitions(entry){const name=entry.id.toLowerCase();return [...helpers,{name,source:entry.source,meaning:entry.principle},
    {name:name+'stream',source:`λstart.stream ${name} start`,meaning:'内部固定本编号的生成规则，只接收起始下标。'},
    {name:name+'list',source:`λstart.λcount.take count (${name}stream start)`,meaning:'在内部建立无限流并有限读取，外部只传起始下标与项数。'}];}
  function reachable(source,entries){
    const registry=new Map(entries.map(entry=>[entry.name,entry])),seen=new Set(),result=[];
    function visit(name){if(seen.has(name)||!registry.has(name))return;seen.add(name);const entry=registry.get(name);for(const dep of C.freeVars(C.parse(entry.source)))visit(dep);result.push(entry);}
    for(const name of C.freeVars(C.parse(source)))visit(name);return result;
  }
  function close(source,entries){
    const needed=reachable(source,entries);
    const text=needed.reduceRight((body,entry)=>`(λ${entry.name}.${body}) (${entry.source})`,source);
    return C.format(C.parse(text));
  }
  function ruleSource(value,functions=[]){const entry=lookup(value,functions);return close(entry.id.toLowerCase(),definitions(entry));}
  function program(value,{start,count='6',infinite=false,functions=[]}={}){
    const entry=lookup(value,functions),from=natural(start??entry.offset,'起始下标');
    if(BigInt(from)<BigInt(entry.offset))throw new C.LambdaError(`${entry.id} 从下标 ${entry.offset} 开始。`);
    const amount=infinite?null:natural(count,'项数'),name=entry.id.toLowerCase();
    const body=name+(infinite?'stream':'list');
    return {entry,start:from,count:amount,infinite,source:`(${close(body,definitions(entry))}) ${from}_church${infinite?'':` ${amount}_church`}`};
  }
  function example(entry){
    const count=entry.id==='A000040'?3:entry.id==='A000142'?4:6,p=program(entry.id,{count:String(count)}),samples=entry.samples.slice(0,count);
    return {name:`${entry.id} · ${entry.title} · 取 ${count} 项`,category:'无限列表',encoding:'church',sequenceId:entry.id,sequenceStart:String(entry.offset),sequenceCount:String(count),term:p.source.replaceAll('_church',''),expected:C.format(C.churchList(samples.map(value=>C.parse(String(value))))),expectedLabel:`丘奇列表 [${samples.join(', ')}]`,description:entry.principle+' 用有限消费者 take 取出前几项，底层流不预设长度。'};
  }
  function lesson(item){
    const entry=lookup(item.sequenceId),name=entry.id.toLowerCase(),count=item.sequenceCount,start=item.sequenceStart;
    const entries=definitions(entry),entryName=name+'list';
    const core=`${entryName} = ${entries.find(fn=>fn.name===entryName).source}\n${name}stream = ${entries.find(fn=>fn.name===name+'stream').source}\n${name} = ${entry.source}\nstream = ${helpers.find(fn=>fn.name==='stream').source}\ntake = ${helpers.find(fn=>fn.name==='take').source}`;
    const symbols=reachable(entryName,entries);
    return {core,symbols,featured:[entryName,name+'stream',name],compact:`${entryName} ${start} ${count}`,libraryEntries:[entryName],purpose:item.description,
      inputs:[{name:'start',value:start+'_church',encoding:'丘奇自然数',role:`首项的下标；本数列从 ${entry.offset} 开始`},{name:'count',value:count+'_church',encoding:'丘奇自然数',role:'只决定本次读取多少项，不是流的总长度'}],
      basics:['丘奇数 n 表示执行 n 次迭代。数列规则接收一个丘奇下标，返回该位置的丘奇自然数。','无限流使用序对保存首项和尾流；取出的有限结果使用丘奇列表。这两种结构不能直接混用。'],
      foundation:'pair = λa.λb.λf.f a b\ncons = λh.λt.λc.λn.c h (t c n)\nnil = λc.λn.n',
      principle:[entry.principle,`${entryName} 已把本编号规则、stream 和 take 固定在内部，外部只传 start 和 count。加入函数库只需保存这个入口。`,'stream a n 展开为 pair (a n) (stream a (succ n))。第二项仍是一个待求值的递归调用，没有预先生成或缓存全部后续项。','take 先检查项数。为零时返回 nil；否则读取首项，项数减一后继续读尾流。必须先套上有限消费者，再做正规序归约，才能得到有限正规形。'],
      overview:'编号选择第 n 项的 λ 规则；stream 构造没有终点的流；take 只读取指定数量并输出丘奇列表。',
      flow:{columns:['阶段','表达式','含义'],rows:[['规则',`${name} n`,entry.principle],['流节点',`stream ${name} n`,`pair (${name} n) (stream ${name} (succ n))`],['有限读取',`take ${count} (stream ${name} ${start})`,'递归次数由项数控制'],['结果',item.expectedLabel,'后续流没有被求值']]},
      steps:[['计算当前下标的项',entry.principle,`${name} = ${entry.source}`],['建立一个流节点','首项和尾流交给选择器。用 fst 取首项，用 snd 取得后续流。',`stream ${name} ${start} → pair (${name} ${start}) (stream ${name} (succ ${start}))`],['消费一个节点','仅当剩余项数不为零时取首项，并递归取得剩余有限列表。','take = '+helpers.find(fn=>fn.name==='take').source],['停止读取','剩余项数为零，直接返回空表；尾流保持未求值。','take 0 streamvalue → nil'],['读取结果',item.expectedLabel,`take ${count} (stream ${name} ${start})`]],
      walkthrough:`take ${count} (stream ${name} ${start})\n→ cons (${name} ${start}) (take (pred ${count}) (stream ${name} (succ ${start})))\n→ … → 有限丘奇列表`,
      boundaries:['选择「正规序」「从左到右」。应用序会先不断计算尾流，可能无法到达有限结果。','只载入无限流再要求完整正规形，本来就不会结束。读取更多项时增加 count，或先用 fst、snd、take 这样的消费者。','这不是 OEIS 全库的算法：仅列出已实现的规则；其他编号可在输入区保存个人 λ 规则。素数、阶乘等规则会随下标增长而需要更多归约步骤。'],
      exercise:`把项数改为 0，确认得到空表；再把起始下标从 ${start} 改为 ${BigInt(start)+1n}，观察首项如何改变。`,
      encodingText:'下标、项数和元素均使用丘奇自然数，明确写 _church，不受当前数字编码影响；输出是有限丘奇列表。',parameterNote:'数列规则、流构造与有限读取都在入口函数内部。外部只传起始下标和读取项数；无限流没有一个预设的最大项数。'};
  }
  function init(api){
    const $=id=>document.getElementById(id),id=$('sequence-id'),start=$('sequence-start'),count=$('sequence-count'),rule=$('sequence-rule'),status=$('sequence-status');
    for(const entry of builtins){const option=document.createElement('option');option.value=String(Number(entry.id.slice(1)));option.label=entry.id+' · '+entry.title;$('sequence-ids').append(option);}
    function message(text){status.textContent=text;}
    function refresh(resetStart=false){try{const entry=lookup(id.value,api.functions());if(resetStart)start.value=String(entry.offset);rule.value=ruleSource(id.value,api.functions());message(`${entry.id} · ${entry.title}；${entry.custom?'使用个人规则，未核验 OEIS 原定义':'内置可计算规则'}。`);}catch(error){rule.value='';if(resetStart)start.value='0';message(error.message);}}
    function load(infinite){try{const result=program(id.value,{start:start.value,count:count.value,infinite,functions:api.functions()});api.load(result.source);message(`${result.entry.id} 已载入${infinite?'无限流；直接求完整正规形不会结束，请先搭配有限消费者':'有限读取程序；点击转换成图示后按正规序运行'}。`);}catch(error){message(error.message);}}
    id.addEventListener('change',()=>{refresh(true);api.queueSave();});$('sequence-form').addEventListener('submit',event=>{event.preventDefault();load(false);});
    $('sequence-infinite').addEventListener('click',()=>load(true));
    $('sequence-rule-save').addEventListener('click',async()=>{const button=$('sequence-rule-save');button.disabled=true;try{const name=normalizeId(id.value).toLowerCase();await api.saveRule(name,rule.value);message(`${name.toUpperCase()} 的个人生成规则已保存到函数库；可在那里继续编辑或删除。`);}catch(error){message('保存失败：'+error.message);}finally{button.disabled=false;}});
    $('sequence-guide').addEventListener('click',()=>{try{const key=normalizeId(id.value);api.guide(key);message(key+'：原理讲解已打开。');}catch(error){message(error.message);}});
    for(const field of [id,start,count,rule])field.addEventListener('input',()=>api.queueSave());
    $('sequences-panel').addEventListener('toggle',()=>api.queueSave());
    refresh();return {refresh,capture:()=>({id:id.value,start:start.value,count:count.value,source:rule.value,open:$('sequences-panel').open}),restore:draft=>{
      if(!draft){refresh();return;}id.value=draft.id;start.value=draft.start;count.value=draft.count;rule.value=draft.source;$('sequences-panel').open=draft.open;message('已恢复数列输入与生成规则草稿。');
    }};
  }
  const API={builtins,normalizeId,lookup,program,ruleSource,example,lesson,init};root.LambdaSequences=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
