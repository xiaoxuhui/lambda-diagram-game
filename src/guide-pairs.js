(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),P=root.LambdaPresets||require('./presets.js');
  const pair=C.parse('λa b k.k a b'),yes=C.parse(P.TRUE),no=C.parse(P.FALSE);
  const number=n=>C.parse(String(n)),state=(a,b)=>C.A(C.A(pair,a),b);
  const numbers=([a,b])=>state(number(a),number(b));
  const list=items=>C.churchList(items.map(number));
  const printable=term=>C.format(term);
  function card(label,explanation,term,expected,expectedLabel,compactSource){
    return {label,explanation,source:printable(term),expected:printable(C.normalize(expected,10000).term),expectedLabel,...(compactSource?{compactSource}:{})};
  }
  function loopParts(program,values,encode=number){
    let body=C.parse(program);while(body.type==='abs')body=body.body;
    let step=body.fn.fn.arg,initial=body.fn.arg;
    for(const [name,value] of Object.entries(values)){step=C.substitute(step,name,encode(value));initial=C.substitute(initial,name,encode(value));}
    return {step,initial};
  }
  function describeRaw(example,doc){
    const prefix=example.name.split(' · ')[0],cards=[];
    if(prefix==='有序对'){
      const value=numbers([3,5]);
      cards.push(
        card('构造序对 (3,5)','先接收两个值，再接收选择器 k。构造结果是一个保存这两个值的函数，不会自行选择其中一项。',value,C.parse('λk.k 3 5'),'(3,5)，即 λk.k 3 5'),
        card('取出第一项','完整写出选择前项的 λa b.a；它接收到3和5后丢掉第二项。',C.A(value,yes),number(3),'丘奇数3'),
        card('取出第二项','完整写出选择后项的 λa b.b；它接收到3和5后丢掉第一项。',C.A(value,no),number(5),'丘奇数5')
      );
      const update=C.parse('λp.(λa b k.k a b) (p (λa b.b)) ((λm n f x.m f (n f x)) (p (λa b.a)) (p (λa b.b)))');
      cards.push(card('读旧值，构造新序对','这个更新把 (a,b) 变为 (b,a+b)。它先从同一个旧序对读出两项，再构造 (5,8)。',C.A(update,value),numbers([5,8]),'(5,8)'));
      cards.push(card('把更新重复两次','最左边的丘奇数2把更新调用两次：(3,5) → (5,8) → (8,13)。更新之间传递的是整个序对。',C.A(C.A(number(2),update),value),numbers([8,13]),'(8,13)'));
      const compact=['PAIR 3 5','(PAIR 3 5) TRUE','(PAIR 3 5) FALSE','pairstep (PAIR 3 5)','2 pairstep (PAIR 3 5)'];
      cards.forEach((item,i)=>item.compactSource=compact[i]);
      return {...doc,compact:'SECOND (PAIR 3 5)',core:'PAIR = λa b selector.selector a b\nFIRST = λp.p TRUE\nSECOND = λp.p FALSE',
        walkthrough:'PAIR 3 5 → (λb k.k 3 b) 5 → λk.k 3 5\n(λk.k 3 5) TRUE → TRUE 3 5 → (λb.3) 5 → 3\n(λk.k 3 5) FALSE → FALSE 3 5 → (λb.b) 5 → 5',
        steps:[
          ['把两个值封装成函数','把3代入a、5代入b后，留下等待选择器的 λk.k 3 5。k 尚未传入，所以此时两个值都保留。','(λa b k.k a b) 3 5 → λk.k 3 5'],
          ['第一项由选择前项的函数读出','k 接收 TRUE，于是先得到 TRUE 3 5，再按照 TRUE 的函数体选择3。','(λk.k 3 5) (λa b.a) → (λa b.a) 3 5 → (λb.3) 5 → 3'],
          ['第二项由选择后项的函数读出','k 接收 FALSE，于是先得到 FALSE 3 5，再按照 FALSE 的函数体选择5。','(λk.k 3 5) (λa b.b) → (λa b.b) 3 5 → (λb.b) 5 → 5'],
          ['更新会构造一个新的序对','序对没有可修改的内存格。pairstep 先读旧序对，再把算出的两个新值交给 PAIR。后面的阶乘、求和和除法都按这个方式传递状态。','pairstep = λp.PAIR (p FALSE) (ADD (p TRUE) (p FALSE))'],
          ['把新序对继续交给下一轮','丘奇数 n 接收更新函数和初始序对后，产生 n 次函数应用。每轮得到的整个序对成为下一轮的参数。','2 pairstep (PAIR 3 5) → pairstep (pairstep (PAIR 3 5))']
        ],pairExamples:cards};
    }
    let spec;
    if(example.name.startsWith('阶乘 · 迭代'))spec={program:P.advanced.factorial,values:{n:3},count:3,states:[[0,1],[1,1],[2,2],[3,6]],fields:'第一项为当前数字，第二项为累计乘积',rule:'新数字等于旧数字加1；新乘积使用这个新数字乘旧乘积'};
    else if(prefix==='排列数')spec={program:P.advanced.permutations,values:{n:4,k:2},count:2,states:[[4,1],[3,4],[2,12]],fields:'第一项为剩余可选数，第二项为累计排列数',rule:'新剩余数减1；新乘积使用旧剩余数乘旧乘积'};
    else if(['自然数求和','平方和','立方和'].includes(prefix)){
      const power=['自然数求和','平方和','立方和'].indexOf(prefix)+1,n=power===1?5:3;let sum=0;
      spec={program:P.advanced.sumPowers(power),values:{n},count:n,states:Array.from({length:n+1},(_,i)=>[i,sum+=i**power]),fields:'第一项为已处理的下标，第二项为累计和',rule:'先把下标加1，再把新下标的'+power+'次幂加进旧和'};
    }else if(prefix==='等比求和')spec={program:P.advanced.geometricSum,values:{b:2,n:4},count:4,states:[[1,0],[2,1],[4,3],[8,7],[16,15]],fields:'第一项为下一项，第二项为累计和',rule:'新和加入的是旧当前项；新当前项等于旧当前项乘公比2'};
    else if(prefix.startsWith('二项式')){
      const b=prefix==='二项式系数和'?1:2;
      spec={program:P.advanced.binomial,values:{a:1,b,n:3},count:4,states:b===1?[[0,0],[1,1],[2,4],[3,7],[4,8]]:[[0,0],[1,1],[2,7],[3,19],[4,27]],fields:'第一项为下一个项下标，第二项为累计和',rule:'按旧下标k计算 C(3,k)×a^(3−k)×b^k，再让下标加1。这里要执行 n+1 轮'};
    }
    if(spec){
      const {step,initial}=loopParts(spec.program,spec.values),first=spec.states[0],last=spec.states.at(-1);
      cards.push(card('初始序对 '+JSON.stringify(first),'两个字段一起封装。'+spec.fields+'。',initial,numbers(first),'('+first.join(',')+')'));
      const loop=C.A(C.A(number(spec.count),step),initial);
      cards.push(card('让丘奇数重复整轮更新','开头的丘奇数把同一个更新函数调用'+spec.count+'次；初始序对只在最内层使用。每次输出整个新序对。',loop,numbers(last),'('+last.join(',')+')'));
      cards.push(card('最后才读出第二项','先完成所有更新，再把选择后项的函数传给最终序对；这一步取出累计结果。',C.A(loop,no),number(last[1]),'丘奇数'+last[1]));
      let compactStep;
      if(example.name.startsWith('阶乘 · 迭代'))compactStep='factorialstep';
      else{
        const program=doc.core.split('\n')[0].split(' = ').slice(1).join(' = ').replace(/\b\d+\b/g,n=>'guideNumber'+n);
        compactStep='('+printable(loopParts(program,spec.values,n=>C.V('guideNumber'+n)).step).replace(/\bguideNumber(\d+)\b/g,'$1')+')';
      }
      const compactLoop=`${spec.count} ${compactStep} (PAIR ${first[0]} ${first[1]})`;
      cards[0].compactSource=`PAIR ${first[0]} ${first[1]}`;cards[1].compactSource=compactLoop;cards[2].compactSource=`(${compactLoop}) FALSE`;
      return {...doc,pairExamples:cards,...(example.name.startsWith('阶乘 · 迭代')?{
        compact:'factorialiter 3',
        core:'PAIR = λa b k.k a b\nTRUE = λa b.a\nFALSE = λa b.b\nSUCC = λn f x.f (n f x)\nMUL = λm n f.m (n f)\nfactorialstep = λp.PAIR (SUCC (p TRUE)) (MUL (SUCC (p TRUE)) (p FALSE))\nfactorialiter = λn.n factorialstep (PAIR 0 1) FALSE',
        walkthrough:'factorialstep (PAIR k acc)\n→ PAIR (SUCC k) (MUL (SUCC k) acc)\nfactorialiter n → (n factorialstep (PAIR 0 1)) FALSE',
        steps:[
          ['为什么保存两项，为什么从 (0,1) 开始','k 表示已经乘到哪个数，acc 保存已经算好的乘积。起点没有乘入任何数，所以 k=0、acc=1。若乘积从0开始，后面一直乘也只会得到0。','PAIR 0 1 = λk.k 0 1'],
          ['选择器怎样读出旧值','q 是这里保存状态的函数。把 TRUE 或 FALSE 传进去，分别取出原来保存的数字与乘积。读取不会改变 q。','q = λselector.selector k acc\nq TRUE → TRUE k acc → k\nq FALSE → FALSE k acc → acc'],
          ['怎样算出下一次的两项','SUCC 把旧数字 k 变成 k+1。新乘积使用 k+1 乘旧 acc；两个字段都从同一个旧 p 读取。最后 PAIR 接收两个新值，构造新的函数。','factorialstep (PAIR k acc)\n→ PAIR (SUCC k) (MUL (SUCC k) acc)\n→ PAIR (k+1) ((k+1)×acc)'],
          ['为什么这条规则能算出任意阶乘','若旧乘积 acc=k!，更新后就得到 (k+1)×k!，这正是 (k+1)!。初始 acc=0!=1，每轮都使用相同规则保持这个关系。','(k,k!) → (k+1,(k+1)!)'],
          ['谁决定重复几次，谁决定取哪一项','n factorialstep initial 表示把更新作用 n 次。FALSE 在最后取出乘积；它不负责计数。n=0 时直接从初始序对取出1。','factorialiter n = (n factorialstep (PAIR 0 1)) FALSE\nfactorialiter 3 → 3 factorialstep (PAIR 0 1) FALSE → 6\nfactorialiter 0 → PAIR 0 1 FALSE → 1']
        ]}:{} )};
    }
    if(prefix==='序对除法'){
      let program=C.parse(P.rawSourceFor(example));while(program.type==='app')program=program.fn;
      const body=program.body.body,normal=body.arg,loop=normal.fn;
      const step=C.substitute(loop.fn.arg,'n',number(2)),initial=numbers([7,0]);
      cards.push(card('初始状态','第一项保存剩余量，第二项保存商。',initial,numbers([7,0]),'(余数7,商0)'));
      const repeated=C.A(C.A(number(7),step),initial);
      cards.push(card('被除数提供7轮更新次数','同一个更新函数检查剩余量：够减就减除数并增加商，不够减就保持状态。',repeated,numbers([1,3]),'(余数1,商3)'));
      cards.push(card('构造可识别的最终记录','完成状态更新后加入真标记。最终记录的字段顺序是标记、余数、商；它和中间两字段序对的形状不同。',C.parse(P.rawSourceFor(example)),C.parse(example.expected),'余数1，商3'));
      ['PAIR 7 0','7 (quotstep 2) (PAIR 7 0)','pairdiv 7 2'].forEach((source,i)=>cards[i].compactSource=source);
      return {...doc,core:'pairdiv = '+printable(program)+'\nquotstep = '+printable(C.L('n',loop.fn.arg)),pairExamples:cards,
        walkthrough:'m (quotstep n) (PAIR m 0)\n→ PAIR 余数 商\n→ λk.k TRUE 余数 商',
        steps:[
          ['保存剩余量与商','初始剩余量为被除数7，商为0。每轮通过 p 接收读取者，将两个字段一起传给 λr q。','PAIR 7 0 → λk.k 7 0\np (λr q.body) → body[r←剩余量,q←商]'],
          ['判断够不够再减一次','读取剩余量r后，判断除数2是否不大于r。满足时走减法分支，否则保留原状态；不是等到负数才结束。','(2≤r) (PAIR (SUB r 2) (SUCC q)) (PAIR r q)'],
          ['成功相减时同时更新两项','quotstep 先接收除数，再接收旧序对。从同一旧状态读出r和q，用剩余量减除数，用商加1，再封装成一个新序对。','quotstep n (PAIR r q) → PAIR (SUB r n) (SUCC q)'],
          ['不够减时为什么还能继续迭代','丘奇7固定调用更新函数7次。到(1,3)后，每轮都选择保留分支，所以剩下4轮不会再增加商。','quotstep 2 (PAIR 1 3) → PAIR 1 3'],
          ['把状态转成输出记录','读取最终的余数与商，加上真标记后返回三字段函数。除数为0会在进入迭代前返回错误记录。','(PAIR 1 3) (λr q k.k TRUE r q)\n→ λk.k TRUE 1 3']
        ]};
    }
    if(example.category==='丘奇列表'&&example.name.includes('尾部')){
      const body=C.parse(P.churchLists.tail).body,step=body.fn.fn.arg;
      const encode=values=>state(list(values[0]),list(values[1]));
      cards.push(card('初始状态','两项都是空表。更新时第一项保存新的完整后缀，第二项保留旧完整后缀。',encode([[],[]]),encode([[],[]]),'([],[])'));
      cards.push(card('完整尾表计算','用同一个更新函数折叠列表，最后取状态第二项。',C.A(C.parse(P.churchLists.tail),list([1,2,3])),list([2,3]),'丘奇列表 [2,3]'));
      cards[0].compactSource='PAIR FALSE FALSE';cards[1].compactSource='TAIL (CONS 1 (CONS 2 (CONS 3 FALSE)))';
      return {...doc,compact:cards[1].compactSource,core:'TAIL = '+P.churchLists.tail+'\ntailstep = '+printable(step),pairExamples:cards,
        steps:doc.steps.map(item=>item[2]?.startsWith('step h p =')?[item[0],item[1],'tailstep = λh p.PAIR (CONS h (p TRUE)) (p TRUE)',item[3]]:item)};
    }
    if(/^(符号求导|生成导函数|生成原函数|定积分)/.test(example.name)){
      const M=root.LambdaPolynomial||require('./polynomial.js'),A=root.LambdaGuideAdvanced||require('./guide-advanced.js');
      const integrate=/^(生成原函数|定积分)/.test(example.name),operation=integrate?'INTEGRATE':'DIFF';
      let algorithm=C.V(integrate?'integ':'diff');
      for(const binding of [...A.unpack(M.churchProgram(operation)).bindings].reverse())algorithm=C.substitute(algorithm,binding.name,binding.term);
      const step=algorithm.body.fn.fn.arg;
      const rows=doc.steps.find(item=>item[3]?.columns[0]==='从右侧读到的系数')[3].rows;
      const rational=text=>{const [a,b]=text.split('/');return state(number(a),number(b));};
      const decodeState=text=>{
        const [,i,items]=/^\((\d+),\[(.*)\]\)$/.exec(text);
        return state(number(i),C.churchList(items?items.split(',').map(rational):[]));
      };
      cards.push(card('构造初始的双字段状态','第一项是当前次数，第二项是已经生成的系数表。每个分数系数内部又是一个分子、分母序对。',decodeState(rows[0][1]),decodeState(rows[0][1]),rows[0][1]));
      const last=rows.at(-1)[3],items=/\[(.*)\]/.exec(last)[1];
      const input=C.churchList([...rows].reverse().map(row=>rational(row[0])));
      cards.push(card('完整系数变换','用同一个更新函数折叠全部系数，最后取状态的列表字段。',C.A(algorithm,input),C.churchList(items?items.split(',').map(rational):[]),'系数表 ['+items+']'));
      const compactList=values=>values.reduceRight((tail,value)=>{const [a,b]=value.split('/');return `(cons (pair ${a} ${b}) ${tail})`;},'false');
      const initialItems=/\[(.*)\]/.exec(rows[0][1])[1];
      cards[0].compactSource=`pair 0 ${compactList(initialItems?initialItems.split(','):[])}`;
      cards[1].compactSource=`${integrate?'integ':'diff'} ${compactList([...rows].reverse().map(row=>row[0]))}`;
      const stepName=integrate?'integstep':'diffstep';
      return {...doc,core:doc.core+'\n'+stepName+' = '+printable(step),pairExamples:cards,
        steps:doc.steps.map(item=>item[3]?.columns[0]==='从右侧读到的系数'?[item[0],item[1],stepName+' = '+printable(step)+'\n'+item[2],item[3]]:item)};
    }
    return doc;
  }
  function describe(example,doc){
    const result=describeRaw(example,doc);if(!result.pairExamples)return result;
    return {...result,symbols:[...result.symbols,
      ...(example.name.startsWith('阶乘 · 迭代')?[{name:'factorialiter',source:'λn.n factorialstep (PAIR 0 1) FALSE',meaning:'迭代阶乘：重复更新 n 次，最后读取累计乘积。'}]:[])]};
  }
  const API={describe};root.LambdaGuidePairs=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
