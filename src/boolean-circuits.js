(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const definitions=[
    ['TRUE','λa.λb.a','真选择第一项。'],['FALSE','λa.λb.b','假选择第二项。'],['id','λx.x','把积累的列表原样交出。'],
    ['pair','λa.λb.λk.k a b','序对把两个输出交给读取函数。'],['nil','λc.λn.n','空丘奇列表。'],['cons','λh.λt.λc.λn.c h (t c n)','将一个输出接在丘奇列表前面。'],
    ['not','λa.a FALSE TRUE','非：交换真假两个分支。'],['and','λa.λb.a b FALSE','与：第一个为真才返回第二个。'],['or','λa.λb.a TRUE b','或：第一个为真直接返回真，否则返回第二个。'],
    ['xor','λa.λb.a (not b) b','异或：第一个为真就取反第二个，否则保留第二个。'],
    ['notgate','λa.not a','非门入口。'],['andgate','λa.λb.and a b','与门入口。'],['orgate','λa.λb.or a b','或门入口。'],
    ['nand','λa.λb.not (and a b)','与非：先与，再取反。'],['nor','λa.λb.not (or a b)','或非：先或，再取反。'],
    ['xorgate','λa.λb.xor a b','异或门入口。'],['xnor','λa.λb.not (xor a b)','同或：输入相同为真。'],
    ['implies','λa.λb.a b TRUE','蕴含：只有真推出假时为假。'],
    ['flip','λf.λx.λy.f y x','C 组合子交换两个候选输入。'],
    ['mux','λs.λa.λb.flip s a b','二选一：选择位为假取 a，为真取 b。'],
    ['demux','λs.λa.pair (and (not s) a) (and s a)','一分二：用序对输出两条线，只有被选中的线接收输入。'],
    ['halfadd','λa.λb.pair (xor a b) (and a b)','半加器输出序对（和位，进位）。'],
    ['fulladd','λa.λb.λc.(halfadd a b) (λs.λk.(halfadd s c) (λr.λj.pair r (or k j)))','全加器串联两个半加器，再将两路进位做或。'],
    ['bitcmp','λa.λb.pair (and a (not b)) (pair (not (xor a b)) (and (not a) b))','一位比较输出（大于，（等于，小于））。'],
    ['bits','λn.n (λr.λout.λb.r (λtail.out (cons b tail))) (λout.out nil) id','先接收项数，再消耗恰好 n 个布尔输入，保持顺序输出列表。'],
    ['delaycollect','λn.λinitial.λfinish.n (λr.λprevious.λout.λb.r b (λtail.out (cons previous tail))) (λprevious.λout.out nil) initial finish','序列发生器：每拍输出旧值，再保存当前输入；最后调用结果读取函数。'],
    ['delayi','λn.λinitial.delaycollect n initial id','可设初始值的一拍延迟。'],['delay','λn.delayi n FALSE','默认初始值为假的一拍延迟。'],
    ['pred','λn.λf.λx.n (λg.λh.h (g f)) (λu.x) (λu.u)','丘奇前驱。'],['iszero','λn.n (λx.FALSE) TRUE','判断丘奇下标是否为零。'],
    ['bitat','λn.λl.iszero n FALSE (l (λh.λr.λk.iszero k h (r (pred k))) (λk.FALSE) (pred n))','从1开始取列表第 n 项，越界或第0项返回假。'],
    ['delayat','λn.λposition.delaycollect n FALSE (bitat position)','先传输入项数和输出位置，再传 n 个布尔值，读取指定拍的延迟输出。'],
    ['delaystep','λstate.λinput.pair state input','一拍延迟的状态转移，返回（本拍旧值，下一拍状态）。'],
    ['memorystep','λstate.λwrite.λinput.delaystep state (mux write state input)','单拍存储器：写入为真就保存输入，为假就保持；本拍输出始终是旧状态。'],
    ['memory','λn.λinitial.n (λr.λstate.λout.λwrite.λinput.(memorystep state write input) (λold.λnext.r next (λtail.out (cons old tail)))) (λstate.λout.pair (out nil) state) initial id','接收拍数、初值和每拍的写入使能与数据，返回（旧值输出列表，最终保存值）。'],
    ['memoryout','λn.λinitial.n (λr.λstate.λout.λwrite.λinput.(memorystep state write input) (λold.λnext.r next (λtail.out (cons old tail)))) (λstate.λout.out nil) initial id','读取存储器每拍的旧值输出列表。'],
    ['memoryvalue','λn.λinitial.n (λr.λstate.λwrite.λinput.(memorystep state write input) (λold.λnext.r next)) id initial','只读取最终保存值，不积累输出列表。'],
    ['allbits','λn.n (λr.λa.λb.r (and a b)) (λa.a) TRUE','n 个输入全部为真才返回真；空输入返回真。'],
    ['anybits','λn.n (λr.λa.λb.r (or a b)) (λa.a) FALSE','n 个输入至少一个为真即返回真；空输入返回假。'],
    ['parity','λn.n (λr.λa.λb.r (xor a b)) (λa.a) FALSE','依次异或，真输入个数为奇数时返回真。']
  ].map(([name,source,meaning])=>({name,source,meaning}));
  const registry=new Map(definitions.map(entry=>[entry.name,{...entry,term:C.parse(entry.source)}]));
  function reachable(name){const entries=[],seen=new Set();function visit(key){if(seen.has(key)||!registry.has(key))return;seen.add(key);const entry=registry.get(key);for(const dep of C.freeVars(entry.term))visit(dep);entries.push(entry);}visit(name);return entries;}
  function program(name,args=[]){return '('+reachable(name).reduceRight((body,entry)=>`(λ${entry.name}.${body}) (${entry.source})`,name)+')'+(args.length?' '+args.join(' '):'');}
  const boolean=value=>value?'TRUE':'FALSE',literal=value=>value?'1_bool':'0_bool';
  const list=values=>`λc.λn.${values.reduceRight((tail,value)=>`c (${registry.get(boolean(value)).source}) (${tail})`,'n')}`;
  const pair=(a,b)=>`λk.k (${a}) (${b})`,truth=value=>registry.get(boolean(value)).source;
  const signal=[true,false,true,true,false,true];
  const specs=[
    ['非门','notgate',[true],false,'交换真假选择器的候选分支。'],
    ['与门','andgate',[true,false],false,'只有两个输入都为真，输出才为真。'],
    ['或门','orgate',[false,true],true,'至少一个输入为真，输出就为真。'],
    ['与非门','nand',[true,true],false,'将与门的结果取反。'],
    ['或非门','nor',[false,false],true,'将或门的结果取反。'],
    ['异或门','xorgate',[true,false],true,'两个输入不同为真，相同为假。'],
    ['同或门','xnor',[true,true],true,'两个输入相同为真，不同为假。'],
    ['蕴含门','implies',[true,false],false,'真推出假为假，其余组合都为真。'],
    ['二选一','mux',[true,false,true],true,'参数依次是选择位、0路输入、1路输入；选择位为真取1路。'],
    ['一分二','demux',[true,true],pair(truth(false),truth(true)),'参数是选择位、数据位，结果用序对保存（0路，1路）。'],
    ['半加器','halfadd',[true,true],pair(truth(false),truth(true)),'两个一位输入相加。序对第一项是和位，第二项是进位：1+1得到（0，1）。'],
    ['全加器','fulladd',[true,true,true],pair(truth(true),truth(true)),'输入两位和低位传来的进位。结果为（和位，向高位的进位）：1+1+1得到（1，1）。'],
    ['一位比较器','bitcmp',[true,false],pair(truth(true),pair(truth(false),truth(false))),'比较两个布尔数位，输出嵌套序对（大于，（等于，小于））。'],
    ['顺序输入列表','bits',[6,...signal],list(signal),'先写项数，再写同样数量的布尔输入；输出顺序与输入相同。'],
    ['一拍延迟','delay',[6,...signal],list([false,...signal.slice(0,-1)]),'先写项数，再写各拍输入。每拍输出上一次保存的值，然后保存当前输入；初始值为假。'],
    ['自定初值延迟','delayi',[6,true,...signal],list([true,...signal.slice(0,-1)]),'参数依次是项数、初始值、各拍输入；只改变第一拍输出，之后输出前一拍输入。'],
    ['读取延迟第几项','delayat',[6,4,...signal],true,'先写输入项数6和输出位置4，再写六个布尔输入。第4拍输出的是第3个输入。'],
    ['一拍延迟单步','delaystep',[false,true],pair(truth(false),truth(true)),'参数是旧状态、输入，返回（本拍输出，下一拍状态）：先读旧值，再保存新值。'],
    ['存储器单拍','memorystep',[true,false,false],pair(truth(true),truth(true)),'参数是旧状态、写入使能、数据。写入使能为假，即使输入改变也保持原值；结果是（旧值，新状态）。'],
    ['存储器写入与保持','memory',[5,false,true,true,false,false,false,true,true,false,true,true],pair(list([false,true,true,true,false]),truth(true)),'先写拍数和初值，再逐拍输入“写入使能、数据”。真表示写入，假表示保持，返回（旧值输出列表，最终保存值）。'],
    ['读取存储器输出','memoryout',[5,false,true,true,false,false,false,true,true,false,true,true],list([false,true,true,true,false]),'每拍先读旧状态，再决定写入或保持；这里只返回各拍旧值组成的列表。'],
    ['读取存储器最终值','memoryvalue',[5,false,true,true,false,false,false,true,true,false,true,true],true,'最后一拍写入的值要到下一拍才出现在延迟输出里；这个函数直接读取最后保存值。'],
    ['多输入与','allbits',[6,...signal],false,'先写输入数量，再写各个布尔值，逐项累计逻辑与。'],
    ['多输入或','anybits',[6,...signal],true,'先写输入数量，再写各个布尔值，逐项累计逻辑或。'],
    ['奇偶校验','parity',[6,...signal],false,'先写输入数量，再写布尔值；本例四个真输入为偶数，输出假。']
  ];
  const examples=specs.map(([title,name,args,expected,description])=>{
    const input=args.map(value=>typeof value==='boolean'?literal(value):value+'_church'),raw=args.map(value=>'('+(typeof value==='boolean'?truth(value):C.format(C.parse(String(value))))+')');
    return {name:title+' · '+name,category:'布尔逻辑与电路',encoding:'bool',booleanCircuit:{name,args,input,title},term:program(name,raw),expected:typeof expected==='boolean'?truth(expected):expected,description,parameters:input.map((value,index)=>`参数${index+1}：${value}`)};
  });
  const tables={notgate:a=>!a,andgate:(a,b)=>a&&b,orgate:(a,b)=>a||b,nand:(a,b)=>!(a&&b),nor:(a,b)=>!(a||b),xorgate:(a,b)=>a!==b,xnor:(a,b)=>a===b,implies:(a,b)=>!a||b};
  const memoryNames=new Set(['delaystep','memorystep','memory','memoryout','memoryvalue']);
  function memoryLesson(example){
    const {name,args,input}=example.booleanCircuit,entries=reachable(name),entry=registry.get(name),compact=name+' '+input.join(' '),single=name==='delaystep'||name==='memorystep',delay=name==='delaystep';
    const inputs=input.map((value,index)=>({name:single?['state',...(delay?[]:['write']),'input'][index]:index===0?'n':index===1?'initial':((index%2===0?'write':'data')+Math.floor(index/2)),value,encoding:!single&&index===0?'丘奇自然数':'丘奇布尔',role:single?(delay?['上一拍保存值','本拍输入']:['上一拍保存值','写入使能：真写入，假保持','本拍数据'])[index]:index===0?'拍数 n，后面恰好接收 n 组“写入使能、数据”':index===1?'第一拍之前保存的初始值':index%2===0?`第 ${Math.floor(index/2)} 拍写入使能：真写入，假保持`:`第 ${Math.floor(index/2)} 拍数据：允许写入时才保存`}));
    let columns,rows;
    if(single){columns=delay?['旧状态','输入','本拍输出','下一拍状态']:['旧状态','写入使能','输入','本拍输出','下一拍状态'];rows=[];
      for(const state of [false,true])for(const write of delay?[true]:[false,true])for(const data of [false,true])rows.push([state,...(delay?[]:[write]),data,state,write?data:state].map(value=>value?'真':'假'));
    }else{columns=['拍数','写入使能','输入数据','本拍旧值输出','拍后保存'];rows=[];let state=args[1];
      for(let i=0;i<args[0];i++){const write=args[2+2*i],data=args[3+2*i],old=state;if(write)state=data;rows.push([String(i+1),write?'真（写入）':'假（保持）',data?'真':'假',old?'真':'假',state?'真':'假']);}
    }
    return {core:name+' = '+entry.source,compact,libraryEntries:[name],symbols:entries.map(({name,source,meaning})=>({name,source,meaning})),featured:[name,'memorystep','delaystep','mux'],inputs,foundation:entries.filter(item=>item.name!==name).map(item=>item.name+' = '+item.source).join('\n'),
      basics:['一拍延迟保留旧状态：本拍输出旧值，新输入成为下一拍的状态。这里只描述离散拍，不等待真实时间。','用二选一开关把保存值反馈到输入端：写入使能为真时选新数据，为假时选原状态。因此没有写入的拍也会保留数据。','本例写入使能、初值和数据使用 1_bool（真）与 0_bool（假）；拍数使用 _church。数据通道也能保存丘奇数或列表，只有写入使能必须是丘奇布尔。'],
      overview:'存储器 = 选择新值或反馈旧值 + 一拍延迟。每拍先读旧状态，然后决定下一拍保存什么。',flow:{columns,rows},
      principle:['状态转移是 output = state，next = write input state。丘奇布尔 write 为真选 input，为假选 state；写入假的数据与关闭写入是两件事。','delaystep state input 返回 pair state input。memorystep 先用 mux write state input 选择下一状态，再交给 delaystep，得到（旧值，下一状态）。没有不动点递归，也没有提前用 JavaScript 算出结果。','memory 用丘奇数 n 生成 n 组接收函数，每组接收写入使能和数据，再把下一状态传到下一组。输出用丘奇列表按拍积累，终点返回（输出列表，最终状态）。memoryout 只积累输出，memoryvalue 只传递状态，避免为最终值构造整份输出记录。','保持只意味着 next = state，不是丢掉本拍。写入在拍后生效，最后一拍的新值在最终状态里；延迟输出还没有包含它。要继续运行，取出最终状态，作为下一次调用的初值。'],
      steps:[['看调用和结果',example.description,compact+'\n→ '+format(C.parse(example.expected))],[delay?'用序对保存输出与状态':'选择要保存的数据',delay?'序对同时保留旧值与新值，交给读取函数选择。':'写入使能为真选新数据，为假选保存值。',delay?'pair = '+registry.get('pair').source:'mux = '+registry.get('mux').source+'\nmemorystep = '+registry.get('memorystep').source],['一拍延迟保存状态','序对第一项是旧值输出，第二项交给下一拍；单步不会直接改写外部变量。','delaystep = '+registry.get('delaystep').source],['逐拍检查写入和保持','沿表格读取：本拍输出总是旧状态；写入使能决定拍后的保存值。',compact,{columns,rows}],['读取结果并继续','memory 的第一项是旧值列表，第二项是最终状态。用真取第一项、假取第二项。下一批把第二项作为初始值传入。',single?compact+' (λa.λb.a)\n'+compact+' (λa.λb.b)':name==='memory'?compact+' (λa.λb.a)\n'+compact+' (λa.λb.b)':name+' = '+entry.source]],
      walkthrough:compact+'\n→ '+format(C.parse(example.expected)),encodingText:'丘奇布尔控制写入；序对返回输出与状态，丘奇列表按拍保存输出。',
      parameterNote:single?'参数按表中顺序传入。结果序对自带的选择参数只在读取某一项时使用。':'先传 n_church 和初值，再传恰好 n 组“写入使能、数据”，共 2 + 2n 个实参。未传完时仍是等待输入的函数，不是存储值。',
      boundaries:['n=0 时不读取任何写入或数据：memory 返回（空列表，初值），memoryout 返回空列表，memoryvalue 返回初值。','写入使能为假时，新数据不参与下一状态；写入使能为真且数据为假时，会把原来的真值清为假。正规序可跳过未使用的数据，应用序仍会先计算参数。','每次调用都显式接收并返回状态，不会偷偷修改浏览器存档或函数库。只有把返回的新状态传给下一次调用，才会延续同一个存储器。','这是无地址的单值寄存器；数据可以是一整个列表。多地址读写存储器需要另加地址选择与更新规则。'],exercise:'把写入使能都改成 0_bool，确认每拍和最终值都保持初值；再开启一拍写入 0_bool，检查何时清零。'};
  }
  function lesson(example){
    if(memoryNames.has(example.booleanCircuit.name))return memoryLesson(example);
    const spec=example.booleanCircuit,{name,args,input,title}=spec,entries=reachable(name),entry=registry.get(name),compact=name+' '+input.join(' '),serial=['bits','delay','delayi','delayat','allbits','anybits','parity'].includes(name),delayed=name.startsWith('delay');
    const roles={mux:['选择位','0路输入','1路输入'],demux:['选择位','数据位'],halfadd:['第一位','第二位'],fulladd:['第一位','第二位','低位进位'],bitcmp:['第一位','第二位']};
    const inputs=input.map((value,index)=>({name:typeof args[index]==='number'?(index===0?'n':'position'):'b'+(index+1),value,encoding:typeof args[index]==='number'?'丘奇自然数':'丘奇布尔',role:serial?(index===0?'输入数量，同时决定接收多少个布尔输入':name==='delayat'&&index===1?'想读取的输出位置（从1开始）':name==='delayi'&&index===1?'第一拍之前保存的初始值':'依次输入的布尔值'):roles[name]?.[index]??'布尔输入'}));
    let rows,columns;
    if(tables[name]){const unary=name==='notgate';columns=unary?['输入','输出']:['第一位','第二位','输出'];rows=(unary?[[false],[true]]:[[false,false],[false,true],[true,false],[true,true]]).map(values=>[...values.map(v=>v?'真':'假'),tables[name](...values)?'真':'假']);}
    else if(delayed){columns=['拍数','输入','本拍输出','拍后保存'];const initial=name==='delayi',start=name==='delayat'||initial?2:1,values=args.slice(start);let previous=initial?args[1]:false;rows=values.map((value,index)=>{const row=[String(index+1),value?'真':'假',previous?'真':'假',value?'真':'假'];previous=value;return row;});}
    else if(name==='halfadd'||name==='fulladd'){columns=name==='halfadd'?['a','b','和位','进位']:['a','b','低位进位','和位','高位进位'];rows=[];for(const a of [0,1])for(const b of [0,1])for(const c of name==='fulladd'?[0,1]:[0]){const total=a+b+c;rows.push([a,b,...(name==='fulladd'?[c]:[]),total%2,Math.floor(total/2)].map(String));}}
    else{columns=['阶段','传入内容','输出含义'];rows=[['输入',input.join(' '),'按照参数表依次应用'],['处理',name,'执行下方实际 λ 定义'],['结果',typeof example.expected==='string'?format(C.parse(example.expected)):'','多项结果保留为序对或列表']];}
    return {core:name+' = '+entry.source,compact,libraryEntries:[name],symbols:entries.map(({name,source,meaning})=>({name,source,meaning})),featured:[name],inputs,
      basics:['真是 λa.λb.a，假是 λa.λb.b。布尔值通过选择两个分支来参与运算。','输入 1_bool 表示真、0_bool 表示假；数量和位置用 _church 指明丘奇自然数，与当前数字编码互不混淆。','序对 λk.k a b 保存两个输出，传入真取第一项，传入假取第二项。丘奇列表保留多个输出的先后顺序。'],
      foundation:entries.filter(item=>item.name!==name).map(item=>item.name+' = '+item.source).join('\n'),
      principle:[example.description,serial?'数量 n 是丘奇迭代器，它在 λ 演算内部生成 n 个接收布尔值的函数；不是 JavaScript 预先填入答案。':'把布尔输入交给选择器，只有所选择的分支会成为结果。多个输出通过 pair 构造器封装。',delayed?'延迟是一拍的离散信号延迟，不是等待一秒。状态是前一次输入，先输出旧状态，再保存新输入；最后一个输入已经接收，它的延迟输出在下一拍，不属于本次要求的 n 项。':'辅助定义与入口一同封装，加入函数库后只需传实际输入。'],
      overview:example.description,flow:{columns,rows},
      steps:[['先看调用和输出',example.description,compact],['读取完整入口',entry.meaning,name+' = '+entry.source],['读取实际依赖','以下是本入口实际调用的辅助函数。所有名称都有完整 λ 定义。',entries.filter(item=>item.name!==name).map(item=>item.name+' = '+item.source).join('\n')],
        [delayed?'每拍先输出旧值再更新':'逐种输入核对结果',delayed?'初始值决定第一拍。第 k 拍输出第 k−1 个输入，不会丢掉一拍。':'表中的每种布尔组合均可代入同一个函数。',compact,{columns,rows}],['读取多项结果','半加器、全加器的序对顺序都是（和位，进位）。延迟返回按拍排列的丘奇列表。',name==='halfadd'||name==='fulladd'?compact+' (λa.λb.a)\n'+compact+' (λa.λb.b)':C.format(C.parse(example.expected))]],
      walkthrough:compact+'\n→ '+format(C.parse(example.expected)),encodingText:'丘奇布尔；多输出用序对或丘奇列表，所有运算由普通 λ 归约完成。',
      parameterNote:serial?'先传输入数量。delayi 还需初始值，delayat 还需输出位置；之后严格依次传入 n 个布尔输入。不够时结果仍是等待输入的函数；多传会把结果继续当作函数应用。':'只需传参数表中的布尔输入，逻辑与序对辅助函数已封装。',
      boundaries:['布尔输入必须使用丘奇真假；普通丘奇数1与丘奇真不是同一个函数。','数量是非负丘奇自然数，0表示不读取任何布尔输入；列表结果为空，多输入与的空结果为真，多输入或和异或的空结果为假。','这是离散拍序列，没有真实时间或设备时钟。归约顺序和按需展开开关保持由用户选择。'],exercise:serial?'将项数改为3，并且只提供三个布尔输入；再改初始值或要读取的位置，核对每一拍。':'依次把布尔输入改成0_bool、1_bool，核对上面的真值表。'};
  }
  const TRUE=C.parse(registry.get('TRUE').source),FALSE=C.parse(registry.get('FALSE').source);
  function value(term,depth=0){
    if(depth>100||C.hasRedex(term))return null;if(C.equal(term,TRUE))return '真';if(C.equal(term,FALSE))return '假';
    if(term.type!=='abs')return null;const body=term.body;
    if(body.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='var'&&body.fn.fn.name===term.param){const a=value(body.fn.arg,depth+1),b=value(body.arg,depth+1);if(a!==null&&b!==null)return '（'+a+'，'+b+'）';}
    if(body.type==='abs'&&term.param!==body.param){const values=[];let tail=body.body;while(tail.type==='app'&&tail.fn.type==='app'&&tail.fn.fn.type==='var'&&tail.fn.fn.name===term.param){const entry=value(tail.fn.arg,depth+1);if(entry===null)return null;values.push(entry);tail=tail.arg;}if(tail.type==='var'&&tail.name===body.param)return '['+values.join('，')+']';}
    return null;
  }
  function format(term){const result=value(term);return result===null?C.format(term):result;}
  const API={definitions,examples,program,lesson,format,read:value,inputSource:example=>program(example.booleanCircuit.name,example.booleanCircuit.input)};root.LambdaBooleanCircuits=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
