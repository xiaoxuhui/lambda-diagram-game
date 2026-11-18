(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),M=root.LambdaPolynomial||require('./polynomial.js'),P=root.LambdaPresets||require('./presets.js');
  const helpers={
    I:['λx.x','恒等函数，原样返回参数；部分逆运算用它表示输入不适用，不能把它读成数值答案。'],
    TRUE:['λa b.a','真：选择第一个分支。'],FALSE:['λa b.b','假：选择第二个分支。'],
    PAIR:['λa b k.k a b','保存两项状态。PAIR a b TRUE 取 a，PAIR a b FALSE 取 b。'],
    SUCC:['λn f x.f (n f x)','后继：把函数作用次数增加一次。'],
    PRED:['λn f x.n (λg h.h (g f)) (λu.x) (λu.u)','前驱：略去第一次函数作用，零的前驱仍为零。'],
    ADD:['λm n f x.m f (n f x)','先作用 n 次，再作用 m 次，次数相加。'],
    MUL:['λm n f.m (n f)','把 n 次作用视为一段工作，再重复 m 次。'],
    SUB:['λm n.n PRED m','对 m 做 n 次前驱，差小于零时返回零。'],
    ISZERO:['λn.n (λx.FALSE) TRUE','零次迭代保留真，至少一次迭代把结果改为假。'],
    POW:['λbase exponent.exponent base','自然数乘方。两个参数分别是底数、指数。'],
    POWER:['λb e f x.e b f x','逆运算中使用的乘方写法。b 为底数、e 为指数，结果仍接收 f、x。'],
    Y:['λf.(λx.f (x x)) (λx.f (x x))','不动点组合子。Y F 可展开成 F (Y F)，把递归函数交回递归体；应使用正规序先选择终止分支。'],
    CHOOSE:['Y (λr n k.ISZERO k 1 (ISZERO n 0 (ADD (r (PRED n) (PRED k)) (r (PRED n) k))))','组合数递归体。r 是递归调用，先判 k=0，再判 n=0，最后把选与不选两类方案相加。'],
    PERM:['λn k.(k (λp.PAIR (PRED (p TRUE)) (MUL (p TRUE) (p FALSE))) (PAIR n 1)) FALSE','排列数。p 的两项为剩余选择数、累计乘积；重复 k 次，再取累计乘积。'],
    GEOSUM:['λb n.(n (λp.PAIR (MUL b (p TRUE)) (ADD (p FALSE) (p TRUE))) (PAIR 1 0)) FALSE','等比求和。状态为当前项、累计和；把旧项加入和，再把当前项乘公比。'],
    BINOM:['λa b n.(SUCC n (λp.(λk.PAIR (SUCC k) (ADD (p FALSE) (MUL (CHOOSE n k) (MUL (POW a (SUB n k)) (POW b k))))) (p TRUE)) (PAIR 0 0)) FALSE','二项式展开。n+1 轮覆盖 k=0 至 n；每轮计算组合数、两个幂和本项，再累加。'],
    TET:['λb h.h (POWER b) 1','超幂：高度 h 反复调用“以 b 为底求幂”，初值为 1。上一轮的值成为新指数。'],
    PENT:['λb h.h (TET b) 1','超超幂：反复调用“以 b 为底做超幂”，上一轮的值成为新幂塔高度。'],
    ATMOST:['λm n.m (λlater fuel.fuel (λrest.later rest) FALSE) (λfuel.TRUE) (n (λrest next done.next rest) (λnext done.done))','判断 m≤n。n 先生成 n 个 Scott 标记；m 每迭代一次消耗一个。提前耗尽返回假，m 次完成后仍未耗尽则返回真。'],
    SEARCH:['λop target start.(Y (λsearch candidate previous.(λvalue.ATMOST value target (ATMOST target value candidate (search (SUCC candidate) candidate)) previous) (op candidate))) start 0','单调逆搜索。op 是待求逆的函数；candidate 是当前候选，previous 是上次未超过目标的候选。小于目标则前进，相等直接返回，超过则返回 previous。'],
    ROOT:['λn degree.ISZERO degree I (SEARCH (λbase.POWER base degree) n 1)','自然数根：固定次数 degree，递增底数 base，搜索 base^degree≤n。'],
    QUOT:['λn divisor.ISZERO divisor (λk.k (λa b c.a) 0) (SEARCH (MUL divisor) n 0)','整数商：把“商乘除数”当作待求逆函数，从商零开始搜索；除数零先返回错误记录。'],
    LOG:['λbase n.ATMOST base 1 I (ISZERO n I (SEARCH (POWER base) n 0))','整数对数：底数至少为二、目标至少为一；固定底数，搜索指数。'],
    SLOG:['λbase n.ATMOST base 1 I (ISZERO n I (SEARCH (TET base) n 0))','整数超对数：固定底数，搜索幂塔高度。'],
    SROOT:['λn degree.ISZERO degree I (SEARCH (λbase.TET base degree) n 1)','整数超根号：固定幂塔高度，搜索底数。'],
    PROOT:['λn degree.ISZERO degree I (SEARCH (λbase.PENT base degree) n 1)','整数超超根号：固定超超幂的重复次数，搜索底数。'],
    PLOG:['λbase n.ATMOST base 1 I (ISZERO n I (SEARCH (PENT base) n 0))','整数超超对数：固定底数，搜索超超幂的重复次数。']
  };
  for(const power of [1,2,3])helpers['SUM'+power]=[
    `λn.(n (λp.(λi.PAIR i (ADD (p FALSE) (POW i ${power}))) (SUCC (p TRUE))) (PAIR 0 0)) FALSE`,
    `状态 p=(已处理的下标,累计和)。先生成新下标 i，再把 i 的 ${power} 次幂加到旧累计和。`
  ];
  function symbolsFor(key){
    const found=new Set(),symbols=[];
    function visit(name){if(found.has(name)||!helpers[name])return;found.add(name);
      const [source,meaning]=helpers[name];for(const dependency of C.freeVars(C.parse(source)))visit(dependency);
      symbols.push({name,source,meaning});}
    visit(key);return symbols;
  }
  const input=(name,value,encoding,role)=>({name,value,encoding,role});
  const natural=(name,value,role)=>input(name,String(value)+'_church','丘奇自然数',role);
  const stateIntro='状态 (a,b) 是 PAIR a b = λk.k a b。p TRUE 读取第一项，p FALSE 读取第二项。下面用普通数字跟踪状态，实际传递的每个数字都是丘奇函数。';
  const math={
    '组合数':{key:'CHOOSE',args:'4 2',inputs:[natural('n',4,'可供选择的不同元素数'),natural('k',2,'需要选出的元素数，顺序不计')],
      steps:[
        ['先理解计数对象','从 {甲,乙,丙,丁} 选两个，不区分甲乙和乙甲；因此不能直接算成 4×3。','甲乙、甲丙、甲丁、乙丙、乙丁、丙丁'],
        ['把递归体与自身连接','Y 把 CHOOSE 自身交给递归体的 r。随后 n 接收 4，k 接收 2，两个零判断均为假，进入最后的加法。','CHOOSE 4 2\n→ ADD (CHOOSE 3 1) (CHOOSE 3 2)'],
        ['为什么正好分成这两支','固定元素丁。选丁的方案还要从其余三个选一个；不选丁的方案要从其余三个选两个。两类不相交，也没有漏掉任何方案。','选丁：C(3,1)\n不选丁：C(3,2)'],
        ['展开左支并用终止条件收尾','k=0 表示已经选够，返回一种方案；n=0 且 k>0 表示没有元素可选，返回零。先判断 k 才能保证 C(0,0)=1。','C(3,1)=C(2,0)+C(2,1)\n=1+(C(1,0)+C(1,1))\n=1+(1+(1+0))=3'],
        ['展开右支','继续使用同样的递推，不把 C(3,2)=3 当作提前知道的答案。','C(3,2)=C(2,1)+C(2,2)\nC(2,1)=1+1=2\nC(2,2)=C(1,1)+C(1,2)=1+0=1'],
        ['合并为丘奇结果','ADD 把两段三次迭代串联，得到六次迭代。结果仍能作为其他 λ 函数的输入。','ADD 3 3 → λf x.f (f (f (f (f (f x)))))']
      ],boundaries:['k=0 返回 1，k>n 返回 0。n、k 都是自然数。','使用正规序先判断终止条件。递归树会重复计算子问题，较大输入会变慢。'],exercise:'把末尾 4 2 改为 3 2，亲自画出选与不选两支，标出每个返回 1 或 0 的叶子。'},
    '排列数':{key:'PERM',args:'4 2',inputs:[natural('n',4,'一开始可选的元素数'),natural('k',2,'依次选择几次，顺序不同算不同方案')],steps:[
      ['建立初始状态',stateIntro,'p₀ = PAIR 4 1'],
      ['拆开更新函数','剩余可选数在第一项，旧乘积在第二项；本轮乘旧的剩余数，再把它减一。','step = λp.PAIR (PRED (p TRUE)) (MUL (p TRUE) (p FALSE))'],
      ['第一次选择','把 p₀ 代入，p₀ TRUE→4，p₀ FALSE→1。选择一个元素有四种可能。','step (PAIR 4 1) → PAIR 3 (MUL 4 1) → PAIR 3 4'],
      ['第二次选择','丘奇 2 不是被加进结果，而是要求把 step 执行两次。每种首选之后还有三种次选。','2 step p₀ → step (step p₀)\nstep (PAIR 3 4) → PAIR 2 12'],
      ['只取累计乘积','函数最后的 FALSE 是选择器；它丢弃剩余可选数 2，返回方案数 12。','(PAIR 2 12) FALSE → FALSE 2 12 → 12']
    ],boundaries:['k=0 不执行更新，结果保留乘法初值 1。','k>n 时会乘到零，因此返回零；这里不接受负数或小数。'],exercise:'改为 4 3，每轮写出“旧状态→新状态”，注意本轮乘的是旧的剩余数。'},
    '等比求和':{key:'GEOSUM',args:'2 4',inputs:[natural('b',2,'公比，每轮当前项乘几'),natural('n',4,'项数，包含首项 1')],steps:[
      ['确定求和范围','从 b⁰=1 开始，一共 n 项，最后一项是 b^(n−1)。不是从 b 开始，也不是加到 bⁿ。','b=2，n=4：1+2+4+8'],
      ['解释两项状态',stateIntro,'p₀ = PAIR 1 0\n第一项=下一项要加入的数；第二项=已经加完的和'],
      ['读懂两个字段的更新','新和加的是旧当前项；新当前项则是旧项乘 b。两个值都从同一个旧 p 读取。','step = λp.PAIR (MUL b (p TRUE)) (ADD (p FALSE) (p TRUE))'],
      ['逐轮代入','丘奇 4 生成四次 step。每轮之后，第二项等于此前所有已加入项的和。','(1,0) → (2,1) → (4,3) → (8,7) → (16,15)'],
      ['选择返回值','最后第一项 16 是下一轮才会加入的数。本题只做四轮，因此返回第二项 15。','(PAIR 16 15) FALSE → 15']
    ],boundaries:['n=0 返回空和 0；n=1 返回首项 1。','b=0 时首项仍为 1，后续项为零。这里用逐项累加，不使用除以 b−1 的闭式公式。'],exercise:'把公比改成 3，项数改成 3，写出每轮当前项与累计和。'},
    '超幂':{key:'TET',args:'2 3',inputs:[natural('b',2,'每一层幂的底数'),natural('h',3,'幂塔高度')],steps:[
      ['先分清幂塔的结合方向','2↑↑3 是 2^(2^2)。幂塔从右往左结合；它不是先算 (2²)² 的一般规则。','3↑↑3 = 3^(3^3)，而不是 (3^3)^3'],
      ['把高度当作迭代器','固定 b=2 后，POWER 2 接收一个指数 e 并返回 2^e。h=3 要重复这个完整函数三次。','TET 2 3 → 3 (POWER 2) 1'],
      ['第一次更新','初值一对应高度零。第一次把它用作指数。','POWER 2 1 → 2'],
      ['第二次更新','上一轮的结果 2 成为新指数。','POWER 2 2 → 4'],
      ['第三次更新','本轮指数是整个上一轮结果 4，不是高度数字 3。','POWER 2 4 → 16\n3 (POWER 2) 1 → POWER 2 (POWER 2 (POWER 2 1))']
    ],boundaries:['高度零约定返回 1；正底数一的幂塔始终为 1。','输出是丘奇自然数，值与展开体会迅速变大。此运算不是列表小数乘方。'],exercise:'用 b=3、h=2 写出两次更新，再说明 h=3 时新指数是什么；不必展开巨大的最终丘奇数。'},
    '超超幂':{key:'PENT',args:'2 2',inputs:[natural('b',2,'每次超幂使用的固定底数'),natural('h',2,'重复超幂的次数')],steps:[
      ['确定比超幂多的一层迭代','超幂反复做乘方；超超幂反复做超幂。这里每轮结果是下一轮幂塔的高度。','PENT b h = h (TET b) 1'],
      ['展开丘奇次数','2 把 TET 2 调用两次，初值仍是一。','PENT 2 2 → TET 2 (TET 2 1)'],
      ['先算里面的一次超幂','高度一表示一层底数；按定义也可展开为 POWER 2 1。','TET 2 1 → 2'],
      ['再把结果当高度','第二次调用的高度为 2，所以算的是两层幂塔。','TET 2 2 → 2² → 4'],
      ['看清下一轮会变什么','如果次数改为三，第三轮的高度为四，不是三。','PENT 2 3 → TET 2 4 → 2^(2^(2^2)) = 65536']
    ],boundaries:['次数零返回 1。本示例的次数二不是指数二或幂塔高度二的通用别名。','层级上升使结果增长极快；较大例子不适合完整展开成一元丘奇数。'],exercise:'只写出 PENT 2 0、PENT 2 1、PENT 2 2、PENT 2 3 的迭代关系，比较 TET 与 PENT 的参数含义。'}
  };
  function summation(example){
    const p=example.name.startsWith('平方')?2:example.name.startsWith('立方')?3:1,n=p===1?5:3;
    return {key:'SUM'+p,args:String(n),inputs:[natural('n',n,'上界，包含从 1 到 n 的每个自然数')],steps:[
      ['先定义状态',stateIntro,'p₀ = PAIR 0 0\n第一项 k=已经处理到的下标；第二项 s=1^'+p+'+…+k^'+p],
      ['先生成新下标','λi 的参数来自 SUCC (p TRUE)。i 是新下标，旧累计和依旧从 p FALSE 读取。','step = λp.(λi.PAIR i (ADD (p FALSE) (POW i '+p+'))) (SUCC (p TRUE))'],
      ['把第一轮完全对应到变量','初始 p TRUE=0、p FALSE=0，所以 i=1。更新同时保存新下标与新总和。','step (PAIR 0 0)\n→ PAIR 1 (ADD 0 (POW 1 '+p+')) → PAIR 1 1'],
      ['让丘奇上界重复更新','每轮只加入新下标的这一项。下标 k 同时记录已经做了几轮。',p===1?'(0,0)→(1,1)→(2,3)→(3,6)→(4,10)→(5,15)':p===2?'(0,0)→(1,1)→(2,5)→(3,14)\n第二轮加入 2²=4，第三轮加入 3²=9':'(0,0)→(1,1)→(2,9)→(3,36)\n第二轮加入 2³=8，第三轮加入 3³=27'],
      ['解释结果是怎样被取出的','最后传入 FALSE，因此结果是累计和而不是最后一个下标。这里真正逐项调用 POW 和 ADD。','(n step (PAIR 0 0)) FALSE → 累计和']
    ],boundaries:['上界零不执行更新，返回 0。','表达式中的固定幂次数和最后的上界是两种参数：修改上界改变项数，修改 POW 后面的常数才改变各项的幂。'],exercise:'把上界改为 2，分别写出两次 step 的 λ 参数代入与有序对结果。'};
  }
  function binomial(example){
    const sum=example.name.startsWith('二项式系数'),b=sum?1:2;
    return {key:'BINOM',args:`1 ${b} 3`,inputs:[natural('a',1,'括号内第一个加数'),natural('b',b,'括号内第二个加数'),natural('n',3,'展开次数，产生 n+1 项')],steps:[
      ['先把求和符号读成循环','Σ 表示把各项相加；k 从零到 n。每项包含组合数、a 的幂和 b 的幂。','term(k)=C(n,k)×a^(n−k)×b^k\nk=0,1,…,n'],
      ['说明组合数为什么出现','展开 n 个 (a+b) 的乘积时，选 k 个位置取 b，其余取 a；选位置共有 C(n,k) 种，所以相同幂次的项需要这个系数。','n=3：系数依次为 1、3、3、1'],
      ['初始化下标与和',stateIntro,'p₀=PAIR 0 0\nSUCC n = 4，所以执行四轮；不能只执行三轮'],
      ['对应到 λ 函数体','λk 接收 p TRUE；程序算本项，加进 p FALSE，再把下标改为 SUCC k。','term = MUL (CHOOSE n k) (MUL (POW a (SUB n k)) (POW b k))\n新状态 = PAIR (SUCC k) (ADD (p FALSE) term)'],
      ['逐项算，不跳过中间项','下面每一行对应一次状态更新。',sum?'k=0：1×1³×1⁰=1 → (1,1)\nk=1：3×1²×1¹=3 → (2,4)\nk=2：3×1¹×1²=3 → (3,7)\nk=3：1×1⁰×1³=1 → (4,8)':'k=0：1×1³×2⁰=1 → (1,1)\nk=1：3×1²×2¹=6 → (2,7)\nk=2：3×1¹×2²=12 → (3,19)\nk=3：1×1⁰×2³=8 → (4,27)'],
      ['取回总和并核对','最后的 FALSE 选第二项。系数和例子把 a、b 都设为一，所以两个幂的值总是一；程序仍执行同一套展开。',sum?'总和 1+3+3+1=8，与 (1+1)³ 一致':'总和 1+6+12+8=27，与 (1+2)³ 一致']
    ],boundaries:['n=0 仍做一轮 k=0，返回 1。','CHOOSE 使用递归，建议正规序从左到右；较大的 n 会有重复子问题。'],exercise:'改为 a=2、b=1、n=2，列出三项的组合系数、指数和累计和。'};
  }
  const inverse={
    '开根号':['ROOT','10 2','根号内的数',10,'根指数',2,'base^2',1,'1²=1<10 → 候选2，上次1\n2²=4<10 → 候选3，上次2\n3²=9<10 → 候选4，上次3\n4²=16>10 → 返回上次3','固定根指数 2，变化的是底数。返回的是 ⌊√10⌋=3，不是近似小数平方根。'],
    '整数除法':['QUOT','7 2','被除数',7,'除数',2,'2×candidate',0,'2×0=0<7 → 候选1\n2×1=2<7 → 候选2\n2×2=4<7 → 候选3\n2×3=6<7 → 候选4，上次3\n2×4=8>7 → 返回3','固定除数 2，变化的是整数商。余数可用 7−2×3=1 核对；此函数只返回商。'],
    '对数':['LOG','2 9','对数底数',2,'真数',9,'2^candidate',0,'2⁰=1<9 → 候选1\n2¹=2<9 → 候选2\n2²=4<9 → 候选3\n2³=8<9 → 候选4，上次3\n2⁴=16>9 → 返回3','固定底数 2，变化的是指数。这是向下取整的 log₂9；检查 2³≤9<2⁴。'],
    '超对数':['SLOG','2 16','固定底数',2,'目标值',16,'2↑↑candidate',0,'高度0：1<16\n高度1：2<16\n高度2：4<16\n高度3：16=16 → 直接返回3','超对数反求幂塔高度。程序遇到精确相等会直接结束，不需要真的生成高度四的巨大数。'],
    '超根号':['SROOT','4 2','目标值',4,'固定幂塔高度',2,'candidate↑↑2',1,'底数1：1↑↑2=1<4\n底数2：2↑↑2=4=4 → 直接返回2','超根号固定高度，变化的是底数。它与固定底数、变化高度的超对数解的是不同参数。'],
    '超超根号':['PROOT','4 2','目标值',4,'固定超超幂次数',2,'candidate↑↑↑2',1,'底数1：1↑↑↑2=1<4\n底数2：2↑↑↑2=4=4 → 直接返回2','固定超超幂重复次数，变化的是底数；不是普通平方根，也不是把目标值再开一次根。'],
    '超超对数':['PLOG','2 4','固定底数',2,'目标值',4,'2↑↑↑candidate',0,'次数0：1<4\n次数1：2<4\n次数2：4=4 → 直接返回2','固定底数，变化的是超超幂重复次数。例子的结果二不能套用到普通对数或超对数。']
  };
  function inverseLesson(name){
    const [key,args,label1,a,label2,b,operation,start,trace,meaning]=inverse[name];
    return {key,args,inputs:[natural(label1,a,label1),natural(label2,b,label2)],steps:[
      ['先确认到底在求哪个参数',meaning,'op(candidate) = '+operation],
      ['理解统一的搜索接口','SEARCH op target start 把当前候选与上次有效候选交给递归函数。op 是函数参数，不是写死的数学符号。','SEARCH = λop target start.(Y (λsearch candidate previous.…)) start 0\n当前起点 = '+start],
      ['理解比较为什么能提早结束','ATMOST m n 先用 n 造一个 n 格的 Scott 标记链。m 的每次函数作用消耗一格；标记耗尽而 m 还要求继续，就立即是假。比较巨大幂值时不必先把它整个展开完。','next = λrest next done.next rest\nend = λnext done.done\nm≤n：m 次消耗后仍能结束 → TRUE\nm>n：先遇到空链 → FALSE'],
      ['拆开搜索中的两个选择器','先检查 value≤target。假就返回 previous；真再反向检查 target≤value。两边都真说明相等，返回 candidate；只有前者真说明还小，要继续下一候选。','ATMOST value target\n  (ATMOST target value candidate (search (SUCC candidate) candidate))\n  previous'],
      ['用本例逐个代入候选','每行都实际调用一次 op，再按上一步的分支决定继续或返回。',trace],
      ['解释返回数据','得到的候选是一个丘奇自然数。整数向下取整意味着选择最后一个未超过目标的候选；没有生成负数或小数答案。',meaning]
    ],boundaries:key==='QUOT'?['除数零返回除零错误，不进入搜索。','被除数小于正除数时商为零；例如 1÷2 在这里是零，列表小数除法才能返回 0.5。']:['根运算的固定次数必须大于零；对数类底数至少为二，目标至少为一。无效输入按该函数约定返回 I，I 不是数值答案。','搜索依赖对应运算的单调性。正整数底数和上述参数范围是本例的前提。'],exercise:'根据本篇的参数顺序改一个输入，列出 candidate、op(candidate)、previous，再判断是哪一次返回。'};
  }
  const polyMeaning={
    t:'真选择器，pair 的第一项是分子或状态下标。',f:'假选择器，pair 的第二项是分母或累计列表。',pair:'有序对。系数用 pair 分子 分母；迭代状态也用相同结构，但字段含义随用途变化。',nil:'丘奇空列表，直接返回折叠初值。',cons:'丘奇列表头插，折叠时调用 c 当前系数 (尾表 c 初值)。',
    add:'丘奇自然数加法。',mul:'丘奇自然数乘法。',succ:'丘奇后继，增加一次迭代。',pred:'丘奇前驱，零保持零。',sub:'自然数截断减法。',zero:'自然数零判断。',
    rmul:'有理数 a 乘自然数 n。a t 取分子、a f 取分母，结果为 (分子×n)/分母；乘零直接返回 0/1。',rdiv:'有理数 a 除以正自然数 n。分子保留，分母乘 n；没有做宿主语言除法。',radd:'有理数通分相加，分子为 a分子×b分母+b分子×a分母，分母为两分母乘积。零分子分支可以直接返回另一项。',rsub:'有理数通分相减；分子的减法仍是自然数截断减法，因此定积分例子要求端点按顺序、系数非负。',
    diff:'从常数项开始向左折叠，状态为(当前次数,导数系数表)。次数零丢掉常数项，其他项把系数乘次数后头插。',integ:'从常数项开始向左折叠，状态为(当前次数,原函数系数表)。把系数除以次数加一后头插；初始尾表含积分常数 0/1。',fold:'把丘奇列表的右折叠改接为从最高次到常数项更新累计值，让 Horner 法按正确顺序执行。',evalpoly:'Horner 求值。累计值从 0/1 开始，每读到一个降序系数就计算“累计值×x+系数”。',
    divmod:'对丘奇数做除法并把商、余数交给 emit。内部用基数减一格的标记链控制何时把余数归零、商加一。',encodepoly:'输入原丘奇函数。先取系数和 f(1)，以 f(1)+1 为基数，从 f(基数) 的余数逐项提取系数；零多项式单独处理。'
  };
  function unpack(program){const bindings=[];let main=typeof program==='string'?C.parse(program):program;while(main.type==='app'&&main.fn.type==='abs'){bindings.push({name:main.fn.param,term:main.arg});main=main.fn.body;}return {bindings,main};}
  function polynomial(example){
    const kind=example.name.startsWith('多项式')?'EVAL':example.name.startsWith('符号求导')?'DERIVATIVE':example.name.startsWith('定积分')?'DEFINITE':example.name.startsWith('生成导函数')?'DIFF':'INTEGRATE';
    const linear=['DEFINITE','INTEGRATE'].includes(kind),evaluation=kind==='EVAL';
    const formula=evaluation?'2x²+3x+1':linear?'2x':'x²+3x';
    const {bindings,main}=unpack(M.churchProgram(kind));
    const originalSource=M.churchFunction(evaluation?[1,3,2]:linear?[0,2]:[0,3,1]);
    const inputs=[input('function','f(x)='+formula,'丘奇多项式函数 λx.…','输入原函数；实际 λ 写法见第1步，不要预先输入导函数或原函数')];
    if(['EVAL','DERIVATIVE'].includes(kind))inputs.push(natural('x',2,'求值时的代入点'));
    if(kind==='DEFINITE')inputs.push(natural('a',0,'积分下限'),natural('b',3,'积分上限'));
    const steps=[
      ['明确函数输入与内部数据的区别','原函数接收丘奇 x 并用丘奇加乘算 f(x)。后面的求导、积分程序不能靠函数名猜系数，所以把 encodepoly 放在主函数内部，先生成系数表。下方是可替换到完整程序末尾的原函数 λ 写法，add、mul 已在它内部定义。','原函数 f(x)='+formula+'\n'+originalSource+'\n内部输出：降序系数表，每个系数保存为 pair 分子 分母'],
      ['为什么 f(1) 能给出基数','自然数系数 aᵢ 都非负，所以 f(1)=Σaᵢ 至少等于每一个系数。选 b=f(1)+1 后，所有系数都小于 b，没有进位混淆。',evaluation?'f(1)=2+3+1=6 → b=7\nf(7)=2×49+3×7+1=120':linear?'f(1)=2 → b=3\nf(3)=6':'f(1)=1+3=4 → b=5\nf(5)=25+15=40'],
      ['除以基数，实际抽出系数','divmod 返回商和余数，先得到常数项，随后得到一次项、二次项。每个余数都头插到列表，因此最终列表按最高次到常数项排列。',evaluation?'120÷7=(商17,余1)\n17÷7=(商2,余3)\n2÷7=(商0,余2)\n→ [2/1,3/1,1/1]':linear?'6÷3=(商2,余0)\n2÷3=(商0,余2)\n→ [2/1,0/1]':'40÷5=(商8,余0)\n8÷5=(商1,余3)\n1÷5=(商0,余1)\n→ [1/1,3/1,0/1]'],
      ['有理数也是函数，不是小数文本','例如 1/2 保存为 pair 1 2 = λk.k 1 2；t 取分子，f 取分母。rdiv a n 只需把分母乘 n，因此积分得到的分数不会先变成有限小数。','rdiv (pair 1 1) 2 → pair 1 (mul 1 2) → pair 1 2']
    ];
    if(evaluation)steps.push(
      ['把降序系数接到 Horner 更新','fold 依次传入 2/1、3/1、1/1，更新 g=λr a.radd (rmul r x) a。这样不需要每项单独算幂。','从 0/1 开始\n0×2+2=2\n2×2+3=7\n7×2+1=15'],
      ['辨认输出形状','主函数返回有理数 pair 15 1。页面读取分子、分母后显示 15；它不是丘奇自然数 15 的同一个 λ 结构。','pair 15 1 → λk.k 15 1']
    );
    else if(!linear)steps.push(
      ['把导数规则落实为列表状态','diff 使用右折叠，所以从常数项开始，状态第一项 i 就是当前原次数。i=0 不把常数加入结果；随后系数乘 i，次数自然降低一。','(i=0,[])：读 0/1，略去 → (1,[])\n读 3/1：rmul (3/1) 1=3/1 → (2,[3/1])\n读 1/1：rmul (1/1) 2=2/1 → (3,[2/1,3/1])'],
      [kind==='DIFF'?'返回导函数的系数数据':'再把导数代入 x=2',kind==='DIFF'?'[2/1,3/1] 代表 2x+3。这是可交给多项式求值程序的系数数据，不是已经算好的某个函数值。':'DERIVATIVE 在 diff 后调用 evalpoly，使用刚刚得到的导数系数表，不会把原来的 f(2) 当成导数。',kind==='DIFF'?'系数表 [2/1,3/1] → 2x+3':'0×2+2=2\n2×2+3=7\n→ pair 7 1']
    );
    else steps.push(
      ['把积分规则落实为列表状态','integ 同样从常数项向左折叠。次数 i 的系数除以 i+1；结果表初值为 [0/1]，代表积分常数 C=0。','初值 (0,[0/1])\n读常数 0/1：除以1 → (1,[0/1,0/1])\n读一次项 2/1：除以2 → (2,[2/2,0/1,0/1])'],
      ['解释新系数为什么对应原函数','列表长度多了一项，次数从一变二。2/2 精确代表一，页面约分后读作 x²；系数结构本身不必先约分。','F(x)=(2/2)x²+0x+0 = x²\nF′(x)=2x，回到原输入']
    );
    if(kind==='DEFINITE')steps.push(
      ['分别代入上下限','同一个新生成的原函数被送入两次 evalpoly。上下限顺序是先 a 后 b，但做差是上限值减下限值。','F(3)=0×3+2/2 → (2/2)×3+0=3 → 3×3+0=9\nF(0)=0\n准确有理数分别可保留为 18/2 和 0/1'],
      ['对端点结果通分相减','rsub 读取两个有理数的分子、分母，计算上限减下限。积分区间非负且原系数非负，保证分子差不会需要负数编码。','18/2−0/1 = (18×1−0×2)/(2×1) = 18/2 → 页面约分为9']
    );
    return {core:'主函数 = '+C.format(main),symbols:bindings.map(({name,term})=>({name,source:C.format(term),meaning:polyMeaning[name]})),inputs,steps,
      encodingText:'输入是原丘奇函数；程序内部把它编码为降序系数表。系数和求值结果采用有理数有序对，不能与列表小数记录混用。',
      foundation:'有理数 a/b = λk.k a b\n降序表 [a₂,a₁,a₀] = λc n.c a₂ (c a₁ (c a₀ n))\nHorner 更新 = λr a.radd (rmul r x) a\n主函数中的 encodepoly 先把原函数转为上述列表',
      basics:['原函数、导函数和在某一点的函数值是三件不同的事。本例主函数接收原函数，内部生成系数数据，再按所选操作返回函数数据或一个有理数。','系数表按次数降序保存，但求导与积分的右折叠先访问常数项，因此状态中的 i 可从零逐次增加。','λfunction.… 中的 function 就是末尾传入的原 λx.…。encodepoly、diff、integ、evalpoly 都在同一个完整 λ 程序里。'],
      boundaries:['抽取系数的方法只适用于自然数系数多项式。负系数或分数系数输入不满足 f(1) 的基数证明；虽然积分后的内部系数可以是分数，也不能反推输入编码器支持任意分数系数函数。','零多项式在系数和为零时单独编码成 [0/1]，避免把基数一用于逐位提取。定积分要求自然数下限不大于上限。','实际没有输入任意函数就自动做通用符号分析；这里依赖上述多项式前提。较大系数或次数会使 f(b) 的丘奇表示很大。'],
      exercise:kind==='DEFINITE'?'把原输入改为丘奇函数 λx.x，保留下限 0、上限 3；先写出内部原函数的分数系数，再算两个端点。':'把原输入改为丘奇函数 λx.x，逐步写出 f(1)、基数、系数表，再按本篇操作计算。'};
  }
  const decimalInputRoles={ADD:['第一个加数','第二个加数'],SUB:['被减数','减数'],MUL:['第一个因数','第二个因数'],DIV:['被除数','除数'],NEG:['要取负的数'],ABS:['要取绝对值的数'],POW:['底数','指数，决定乘法次数'],SHL:['要翻倍的小数'],SHR:['要减半的小数'],SQRT:['非负的根号内数'],SIN:['弧度角'],COS:['弧度角'],TAN:['弧度角'],SINH:['自变量'],COSH:['自变量'],TANH:['自变量']};
  const decimalSteps={
    ADD:[
      ['把两个输入拆成记录','0.1 的数位表是 [1]、位数是一；0.2 的数位表是 [2]、位数也是一。符号都为假，表示非负。','a=(非负,[1],1,精确)\nb=(非负,[2],1,精确)'],
      ['为什么要先对齐','位数一表示以十分之一为单位。maxScale 取较大位数，alignAt 在位数较少的一侧补低位零，数位整数和位数一起变化才保持值不变。此例已经对齐。','align a b k → k [1] [2] 1\n另例 1.2+0.03：([2,1],1)→([0,2,1],2)'],
      ['选择正负分支','sumAligned 接收两个符号、近似标记、对齐数位和公共位数。xor 假 假→假，于是选同号的 plus 分支。','sumAligned f f f [1] [2] 1\n→ make f (plus [1] [2] 0) 1 f'],
      ['按位加出结果','head 读当前数位，tail 读剩余表。先算 1+2+进位0=3，小于十，不向后进位；两个尾表都空，且进位零，结束递归。','plus [1] [2] 0\n→ cons 3 (plus [] [] 0)\n→ cons 3 nil'],
      ['构造并解读','make 保存 [3] 与位数一，因此数值是 3/10=0.3；这里从未把 0.1 或 0.2 交给浮点加法。','make f [3] 1 f → 0.3'],
      ['补上进位的边界','若当前和为十或更大，当前位减十，下一位的 carry 为一。即使两个输入表都结束，也要把最后进位保存。','0.9+0.2：9+2=11 → 当前位1，进位1\n数位表 [1,1]，位数1 → 1.1']
    ],
    SUB:[
      ['将减法接到已有加法','dsub = λa b.dadd a (negate b)。先对 b=2 翻转符号，得到负二；a=1 保持非负。','dsub 1 2 → dadd 1 (negate 2) → dadd 1 (−2)'],
      ['对齐并识别异号','两边小数位数都为零。xor f t→t，不能直接把绝对值相加，进入比较分支。','数位 a=[1]，b=[2]，公共位数0\ncmp [1] [2] → 1（左边较小）'],
      ['先决定大减小与符号','较大的绝对值二来自负输入，所以选择负号，并调用 minus [2] [1] 0。这样自然数数位操作不会需要表示负数。','sumAligned f t f [1] [2] 0\n→ make t (minus [2] [1] 0) 0 f'],
      ['执行一位减法','当前位 2 足够减去 1+借位0，返回一；尾表为空后递归结束。','minus [2] [1] 0 → cons 1 nil'],
      ['把符号与绝对值合回去','make 中的真表示负，数位 [1] 与位数零表示绝对值一，所以输出负一。','make t [1] 0 f → −1'],
      ['解释借位与零','例如 1.00−0.25 的整数数位为100−25：个位0不足减5，借一；十位0不足减2+旧借位1，再借一。绝对值相等则返回零，make 清掉负号。','100−25：个位5，十位7，百位0\ntrim 后 [5,7]，位数2 → 0.75']
    ],
    MUL:[
      ['分开处理数位与小数点','0.2 是 2/10，0.3 是 3/10。先乘两个数位整数，再把分母的十次幂相乘。','(2/10¹)×(3/10¹) = (2×3)/10²'],
      ['对应主函数的三个字段','times 负责数位乘积，add 负责位数相加，xor 负责符号。两者近似标记用 or 合并。','dmul a b\n→ make (xor f f) (times [2] [3]) (add 1 1) (or f f)'],
      ['展开一位部分乘积','times 读取乘数的当前位三，timesdigit 把被乘数每位乘三，并调用 split 把乘积拆成十进制进位与余数。','split (2×3+0) → pair 0 6\n当前位6，进位0 → [6]'],
      ['解释多位时怎样拼接','乘数下一位高一位，其部分乘积就需要在低位端补零。times 用 cons 0 做这个位移，再由 plus 加到本轮部分乘积。','12×13：12×3=36\n12×1 向高位移一位=120\n36+120=156'],
      ['回到本例的小数记录','数位乘积六，位数二，符号非负、近似为假；小数点是记录的位数字段决定的。','make f [6] 2 f → 6/100 → 0.06']
    ],
    ABS:[
      ['读出输入四个有效字段','−2.75 的符号为真，低位在前的数位为 [5,7,2]，位数二，近似标记为假。','a=λk.k i t [5,7,2] 2 f'],
      ['解释字段选择器','digits a 把选择器 λtag s d p e.d 传给记录，得到数位表；scale 与 approx 按同样方法返回位数和近似标记。','digits a → [5,7,2]\nscale a → 2\napprox a → f'],
      ['把主函数代入','绝对值不是像 NEG 一样取反，而是无论原符号是什么，都把新符号指定为假。','dabs a = make f (digits a) (scale a) (approx a)\n→ make f [5,7,2] 2 f'],
      ['构造相同绝对值的非负记录','make 整理数位并打包。275 和位数二都未改变，所以只是去掉负号。','λk.k i f [5,7,2] 2 f → 2.75'],
      ['区分绝对值与取负','对正数取绝对值仍是正数；取负才会把正数变成负数。零在两种运算中都规范成非负。','ABS 2.75=2.75\nNEG 2.75=−2.75']
    ],
    POW:[
      ['分清两种输入编码','底数 −0.5 是列表小数，指数 3 是丘奇自然数。指数是循环次数，不能把同形文本的列表小数三当作它传入。','dpow (−0.5_decimal) (3_church)\n→ powerBy (−0.5_decimal) 3 one'],
      ['解释三个递归参数','powerBy 的 a 是固定底数，n 是还需相乘的次数，acc 是当前累计乘积。初值 one 是列表小数一。','powerBy = y (λr a n acc.zero n acc\n  (force (dmul a acc) (λnext.r a (pred n) next)))'],
      ['完成第一次乘法','n=3 非零，调用 dmul −0.5 1。force 把这一轮符号、数位、位数归约成可读取记录，再传给下一轮 next。','(n=3,acc=1) → (n=2,acc=−0.5)'],
      ['继续两轮并跟踪符号','负乘负变正，再乘负变负。小数位数按乘法规则累加，因此没有借助浮点乘方。','(2,−0.5) → (1,0.25) → (0,−0.125)'],
      ['零判断选择结束分支','n=0 时 ISZERO 选择 acc，丢弃继续相乘的分支。结果是已累积的三次乘积。','powerBy a 0 (−0.125) → −0.125'],
      ['解释零指数','如果一开始 n 就为零，立即返回初值 one。这个程序不支持负指数，也没有默认求倒数。','dpow a 0 → 1_decimal']
    ],
    SQRT:[
      ['平方根与自然数根搜索的区别','本例求非负实数平方根的有限小数近似，不是高等数学里“候选平方不超过目标”的整数搜索。负号为真先返回定义域错误，零直接返回零。','输入 a=2_decimal\n目标是求 x≥0，使 x²=2'],
      ['由方程推出牛顿更新','对 g(x)=x²−a，切线修正为 x−g(x)/(2x)=(x+a/x)/2。取 a 与一的较大者作初值，避免除以零。','x₀=max(a,1)=2\nx下一轮=(x+a/x)×0.5'],
      ['把公式接到 λ 主体','current 是旧估计；ddiv 4 先算四位除法，ratio 接收商，work 再整理平均值至四位。递归参数 next 就是新估计。','force (ddiv 4 a current) (λratio.\n  work (dmul half (dadd current ratio)) (λnext.…))'],
      ['列出实际截断的前三轮','工作位数四不是四舍五入，而是丢掉更低小数位；下一轮使用的是已经截断的新值。','current=2：ratio=1，next=1.5\ncurrent=1.5：ratio=1.3333，next=1.4166\ncurrent=1.4166：ratio=1.4118，next=1.4142'],
      ['解释为什么会停','下一轮四位商为1.4142，平均后仍为1.4142。nonnegativeLess next current 为假，递归分支被丢弃，返回 current。','current=1.4142 → next=1.4142\n不再严格下降 → 返回1.4142'],
      ['解释最终显示与近似标记','estimate 再截到三位小数并把近似标记设为真，所以显示 ≈1.414；它不是对 √2 的精确有限表示。','cut 3 (1.4142) → 1.414\napprox = TRUE → ≈1.414']
    ]
  };
  function division(example,precision){
    const signed=example.name.startsWith('带符号'),reciprocal=example.name.startsWith('倒数');
    const first=signed?'−7.5':reciprocal?'1':'1',second=signed?'2':reciprocal?'0.4':'8';
    const process=signed?'75÷20：整数商3，余15\n150÷20：下一位7，余10\n100÷20：下一位5，余0':reciprocal?'10÷4：整数商2，余2\n20÷4：下一位5，余0':'1÷8：整数商0，余1\n10÷8：下一位1，余2\n20÷8：下一位2，余4\n40÷8：下一位5，余0';
    return [
      ['明确参数与精度','ddiv 先接收一个丘奇精度参数，再接收被除数 a 与除数 b。页面设置会放进完整函数里；商的小数位数由它决定。',`ddiv ${precision} (${first}_decimal) (${second}_decimal)`],
      ['对齐成同一个整数单位','align 取公共位数，把两边乘同一个十的幂，因此商不变。sign 字段单独保留，不参与绝对值长除法。',signed?'−7.5÷2 → 绝对值75÷20，公共位数1':reciprocal?'1÷0.4 → 10÷4，公共位数1':'1÷8 → 1÷8，公共位数0'],
      ['解释为什么给被除数补零','若对齐后的绝对值为 A、B，需要 p 位小数，就做整数除法 floor(A×10^p/B)，再把结果记为 p 位小数。主函数中的 pad 正在做这件事。',`longdiv (reverse (pad A ${precision})) B nil nil\n低位表先补零，再 reverse 成高位先读`],
      ['拆开一轮长除法','带入新一位 h 后，部分被除数等于旧余数×10+h。divstep 反复减 B，输出这一位商与新余数；长除法继续带入下一位。','divstep 部分被除数 B (λdigit remainder.… )\n新的余数必须小于 B，下一位商因此在0到9之间'],
      ['用本例核对商位','下面用传统小数长除法顺序解释同一算法。实际 pad 一次放好零位；若设置的精度不足，就在相应位数截断。',process],
      ['保存符号与精确性','两个符号异或决定商的正负。最终余数零且输入都精确时，结果精确；否则 approx 为真，显示 ≈。',`本例设置：${precision} 位小数\n负号：${signed?'真，因为两输入异号':'假，因为两输入均非负'}\n余数未归零或输入已近似 → 保留近似标记`],
      ['检查除零分支与倒数含义','empty (digits b) 为真说明除数的规范数位表为空，也就是零，此时直接返回错误记录。倒数就是把 a 固定为一后使用同一个除法函数。','倒数 x = ddiv precision 1_decimal x\nx=0 时仍是除零错误']
    ];
  }
  function seriesSteps(operation){
    const hyper=operation.includes('H'),odd=['SIN','SINH'].includes(operation),tangent=['TAN','TANH'].includes(operation),cosine=['COS','COSH'].includes(operation);
    const prefix=hyper?'双曲':'圆';
    const coefficient=hyper?(cosine?'1, 0.5, 0.041667, 0.001389, 0.000025':'1, 0.166667, 0.008333, 0.000198'):(cosine?'1, −0.5, 0.041667, −0.001389, 0.000025':'1, −0.166667, 0.008333, −0.000198');
    const trace=hyper?(cosine?'z=0.25\n0.001389+z×0.000025 → 0.0013\n0.041667+z×0.0013 → 0.0419\n0.5+z×0.0419 → 0.5104\n1+z×0.5104 → 1.1276':'z=0.25\n0.008333+z×0.000198 → 0.0083\n0.166667+z×0.0083 → 0.1687\n1+z×0.1687 → 1.0421\n−0.5×1.0421 = −0.52105'):(cosine?'z=0.25\n−0.001389+z×0.000025 → −0.0013\n0.041667+z×(−0.0013) → 0.0413\n−0.5+z×0.0413 → −0.4896\n1+z×(−0.4896) → 0.8776':'z=0.25\n0.008333+z×(−0.000198) → 0.0082\n−0.166667+z×0.0082 → −0.1646\n1+z×(−0.1646) → 0.9588\n0.5×0.9588=0.4794');
    const steps=[
      ['先说明函数定义和输入单位',hyper?'双曲函数由指数定义：sinh x=(e^x−e^(−x))/2，cosh x=(e^x+e^(−x))/2；tanh 是两者的商。它们不是把弧度角放到圆上的同一种函数。当前实现用这些函数在零附近的多项式近似。':'圆三角函数输入是弧度；一整圈为2π弧度。sin、cos 是单位圆上的纵、横坐标，tan 是纵坐标与横坐标的比。0.5不是0.5度。',hyper?'sinh(−x)=−sinh(x)\ncosh(−x)=cosh(x)':'sin(0)=0，cos(0)=1\nπ/2 弧度=90°'],
      ['解释近似多项式的来源',hyper?'指数函数展开 e^x=1+x+x²/2!+x³/3!+…；做和后奇次项抵消得到 cosh，做差后偶次项抵消得到 sinh。分母的阶乘来自展开系数。':'sin 和 cos 在零附近的泰勒展开由各阶导数决定。sin 的导数循环为 cos、−sin、−cos、sin，因此系数交替正负；cos 使用偶次项。',hyper?'sinh x≈x+x³/3!+x⁵/5!+x⁷/7!\ncosh x≈1+x²/2!+x⁴/4!+x⁶/6!+x⁸/8!':'sin x≈x−x³/3!+x⁵/5!−x⁷/7!\ncos x≈1−x²/2!+x⁴/4!−x⁶/6!+x⁸/8!'],
      ['实际代码没有无穷求和','程序把阶乘倒数保存成有限小数系数，只计算列出的有限项。每个数都是列表小数，不是一个原生三角函数调用。3!=6、5!=120、7!=5040；偶次项的2!=2、4!=24、6!=720、8!=40320。这说明系数的分母从哪里来。',`本篇所用${prefix}函数系数：${tangent?'正弦与余弦两组，下面展开两者的 Horner 过程':coefficient}\nwork：中间结果截至4位小数\nestimate：输出截至3位并标记近似`]
    ];
    if(!hyper)steps.push(
      ['先折回到适合多项式的小角度','sinAngle 先取绝对值并记住符号，再去掉整周期。fullWave 处理超过π的负号，halfWave 用 sin(π−x)=sin x，smallSin 在超过π/4时用 sin x=cos(π/2−x)。','|x| → 去掉 floor(|x|/(2π)) 个周期\n→ 半波映射 → 小区间多项式'],
      ['将本例角度与对应分支对上',cosine?'cosAngle 先计算 x+π/2。x=0.5 时，经过半波映射与 smallSin 的余角转换，最终用 cosSeries 计算0.5。':'x=0.5 小于π/4，正弦直接进入 sinSeries。正切则还要用 cosAngle 生成另一份余弦工作值。',cosine?'0.5+π/2 → π−(0.5+π/2)=π/2−0.5\nsmallSin 再取余角 → cosSeries 0.5':'sinSeries 0.5\nπ采用3.14159265，所以周期缩减也有有限精度误差']
    );
    else steps.push(['检查当前实现的适用范围','withinRange 先比较输入绝对值与一。数学上的双曲函数可以定义在更大范围，但本示例的有限多项式只接受 −1 到1，超出时返回范围错误。','nonnegativeLess one (dabs x) rangeError (op x)']);
    if(tangent)steps.push(
      ['分别按 Horner 法计算两组多项式','先算 z=x²=0.25。正弦组算成 x×(c₀+z×(c₁+z×(c₂+z×c₃)))，余弦组算成 c₀+z×(c₁+z×(c₂+z×(c₃+z×c₄)))。下列每层箭头先完成加乘，再向零截成四位。',hyper?'正弦组：0.008333+z×0.000198 → 0.0083\n0.166667+z×0.0083 → 0.1687\n1+z×0.1687 → 1.0421，再乘0.5得0.52105\n余弦组：0.001389+z×0.000025 → 0.0013\n0.041667+z×0.0013 → 0.0419\n0.5+z×0.0419 → 0.5104\n1+z×0.5104 → 1.1276':'正弦组：0.008333+z×(−0.000198) → 0.0082\n−0.166667+z×0.0082 → −0.1646\n1+z×(−0.1646) → 0.9588，再乘0.5得0.4794\n余弦组：−0.001389+z×0.000025 → −0.0013\n0.041667+z×(−0.0013) → 0.0413\n−0.5+z×0.0413 → −0.4896\n1+z×(−0.4896) → 0.8776'],
      ['分别得到尚未截成三位的工作值','相除前不能用页面已经显示的三位近似，否则会多丢一次精度。程序传给除法的是两个多项式的工作结果。',hyper?'sinhSeries 0.5 → 0.52105\ncoshSeries 0.5 → 1.1276':'sinAngle 0.5 → 0.4794\ncosAngle 0.5 → 0.8776'],
      ['求商并检查分母','ddiv 4 使用四位小数商；圆正切还先检查 cut 4 后的余弦是否为零，避免在竖直渐近线处除零。双曲余弦在适用范围内非零。',hyper?'0.52105÷1.1276 → 0.4620（四位截断）':'0.4794÷0.8776 → 0.5462（四位截断）']
    );
    else steps.push(
      ['为什么 Horner 法能避免重复算高次幂','先算 z=x²，之后反复做“当前系数+z×内层值”。c₀、c₁等按上文系数表从左到右对应，不是新的函数。奇函数最后再乘一次 x。work 每完成一层就截到四位；这种逐层截断也是误差来源。',odd?'x×(c₀+z×(c₁+z×(c₂+z×c₃)))':'c₀+z×(c₁+z×(c₂+z×(c₃+z×c₄)))'],
      ['逐层算出本例的工作值','箭头处使用截断，负数也是向零丢弃多余位。下面列出真实系数与每层使用的值，不用理想的无穷级数结果代替程序过程。',trace]
    );
    steps.push(['形成带近似标记的记录','estimate 最后只保留三位小数，并把记录的近似位设为真。≈同时提醒有限项、多项式系数和中间截断带来的误差；三位显示不等于保证三位都准确。',hyper?(operation==='SINH'?'−0.52105 → ≈−0.521':operation==='COSH'?'1.1276 → ≈1.127':'0.4620 → ≈0.462'):(operation==='SIN'?'0.4794 → ≈0.479':operation==='COS'?'0.8776 → ≈0.877':'0.5462 → ≈0.546')]);
    return steps;
  }
  function decimal(example,precision){
    const op=example.decimalOperation;if(!op)return null;
    const inputs=example.operands.map((value,index)=>{
      const encoding=example.operandEncodings?.[index]??'decimal';
      return input(index===0?'a':op==='POW'?'n':'b',`${value}_${encoding}`,encoding==='church'?'丘奇自然数':'列表小数',decimalInputRoles[op][index]);
    });
    return {inputs,
      encodingText:'先按下表区分列表小数与丘奇次数。小数记录的“符号、数位、小数位数、近似位”共同决定数值，数位表与后面的丘奇列表使用不同的读取方式。',
      featured:{ADD:['dadd','align','sumAligned','plus','make'],SUB:['dsub','negate','sumAligned','minus','cmp'],MUL:['dmul','times','timesdigit','split'],DIV:['ddiv','longdiv','divstep','align'],NEG:['negate','sign','not','make'],ABS:['dabs','digits','make'],POW:['dpow','powerBy','force'],SHL:['dshl','plus'],SHR:['dshr','timesdigit','succ'],SQRT:['dsqrt','nonnegativeLess','work','estimate'],SIN:['dsin','sinAngle','smallSin','sinSeries','work'],COS:['dcos','cosAngle','smallSin','cosSeries','work'],TAN:['dtan','sinAngle','cosAngle','ddiv'],SINH:['dsinh','sinhSeries','withinRange','work'],COSH:['dcosh','coshSeries','withinRange','work'],TANH:['dtanh','sinhSeries','coshSeries','ddiv']}[op],
      ...(op==='DIV'?{steps:division(example,precision)}:decimalSteps[op]?{steps:decimalSteps[op]}:['SIN','COS','TAN','SINH','COSH','TANH'].includes(op)?{steps:seriesSteps(op)}:{}),
      ...(op==='POW'?{parameterNote:'末尾第一个参数用 _decimal，第二个参数必须用 _church。两种编码不能互换。'}:{}),
      ...(['SIN','COS','TAN'].includes(op)?{boundaries:['输入按弧度解释，绝对值不得超过1000。本实现先缩减周期再算有限多项式。','π 取有限小数3.14159265，系数为有限小数；中间四位截断，输出三位截断。页面设置的除法位数不会覆盖这些算法内部的固定工作精度。','接近余弦为零的位置时，正切的误差会被分母放大；截断余弦为零则返回除零错误。']}:
        ['SINH','COSH','TANH'].includes(op)?{boundaries:['当前有限多项式仅接受 −1 到1。超出范围返回错误，不代表数学上的双曲函数没有定义。','中间四位、输出三位都是截断，不是四舍五入；有限多项式没有对所有输入提供“三位正确”的误差保证。']}:
        op==='SQRT'?{boundaries:['负数返回实数平方根定义域错误；零直接返回零。','除法和中间估计采用四位工作精度，结束条件是估计不再严格下降。最终截成三位近似，不是任意精度平方根算法。']}:{}),
      ...(['SIN','COS','TAN','SINH','COSH','TANH'].includes(op)?{exercise:'先把输入改为零，用定义预测结果；再比较正负0.5，说明奇偶对称性。接着沿本篇的 Horner 层次手算一轮，标出在哪一步丢弃了小数位。'}:{})
    };
  }
  function listLesson(example){
    const name=example.name;
    const steps=[
      ['先写出列表怎样保存元素','丘奇列表不是数组地址，而是等待 c、n 两个参数的函数。c 决定每项怎么组合，n 决定空表返回什么。','[1,2,3] = λc n.c 1 (c 2 (c 3 n))\n[] = λc n.n'],
      ['区分这个列表与小数数位表','这里 c 接收当前元素与“尾部折叠后的结果”。小数记录中的 Scott 数位表则直接把当前元素和尾表交给选择器；两者同叫列表，但参数协议不同。','丘奇列表：λc n.c head (tail c n)\nScott列表：λc n.c head tail']
    ];
    let keys=['NIL','CONS'];
    if(name.includes('空表'))steps.push(
      ['把两个参数交给空表','空表忽略 c，因此根本不访问元素，直接返回初值 n。','(λc n.n) ADD 0 → 0\n(λc n.n) MUL 1 → 1'],
      ['说明为什么与零和假同形','λc n.n、λf x.x、λa b.b 只改变绑定变量名，结构相同；必须结合上下文的读取方式来解释。','[] ≡ 0 ≡ FALSE（仅在 λ 结构上同形）'],
      ['检查没有隐藏的列表元素','若传入一个会报错或不终止的组合函数，正规序下它仍被直接丢弃，因为 c 没有出现在函数体。','NIL c n → n']
    );
    else if(name.includes('头部插入'))steps.push(
      ['拆开 CONS 的四个参数','h 是新元素，t 是旧列表，c 与 n 是将来读取结果时提供的组合函数与初值。','CONS = λh t c n.c h (t c n)'],
      ['把新头与旧表代入','h=1，t=[2,3]；原列表在相同 c、n 下折叠，因此保持旧有次序。','CONS 1 [2,3]\n→ λc n.c 1 ([2,3] c n)'],
      ['展开尾表并得到新列表','尾表产生 c 2 (c 3 n)，放回上一步就形成三元素表，不会把整个旧列表当作一个元素。','→ λc n.c 1 (c 2 (c 3 n)) → [1,2,3]']
    );
    else if(name.includes('首项')){keys.push('HEAD');steps.push(
      ['把组合函数设为只选当前项','HEAD 的 d 是空表默认值；λh r.h 接收当前元素与尾部结果，只返回当前元素。','HEAD = λl d.l (λh r.h) d'],
      ['展开本例并选择最外层','最外层的 h 接收一，r 接收剩余表的计算；正规序直接丢掉 r，不必先算完它。','[1,2,3] (λh r.h) 0\n→ (λh r.h) 1 ((λh r.h) 2 ((λh r.h) 3 0))\n→ 1'],
      ['核对空表默认值','空表不调用组合函数，直接留下 d。默认值零是显式传入的第三段内容，不是 HEAD 内置的唯一选择。','HEAD [] 0 → 0\nHEAD [] 9 → 9']
    );}
    else if(name.includes('尾部')){keys.push('TAIL','PAIR','TRUE','FALSE');steps.push(
      ['为什么不能像 Scott 列表一样直接选尾表','丘奇组合函数拿到的是折叠结果 r，不是原始尾表。TAIL 因此让 r 保存两个可重建的列表。','状态=(完整后缀, 去掉首项的后缀)\n初值=([],[])'],
      ['按右折叠顺序重建后缀','当前元素 h 到来时，把它头插到旧完整后缀；新第二项保留旧完整后缀。','step h p = PAIR (CONS h (p TRUE)) (p TRUE)'],
      ['从右边逐项代入','先处理3，再处理2，最后处理1，始终保证第二项比第一项少一个头。','读3：([3],[])\n读2：([2,3],[3])\n读1：([1,2,3],[2,3])'],
      ['选择第二项','TAIL 最后传入 FALSE，返回已经重建好的 [2,3]；空表的初始第二项仍为空。','PAIR [1,2,3] [2,3] FALSE → [2,3]']
    );}
    else if(name.includes('判空')){keys.push('EMPTY','TRUE','FALSE');steps.push(
      ['定义非空分支与初值','初值设为 TRUE，每遇到任何元素，组合函数就返回 FALSE，忽略元素和后缀。','EMPTY = λl.l (λh r.FALSE) TRUE'],
      ['分别代入空表和非空表','空表不调用组合函数；非空表最外层至少调用一次，并直接选择 FALSE。','EMPTY [] → TRUE\nEMPTY [1,2,3] → (λh r.FALSE) 1 (…) → FALSE'],
      ['元素零不等于列表为空','[0] 也调用了一次组合函数。判断的是有没有元素，而不是元素的数值是否为零。','EMPTY [0] → FALSE']
    );}
    else if(name.includes('长度')){keys.push('LENGTH','SUCC');steps.push(
      ['不读取元素数值','组合函数只对后缀长度做一次后继，当前 h 的内容完全忽略，空表长度取零。','LENGTH = λl.l (λh r.SUCC r) 0'],
      ['从末端向前数','展开后每个元素贡献一个 SUCC，因此三元素表留下三层后继。','LENGTH [1,2,3]\n→ SUCC (SUCC (SUCC 0)) → 3'],
      ['核对元素与长度不是同一件事','把元素改成任何丘奇值，长度仍取决于组合函数被调用的次数。','LENGTH [9,0,100] → 3\nLENGTH [] → 0']
    );}
    else if(name.includes('映射')){keys.push('MAP','SUCC');steps.push(
      ['把变换函数与列表分别传入','MAP 的 f 接收 SUCC；l 接收原列表。c、n 是新列表将来接收的读取参数。','MAP = λf l c n.l (λh r.c (f h) r) n'],
      ['把每一项变换后接回原位置','组合函数先构造 f h，再用调用者的 c 接到已变换的后缀前面。次序没有反转。','MAP SUCC [1,2,3]\n→ λc n.c (SUCC 1) (c (SUCC 2) (c (SUCC 3) n))'],
      ['归约元素并辨认新列表','每个 SUCC 独立增加一次函数作用，得到新元素二、三、四。','→ λc n.c 2 (c 3 (c 4 n)) → [2,3,4]']
    );}
    else if(name.includes('拼接')){keys.push('APPEND');steps.push(
      ['把第二张表作为第一张表的尾部结果','a、b 读入相同 c；先形成 b c n，再把这个结果作为 a 的折叠初值。','APPEND = λa b c n.a c (b c n)'],
      ['分别展开两张表','b=[3] 产生 c 3 n；a=[1,2] 把一和二包在这个结果外面。','APPEND [1,2] [3]\n→ λc n.[1,2] c (c 3 n)'],
      ['检查顺序','最终仍是一、二、三。若交换两个输入，结构会变成三、一、二。','→ λc n.c 1 (c 2 (c 3 n))\nAPPEND [3] [1,2] → [3,1,2]']
    );}
    else if(name.includes('反转')){keys.push('REVERSE','I');steps.push(
      ['先构造一串等待累积表的函数','丘奇列表右折叠先访问尾部。为了之后从左向右做头插，组合函数返回接收 accumulator 的新函数。','step = λh rest accumulator.rest (CONS h accumulator)\n终止函数 I=λa.a'],
      ['先展开函数链，不把它误读成已经反转的列表','用 R 表示折叠得到的函数，最后仍需传入空表作初值。','R = step 1 (step 2 (step 3 I))\nREVERSE [1,2,3] = R []'],
      ['执行链中的头插','第一次放入一，再放入二，最后放入三。每次都插在头部，所以旧元素向后移。','R []\n→ (step 2 (step 3 I)) [1]\n→ (step 3 I) [2,1]\n→ I [3,2,1] → [3,2,1]']
    );}
    else if(name.includes('过滤')){keys.push('FILTER','ISZERO','TRUE','FALSE');steps.push(
      ['解释谓词怎么把零排除','谓词是接收元素并返回布尔选择器的函数；这里 ISZERO 为真时选择 FALSE，为假时选择 TRUE。','predicate = λh.ISZERO h FALSE TRUE\npredicate 0→FALSE；predicate 2→TRUE'],
      ['把布尔值用作条件选择','如果谓词为真就调用 c 保留当前元素，否则直接用后缀结果 r。','FILTER = λp l c n.l (λh r.p h (c h r) r) n'],
      ['按右折叠顺序查看四个元素','先处理最后的三，再处理零、二、最前面的零；每个保留元素都接在已有后缀前。','读3：[3]\n读0：仍[3]\n读2：[2,3]\n读0：仍[2,3]'],
      ['检查谓词与元素各自的编码','谓词必须返回可选择两分支的丘奇布尔。数字0与FALSE虽同形，任意其他自然数都不能直接当作TRUE。','返回列表：λc n.c 2 (c 3 n)']
    );}
    else {const product=name.includes('乘积');keys.push(product?'MUL':'ADD');steps.push(
      ['选定组合函数与空表初值',product?'组合函数用乘法，初值用一，因为任何数乘一不变。':'组合函数用加法，初值用零，因为任何数加零不变。',product?'[1,2,3] MUL 1':'[1,2,3] ADD 0'],
      ['直接展开列表函数','这里列表本身就执行折叠，不需要在外面再写一个遍历器。',product?'MUL 1 (MUL 2 (MUL 3 1))':'ADD 1 (ADD 2 (ADD 3 0))'],
      ['逐层合并结果',product?'最内层三乘一得三，再乘二得六，最后乘一仍为六。':'最内层三加零得三，再加二得五，最后加一得六。',product?'1×(2×(3×1)) → 1×(2×3) → 1×6 → 6':'1+(2+(3+0)) → 1+(2+3) → 1+5 → 6'],
      ['用空表检查初值是否正确','空表直接返回 n，因此初值本身就是这项运算对空表的约定结果。',product?'[] MUL 1 → 1':'[] ADD 0 → 0']
    );}
    const sources={NIL:P.churchLists.nil,CONS:P.churchLists.cons,HEAD:P.churchLists.head,TAIL:P.churchLists.tail,EMPTY:P.churchLists.isEmpty,LENGTH:P.churchLists.length,MAP:P.churchLists.map,APPEND:P.churchLists.append,REVERSE:P.churchLists.reverse,FILTER:P.churchLists.filter};
    const meanings={NIL:'空表，返回调用者的初值。',CONS:'新元素头插到旧列表，保持旧表次序。',HEAD:'用忽略后缀的选择器取首项，空表返回显式默认值。',TAIL:'用两张相邻后缀表重建去掉首元素的列表。',EMPTY:'有元素则返回假，空表保留真。',LENGTH:'每个元素贡献一次后继，与元素值无关。',MAP:'逐项应用函数，结果保持原顺序。',APPEND:'把第二张表的折叠结果作为第一张表的初值。',REVERSE:'构造接受累积表的函数链，顺次头插完成反转。',FILTER:'谓词选择保留当前项或直接取后缀。'};
    let inputs=[input('list',name.includes('空表')||name.includes('判空 []')?'[]':'[1,2,3]','丘奇列表','要操作的原列表，元素按丘奇自然数表示')];
    if(name.includes('头部插入'))inputs=[natural('h',1,'新插入的首元素'),input('tail','[2,3]','丘奇列表','已有尾表，不作为单个元素插入')];
    else if(name.includes('首项'))inputs.push(natural('d',0,'空表时返回的默认值'));
    else if(name.includes('映射'))inputs=[input('f','λn f x.f (n f x)','丘奇数→丘奇数','SUCC：对每个元素加一'),...inputs];
    else if(name.includes('拼接'))inputs=[input('a','[1,2]','丘奇列表','排在前面的列表'),input('b','[3]','丘奇列表','接在后面的列表')];
    else if(name.includes('过滤'))inputs=[input('predicate','λh.ISZERO h FALSE TRUE','丘奇数→丘奇布尔','零返回假，非零返回真'),input('list','[0,2,0,3]','丘奇列表','等待过滤的元素')];
    else if(name.includes('折叠'))inputs.push(input('c',name.includes('乘积')?'MUL':'ADD','组合函数','组合当前元素和已折叠的后缀结果'),natural('n',name.includes('乘积')?1:0,'空表初值'));
    else if(name.includes('空表'))inputs=[input('c','任意二参数组合函数','λ函数','本例为空表，因此不会调用'),input('n','调用者指定','任意λ数据','空表直接返回的初值')];
    return {steps,symbols:keys.map(key=>({name:key,source:sources[key]??helpers[key][0],meaning:meanings[key]??helpers[key][1]})),inputs,
      encodingText:'本篇使用丘奇列表（右折叠编码）。它不同于列表小数内部的 Scott 数位表；两种 cons 定义不能互换。',
      boundaries:['空表与 FALSE、丘奇数零在 λ 结构上同形。仅看结构不能唯一决定含义，页面会结合编码与操作上下文解释。','丘奇列表接收组合函数和初值；不能把它直接交给只接受 Scott 列表尾指针的数位函数。'],exercise:'把本例输入依次换成空表、[0]、[2,0,3]，按本篇组合函数展开一层，再判断哪部分保留、哪部分被丢弃。'};
  }
  function describe(example,precision=6){
    if(example.decimalOperation)return decimal(example,precision);
    if(example.category==='丘奇列表')return listLesson(example);
    if(example.category!=='高等数学')return null;
    if(/^(多项式|符号求导|定积分|生成导函数|生成原函数)/.test(example.name))return polynomial(example);
    const prefix=example.name.split(' · ')[0];
    const doc=math[prefix]??(['自然数求和','平方和','立方和'].includes(prefix)?summation(example):prefix.startsWith('二项式')?binomial(example):inverse[prefix]?inverseLesson(prefix):null);
    if(!doc)throw new Error('缺少高等数学讲解：'+example.name);
    const symbols=symbolsFor(doc.key);
    return {...doc,core:doc.key+' = '+helpers[doc.key][0],symbols,compact:doc.key+' '+doc.args,
      walkthrough:inverse[prefix]?doc.steps[4][2]:doc.steps.at(-1)[2]??doc.key+' '+doc.args,
      basics:['本篇把丘奇数当作“重复执行某个更新函数的次数”。数学中的循环并不是额外指令，而是 n step initial 这样的函数应用。',stateIntro,'关键表达式中的英文名都是下方有 λ 定义的辅助函数。完整表达式用 (λ名称.后续程序) (定义) 把它们逐个绑定，不需要预先保存同名函数。'],
      foundation:doc.key+' '+doc.args+'\nPAIR = λa b selector.selector a b\nTRUE = λa b.a\nFALSE = λa b.b\nn step initial：执行 n 次 step，初值为 initial',
      encodingText:'本篇数字使用丘奇自然数。表达式末尾按下表顺序传入参数；正文中的 (a,b) 是有序对简写，实际由 λ 选择器保存。'};
  }
  const API={describe,unpack};root.LambdaGuideAdvanced=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
