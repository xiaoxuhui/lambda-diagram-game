(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),M=root.LambdaPolynomial||require('./polynomial.js');
  const table=(columns,rows)=>({columns,rows});
  const meanings={
    t:'真选择器，λx y.x。对有序对使用 t 会选第一项。',f:'假选择器，λx y.y。这里的单字母 f 是选择器，和正文数学记号 f(x) 中的输入函数不是同一个含义。',
    pair:'有序对，λa b k.k a b。有理数用它保存（分子，分母）；算法状态也用它保存（当前次数，结果列表）。看见 pair 时要先确认本处两个字段的用途。',
    nil:'丘奇空列表，λc n.n，返回空表初值。',cons:'头插一个元素，λh r c n.c h (r c n)。r c n 是尾表的折叠结果，因此这是丘奇列表，不是直接返回尾指针的 Scott 列表。',
    add:'丘奇自然数加法：把两段迭代接起来。',mul:'丘奇自然数乘法：把一段迭代整体重复。',succ:'丘奇后继：使次数增加一。',pred:'丘奇前驱：使正数减一，零保持零。',sub:'丘奇自然数截断减法：不足减时返回零。',zero:'丘奇零判断：零选择第一分支，正数选择第二分支。',
    rmul:'有理数乘自然数。a t 读分子，a f 读分母；只把分子乘 n。n=0 时返回标准的 0/1。',
    rdiv:'有理数除以正自然数。只把分母乘 n：例如 (2/1)÷2 变为 2/2。这个结构可以不约分，仍精确表示一。',
    radd:'有理数通分相加：(u/v)+(w/z)=(u×z+w×v)/(v×z)。a、b 是两个有序对，不是两个丘奇自然数。零分子时直接返回另一项。',
    rsub:'有理数通分相减：(u/v)−(w/z)=(u×z−w×v)/(v×z)。分子减法是截断减法，本程序因而要求非负系数、非负且有序的定积分端点。',
    diff:'系数求导。列表从常数项开始右折叠，状态 s=(i,r)：i 是当前原次数，r 是已得到的导数系数表。常数项丢掉，其他系数乘 i，再头插到 r。',
    integ:'系数积分。状态 s=(i,r)：系数除以 i+1，再头插到 r；初始 r=[0/1] 提前放入积分常数 C=0。每读一项，i 增加一。',
    fold:'把列表折叠接成一串等待累计值的函数，以便从最高次系数向常数项逐个更新。它和求导、积分直接从右侧处理的顺序不同。',
    evalpoly:'逐层乘加求值。先令累计值为 0/1，再按降序系数逐项执行“累计值乘 x，再加当前系数”。',
    divmod:'给一个丘奇数做带余除法。被除数决定迭代次数；状态保存（距下一次进位还剩的标记，余数，商）。每数满一个基数，余数清零、商加一，最后把商与余数交给 emit。',
    encodepoly:'把输入函数转成系数表：计算系数和 sum，取 base=sum+1，算 value=输入函数 base，再用带余除法逐个提取系数。零多项式单独处理。'
  };
  function describe(example,unpack){
    const kind=example.name.startsWith('多项式')?'EVAL':example.name.startsWith('符号求导')?'DERIVATIVE':example.name.startsWith('定积分')?'DEFINITE':example.name.startsWith('生成导函数')?'DIFF':'INTEGRATE';
    const evaluate=kind==='EVAL',differentiate=['DIFF','DERIVATIVE'].includes(kind),integrate=!evaluate&&!differentiate;
    const coefficients=evaluate?[2,3,1]:differentiate?[1,3,0]:[2,0];
    const formula=evaluate?'2x²+3x+1':differentiate?'x²+3x':'2x';
    const sum=coefficients.reduce((a,b)=>a+b,0),base=sum+1,value=coefficients.reduce((a,b)=>a*base+b,0);
    const encoded='['+coefficients.map(n=>n+'/1').join(',')+']';
    const source=M.churchFunction([...coefficients].reverse()),{bindings,main}=unpack(M.churchProgram(kind));
    const inputs=[{name:'function',value:'f(x)='+formula,encoding:'接收丘奇数的 λ 函数',role:integrate?'被积函数 f；积分得到的原函数 F 由程序生成':'待处理的输入函数 f；λ 写法见第2步'}];
    if(['EVAL','DERIVATIVE'].includes(kind))inputs.push({name:'x',value:'2_church',encoding:'丘奇自然数',role:evaluate?'在这里计算 f(2)':'在这里计算 f′(2)，不是 f(2)'});
    if(kind==='DEFINITE')inputs.push({name:'a',value:'0_church',encoding:'丘奇自然数',role:'下限，先传入'},{name:'b',value:'3_church',encoding:'丘奇自然数',role:'上限，后传入；最后做 F(b)−F(a)'});
    const goal={EVAL:'输入 f(x)=2x²+3x+1 和 x=2，算出一个数 f(2)=15。',DERIVATIVE:'输入 f(x)=x²+3x 和 x=2，先生成 f′(x)=2x+3，再算 f′(2)=7。原输入的 f(2)=10，和导数值是两个目标。',DIFF:'输入 f(x)=x²+3x，生成代表 f′(x)=2x+3 的系数表。这里没有传入求值点，因此结果不是一个已经代入 x 的数。',INTEGRATE:'输入被积函数 f(x)=2x，生成原函数 F(x)=x² 的系数表，积分常数取零。“原函数”在这里专指满足 F′=f 的积分结果。',DEFINITE:'输入被积函数 f(x)=2x、下限0和上限3。程序先生成原函数 F(x)=x²，再算 F(3)−F(0)=9。'}[kind];
    const flow=[['输入函数','f(x)='+formula,'一个接收丘奇 x 的 λ 函数'],['提取系数',encoded,'按最高次数到常数项排列的丘奇列表']];
    if(differentiate)flow.push(['生成导数','[2/1,3/1]','代表 f′(x)=2x+3 的系数数据']);
    if(integrate)flow.push(['生成原函数','[2/2,0/1,0/1]','代表 F(x)=x²，C=0 的系数数据']);
    if(evaluate)flow.push(['代入 x=2','15/1','单个有理数，页面显示15']);
    if(kind==='DERIVATIVE')flow.push(['导数代入 x=2','7/1','单个有理数，页面显示7']);
    if(kind==='DEFINITE')flow.push(['代入并做端点差','18/2−0/1','单个有理数，页面约分显示9']);
    const coefficientRows=coefficients.map((a,index)=>{const degree=coefficients.length-1-index;return [degree===0?String(a):a+(degree===1?'x':'x²'),String(a),String(degree),degree===0?'常数项；缺少也要补零':`a×x^${degree}`];});
    const shortBody=evaluate?'add (mul (add (mul 2 x) 3) x) 1':differentiate?'add (mul (add (mul 1 x) 3) x) 0':'add (mul 2 x) 0';
    const divisions=[],recovered=[];let remaining=value;
    while(remaining){const quotient=Math.floor(remaining/base),digit=remaining%base;recovered.unshift(digit+'/1');divisions.push([String(remaining),String(quotient),String(digit),recovered.join(',')]);remaining=quotient;}
    const listBody=coefficients.reduceRight((tail,a)=>'c (pair '+a+' 1) ('+tail+')','n');
    const steps=[
      ['先认清多项式、系数和次数','x 是可以替换成不同数的输入；系数是每一项前面乘的数，次数是 x 相乘的次数。常数项也占一个位置，它的次数为零。下面把输入函数的每一项分开。',`输入 f(x)=${formula}`,table(['项','系数 a','次数 i','这一项的意思'],coefficientRows)],
      ['输入的 λ 函数怎样算出这个式子','x 在 λx 后被绑定。下面的 add、mul 分别接收两段自然数迭代并做加法、乘法，定义已包在实际输入函数内部。先从最内层看起，就能把紧凑的函数体读回数学公式。',`缩写函数体：${shortBody}\nadd = λm n f z.m f (n f z)\nmul = λm n f.m (n f)\n完整输入函数：\n${source}`,evaluate?table(['读到的位置','数学含义'],[['mul 2 x','2x'],['add (mul 2 x) 3','2x+3'],['再乘 x','2x²+3x'],['再加1','2x²+3x+1']]):undefined],
      ['为什么先把函数变成系数表','求值函数回答“给定 x，结果是多少”；系数表回答“每个次数前的系数是多少”。程序先提取后一种信息，才能逐项求导、积分或换一个求值过程。列表按次数降序排列，位置决定次数，不能随意删掉中间的零。',`[${coefficients.join(',')}] 代表 ${formula}\n[1,0,3] 代表 x²+0x+3\n[1,3] 代表 x+3；它少了一个位置，含义已经改变`],
      ['选一个能把系数分开的基数','十进制的位权是1、10、100；若改成基数 B，位权就是1、B、B²。每一位必须小于 B。自然数系数都非负，所以 f(1) 是系数之和，至少与每个系数一样大；取 B=f(1)+1 就保证每个系数都能单独占一位。',`f(1)=${coefficients.join('+')}=${sum}\nB=${sum}+1=${base}\nf(B)=${value}\n${value}=${coefficients.map((a,index)=>a+'×'+base+'^'+(coefficients.length-1-index)).join('+')}\n所以 ${value} 的 ${base} 进制各位就是 ${coefficients.join('、')}`],
      ['带余除法怎样实际抽出系数','把 f(B) 除以 B，余数是常数项；让商继续除以 B，下一余数是一次项系数，依次向上。余数出现的顺序是从低次到高次，因此每次都插到列表头，最终才得到降序表。',`divmod remaining base (λquotient digit.next quotient (cons (pair digit 1) digits))\nremaining=待拆的数，quotient=商，digit=本次余数\n最后得到 ${encoded}`,table(['待拆的数','商 → 下一轮','余数 → 本项系数','头插后的系数表'],divisions)],
      ['λ 程序怎样知道继续还是结束','encodepoly 用丘奇 value 提供足够的更新次数，不需要给求系数的过程另加一个递归组合子。每次先做 zero remaining：为零就返回已经得到的 digits；非零才执行 divmod，把商与新表交给 next。next 指的是剩余更新过程，不是系数本身。',`zero remaining\n  digits\n  (divmod remaining base\n    (λquotient digit.next quotient (cons (pair digit 1) digits)))\n本例：${value} → ${divisions.slice(0,-1).map(row=>row[1]).join(' → ')} → 0\n遇到0后直接返回 ${encoded}`],
      ['把分数（有理数）和列表还原成 λ 数据','表里的 2/1 等记号只是讲解写法。一个有理数保存为（分子，分母）的有序对；整个系数表又用丘奇列表把这些有序对串起来。向有序对传入真选择器就取分子，传入假选择器就取分母。数学记号 f(x) 仍表示输入的多项式函数。',`pair = λa b k.k a b\nt = λu v.u\nf = λu v.v\npair 2 1 → λk.k 2 1\n(pair 2 1) t → 2；(pair 2 1) f → 1\n本例系数表 ${encoded}\n= λc n.${listBody}`]
    ];
    if(evaluate)steps.push(
      ['先解释逐层乘加为什么等于原多项式','把同一个 x 从内层往外提，2x²+3x+1 就写成 (2x+3)x+1。于是每读到下一个系数，只需把旧累计值乘 x，再加这个系数。这叫霍纳法。',`2x²+3x+1 = (2x+3)x+1\n更新：g = λr a.radd (rmul r x) a\nr=旧累计值，a=本轮系数，x=代入点`],
      ['对应到实际读取顺序和每轮累计值','evalpoly 从0/1开始。fold 让更新按最高次到常数项依次执行。chain先用 g 更新累计值，再把新值交给剩余过程 h；g 就是上一小节的有理数乘加更新。',`chain = λg a h s.h (g s a)\nchain g 2 (chain g 3 (chain g 1 I)) 0\n→ chain g 3 (chain g 1 I) (g 0 2)\n→ chain g 1 I (g (g 0 2) 3)\n→ g (g (g 0 2) 3) 1`,table(['读取系数','旧累计值 r','本轮计算（x=2）','新累计值'],[['2/1','0/1','0×2+2','2/1'],['3/1','2/1','2×2+3','7/1'],['1/1','7/1','7×2+1','15/1']])],
      ['读出最终结果，而不是把数据编码认错','返回值是有理数15/1，即一个保存分子和分母的函数。页面显示15是对这个记录的解读；它的 λ 结构与“重复15次”的丘奇数不同。',`结果：pair 15 1 = λk.k 15 1\n读出分子15，分母1 → 15`]
    );
    if(differentiate)steps.push(
      ['先解释导数到底在求什么','导数描述输入改变一点时，输出的变化率。用增量 h 展开本例，就能看出 x² 的导数为什么是2x、3x的导数为什么是3。下面是数学规则的推导；λ 程序实际执行的是随后给出的系数变换。',`f(x+h)−f(x)\n=(x+h)²+3(x+h)−(x²+3x)\n=2xh+h²+3h\n除以 h 得到 2x+h+3\nh 趋于0 → f′(x)=2x+3`],
      ['把每一项的求导变成系数与次数的更新','一般的一项 a×x^i 求导后变成 (a×i)×x^(i−1)。次数为零的是常数，导数为零，必须从新表里去掉这个常数位置，才能让剩余位置整体降低一次。',`新系数 = 原系数×原次数\n新次数 = 原次数−1`,table(['输入项','原系数','原次数','导数项'],[['x²','1','2','2x'],['3x','3','1','3'],['0','0','0','丢掉常数项的位置']])],
      ['状态里的次数从哪里来','diff 对降序表使用右折叠，所以先处理最右边的常数项。状态 s=(i,r)，初始为(0,[])：i 是这次读到的原次数，r 是已生成的导数系数表。每轮把 i 加一；i非零时用 rmul a i 算新系数，并插到 r 前。',`λa s.(λi r.pair (succ i)\n  (zero i r (cons (rmul a i) r))) (s t) (s f)\na=本轮有理数系数；s t→i；s f→r`,table(['从右侧读到的系数','更新前 (i,r)','这轮做什么','更新后 (i,r)'],[['0/1','(0,[])','i=0，丢掉常数位置','(1,[])'],['3/1','(1,[])','3/1×1=3/1，头插','(2,[3/1])'],['1/1','(2,[3/1])','1/1×2=2/1，头插','(3,[2/1,3/1])']])]
    );
    if(kind==='DIFF')steps.push(['结果是导函数的系数数据','最后取状态第二项，得到[2/1,3/1]，对应一次项2与常数项3，所以表示2x+3。它要交给多项式求值程序读取；直接把丘奇数字当参数应用到这个列表上，并不等于多项式代入。',`(pair 3 [2/1,3/1]) f → [2/1,3/1]\n结果表示：f′(x)=2x+3\n若要在2处求值：evalpoly [2/1,3/1] 2 → pair 7 1`]);
    if(kind==='DERIVATIVE')steps.push(['再把刚得到的导数系数代入2','主函数是先 diff，再 evalpoly。这里读的是新表[2/1,3/1]，已经不再使用旧表[1/1,3/1,0/1]。',`主函数：λfunction x.evalpoly (diff (encodepoly function)) x\n0×2+2=2\n2×2+3=7\n→ pair 7 1`,table(['本例比较','计算对象','结果'],[['原函数值','f(2)=2²+3×2','10'],['导数值','f′(2)=2×2+3','7']])]);
    if(integrate)steps.push(
      ['区分被积函数 f 与原函数 F','“原函数”是积分术语，指一个求导后能回到被积函数的函数。输入的是 f(x)=2x；程序要生成 F，使 F′(x)=2x。不是让你预先把积分算好后输入。',`输入：被积函数 f(x)=2x\n要求：F′(x)=f(x)\n一种结果：F(x)=x²，因为 (x²)′=2x`],
      ['反过来推导系数为什么除以新次数','若原来的一项是 a×x^i，设积分后是 b×x^(i+1)。对后者求导会得到 b×(i+1)×x^i，因此必须令 b=a/(i+1)。次数加一与系数相除要同时发生。',`b×(i+1)=a → b=a/(i+1)\n2x：i=1，a=2 → 新次数2，新系数2/2\n常数0：i=0，a=0 → 新次数1，新系数0/1`],
      ['用有序对保存分数，不提前截成小数','rdiv a n 取出a的分子、分母，只把分母乘n。2/2可以保持不约分，仍精确表示一；对输入函数x，同样会真的生成1/2这个系数。',`rdiv (pair 2 1) 2 → pair 2 (mul 1 2) → pair 2 2\nrdiv (pair 1 1) 2 → pair 1 2`],
      ['积分常数为什么先放在初始列表里','所有常数求导都为零，所以积分不能凭输入决定常数C。本程序约定C=0，把[0/1]作为初始结果表。每个旧系数产生一个更高次的新系数，追加出来的最末位置就专门留给C。',`初始状态：pair 0 (cons (pair 0 1) nil)\nλa s.(λi r.pair (succ i)\n  (cons (rdiv a (succ i)) r)) (s t) (s f)`,table(['从右侧读到的系数','更新前 (i,r)','这轮做什么','更新后 (i,r)'],[['0/1','(0,[0/1])','除以i+1=1，插到C前','(1,[0/1,0/1])'],['2/1','(1,[0/1,0/1])','除以i+1=2，头插2/2','(2,[2/2,0/1,0/1])']])],
      ['把新列表按位置读回原函数','新表有三项，分别对应二次、一次、常数项。只在显示时把2/2读成一；两个零位置保留，才能明确次数。',`[2/2,0/1,0/1] → (2/2)x²+0x+0 = x²\n若删成 [2/2]，它就只表示常数1，含义错误\n对 x² 求导 → 2x，核对回被积函数`]
    );
    if(kind==='DEFINITE')steps.push(
      ['为什么定积分做上限值减下限值','对这个多项式，定积分等于任一个原函数在端点处的差。原函数里即使加上常数C，做差时也会抵消。本程序选择C=0，使用刚刚生成的系数表计算两个端点。',`∫₀³ 2x dx = F(3)−F(0)\n=(9+C)−(0+C)=9\n参数先传下限a=0、上限b=3，做差顺序仍是 F(b)−F(a)`],
      ['用同一套逐层乘加算两个端点','对[2/2,0/1,0/1]，都从累计值0/1开始，每读一项就乘端点再加系数。输入端点的次数没有传给积分变换，而是在生成原函数以后才用于求值。',`evalpoly primitive 3；evalpoly primitive 0`,table(['读到的系数','上限x=3：新累计值','下限x=0：新累计值'],[['2/2','0×3+2/2=2/2','0×0+2/2=2/2'],['0/1','(2/2)×3+0=6/2','(2/2)×0+0=0/1'],['0/1','(6/2)×3+0=18/2','0×0+0=0/1']])],
      ['把两个有理数通分相减','上限值为18/2，下限值为0/1。这里rsub的第二个数分子为零，实际函数直接保留上限值；按通分公式手算也得到相同结果，页面读出时约分为9。',`18/2−0/1 = (18×1−0×2)/(2×1) = 18/2\n→ 页面约分显示9`]
    );
    const walkthrough={EVAL:'f(x)=2x²+3x+1 → [2/1,3/1,1/1] → 在2处求值 → 15/1',DIFF:'f(x)=x²+3x → [1/1,3/1,0/1] → 系数求导 → [2/1,3/1]，表示2x+3',DERIVATIVE:'f(x)=x²+3x → 系数求导 → [2/1,3/1] → 在2处求值 → 7/1',INTEGRATE:'被积函数 f(x)=2x → [2/1,0/1] → 系数积分 → [2/2,0/1,0/1]，表示原函数 F(x)=x²',DEFINITE:'被积函数 f(x)=2x → 生成原函数系数 [2/2,0/1,0/1] → F(3)−F(0) → 18/2−0/1 → 9'}[kind];
    return {core:'主函数 = '+C.format(main),symbols:bindings.map(({name,term})=>({name,source:C.format(term),meaning:meanings[name]})),featured:['encodepoly',evaluate?'evalpoly':differentiate?'diff':'integ',...(kind==='DEFINITE'?['evalpoly','rsub']:kind==='DERIVATIVE'?['evalpoly']:[])],inputs,steps,flow:table(['阶段','这时的数据','怎样理解'],flow),overview:goal,
      principle:[goal,'完整表达式先绑定辅助函数，最后才接收输入函数和数值参数。下面从输入的数学含义讲起，再追踪系数、序对和每一轮更新；所有简称都对应可展开的实际 λ 定义。'],walkthrough,
      encodingText:'输入是接收丘奇数的函数。内部系数表是丘奇列表；每个系数和最终数值是（分子，分母）有序对。它们使用不同的参数协议，不能只因为都写成 λ 就互换使用。',
      foundation:'丘奇自然数3 = λg z.g (g (g z))\n有理数3/1 = λselector.selector 3 1\n多项式系数表[3/1] = λc n.c (λselector.selector 3 1) n\n三者形状不同：分别接收迭代函数、选择器、列表组合函数。',
      basics:['先区分任务：求值返回某一点的数；求导改变整个函数；积分先生成导数等于被积函数的原函数，再决定是否计算端点差。','列表本身不保存“x²”的文字。它通过元素位置决定次数，因此二次项、一次项和常数项需要三个位，包括系数为零的位置。','本篇正文用 f(x) 表示输入函数。实际 λ 程序的参数名叫 function；局部辅助名 f 是假选择器。积分结果另外记作 F(x)，不再把两种含义都写成“原函数”。'],
      boundaries:['函数转系数的编码器要求输入是自然数系数多项式：它依赖 f(1) 是非负系数之和。不能据此处理任意函数、负系数或分数系数输入。积分生成的内部系数可以是分数，这是生成后的另一种数据表示。','零多项式在系数和为零时直接返回[0/1]，避免使用基数一反复除法。输入系数大或次数高时，f(B) 的丘奇表示可能很大。','积分常数固定取零。定积分端点要求是自然数且下限不大于上限，配合非负系数，保证内部截断减法不会需要负数。'],
      exercise:integrate?'用输入函数 λx.x 再做一遍：系数表是[1/1,0/1]，请按每一轮的次数写出新的三个系数，再检查对结果求导能否回到x。':'把输入函数换为 λx.x：先写出系数表中一次项和常数项的位置，再按本篇的状态更新检查结果。'};
  }
  const API={describe};root.LambdaGuidePolynomial=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
