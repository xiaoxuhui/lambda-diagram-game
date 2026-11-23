(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  // These are ordinary lambda definitions. JavaScript only assembles their
  // private bindings and sample arguments; all list/bit arithmetic is reduced.
  const definitions=[
    ['TRUE','λa.λb.a','真选择第一项。'],['FALSE','λa.λb.b','假选择第二项。'],['I','λx.x','恒等函数。'],
    ['NIL','λc.λn.n','丘奇空表。'],['CONS','λh.λt.λc.λn.c h (t c n)','丘奇列表头插。'],['PAIR','λa.λb.λk.k a b','用序对保存两个状态字段。'],
    ['SUCC','λn.λf.λx.f (n f x)','丘奇后继。'],['PRED','λn.λf.λx.n (λg.λh.h (g f)) (λu.x) (λu.u)','丘奇前驱，零保持零。'],
    ['ISZERO','λn.n (λx.FALSE) TRUE','判断丘奇自然数是否为零。'],['SUB','λa.λb.b PRED a','截断在零的自然数减法。'],
    ['same','λa.λb.ISZERO (SUB a b) (ISZERO (SUB b a)) FALSE','双向减法都为零才相等；比较丘奇自然数，不比较任意函数。'],
    ['REVERSE','λl.l (λh.λr.λa.r (CONS h a)) I NIL','以头插构造反向丘奇列表。'],
    ['nth','λl.λn.ISZERO n 0 (l (λh.λr.λk.ISZERO k h (r (PRED k))) (λk.0) (PRED n))','序号从1开始，计数减到零时返回当前元素；第0项、空表和越界返回0。'],
    ['indexof','λl.λv.l (λh.λr.same h v 1 (ISZERO r 0 (SUCC r))) 0','当前元素命中返回1；否则将后缀命中位置加一，后缀未命中仍返回0。'],
    ['last','λl.l (λh.λr.λd.r h) I 0','把当前元素作为后缀的默认值传递，最后保留最右元素；空表返回0。'],
    ['init','λl.l (λh.λp.p (λseen.λrest.PAIR TRUE (seen (CONS h rest) rest))) (PAIR FALSE NIL) FALSE','从右折叠（是否见过元素，输出表）；只丢弃第一次遇到的元素，也就是末项。'],
    ['take','λl.λn.l (λh.λr.λk.ISZERO k NIL (CONS h (r (PRED k)))) (λk.NIL) n','剩余数量为零就停止，否则保留首项并递减数量。'],
    ['drop','λl.λn.λc.λz.l (λh.λr.λk.ISZERO k (c h (r 0)) (r (PRED k))) (λk.z) n','前n项仅递减计数；降到零后重建剩余列表，一次遍历而非反复取尾。'],
    ['contains','λl.λv.l (λh.λr.same h v TRUE r) FALSE','任何一项命中就返回真，没有命中返回假。'],
    ['positions','λl.λv.l (λh.λr.λi.same h v (CONS i (r (SUCC i))) (r (SUCC i))) (λi.NIL) 1','从1传递当前序号，命中时把序号加入结果，保留所有重复位置。'],
    ['count','λl.λv.l (λh.λr.same h v (SUCC r) r) 0','每次命中使次数加一，否则保留后缀次数。'],
    ['snil','λc.λn.n','内部Scott空表；等待空表分支。'],['scons','λh.λt.λc.λn.c h t','Scott头插，尾部直接交给读取函数。'],
    ['toscott','λl.l scons snil','把丘奇折叠列表转成可逐项拆解的Scott列表。'],['Y','λf.(λx.f (x x)) (λx.f (x x))','不动点组合子，供逐项读取有限Scott列表。'],
    ['fromscott','Y (λr.λl.l (λh.λt.CONS h (r t)) NIL)','把内部Scott列表还原成丘奇列表。'],
    ['bitnot','λa.ISZERO a 1 0','数位0变1，数位1变0。'],['bitand','λa.λb.ISZERO a 0 (ISZERO b 0 1)','两个数位都为1才输出1。'],
    ['bitor','λa.λb.ISZERO a (ISZERO b 0 1) 1','至少一位为1时输出1。'],['bitxor','λa.λb.ISZERO a (ISZERO b 0 1) (ISZERO b 1 0)','两位不同输出1。'],
    ['bitnand','λa.λb.bitnot (bitand a b)','先与后非。'],['bitnor','λa.λb.bitnot (bitor a b)','先或后非。'],['bitxnor','λa.λb.bitnot (bitxor a b)','先异或后非。'],
    ['zipbits','Y (λr.λop.λa.λb.a (λh.λt.b (λj.λu.CONS (op h j) (r op t u)) (CONS (op h 0) (r op t snil))) (b (λj.λu.CONS (op 0 j) (r op snil u)) NIL))','从低位逐位配对，短列表缺失位按0处理，结果宽度为两表较长者。'],
    ['notbits','λa.λc.λn.a (λh.λr.c (bitnot h) r) n','逐位取非，保留位宽。'],
    ...[['andbits','bitand'],['orbits','bitor'],['xorbits','bitxor'],['nandbits','bitnand'],['norbits','bitnor'],['xnorbits','bitxnor']].map(([name,op])=>[name,`λa.λb.REVERSE (zipbits ${op} (toscott (REVERSE a)) (toscott (REVERSE b)))`,'输入先反转以对齐最低位，逐位运算后反转回高位在前。']),
    ['addbit','λr.λh.λj.λt.λu.λcarry.(λv.CONS (bitxor v carry) (r t u (bitor (bitand h j) (bitand carry v)))) (bitxor h j)','全加器：和位为h异或j异或进位；新进位为(h与j)或(旧进位与(h异或j))。'],
    ['addbitsstep','Y (λr.λa.λb.λcarry.a (λh.λt.b (λj.λu.addbit r h j t u carry) (addbit r h 0 t snil carry)) (b (λj.λu.addbit r 0 j snil u carry) (ISZERO carry NIL (CONS 1 NIL))))','逐个低位运行全加器；两表都读完后，若还有进位便额外输出1。'],
    ['addbits','λa.λb.REVERSE (addbitsstep (toscott (REVERSE a)) (toscott (REVERSE b)) 0)','任意有限位宽的无符号二进制加法，初始进位0已封装，最高位溢出保留。'],
    ['frombits','λl.l (λh.λr.λa.r (a SUCC (a SUCC h))) I 0','从左向右累计：新值=旧值×2+当前位，最后返回丘奇自然数。'],
    ['incbits','Y (λr.λa.a (λh.λt.ISZERO h (scons 1 t) (scons 0 (r t))) (scons 1 snil))','内部低位在前：0改1即停止，1改0继续进位；空表接收进位生成1。'],
    ['tobits','λn.ISZERO n (CONS 0 NIL) (REVERSE (fromscott (n incbits snil)))','用丘奇数迭代二进制加一，再反转为高位在前；零单独表示为[0]。']
  ].map(([name,source,meaning])=>({name,source,meaning}));
  const registry=new Map(definitions.map(entry=>[entry.name,{...entry,term:C.parse(entry.source)}]));
  function reachable(name){const seen=new Set(),out=[];function visit(key){if(seen.has(key)||!registry.has(key))return;seen.add(key);const entry=registry.get(key);for(const dep of C.freeVars(entry.term))visit(dep);out.push(entry);}visit(name);return out;}
  function program(name,args=[]){return '('+reachable(name).reduceRight((body,entry)=>`(λ${entry.name}.${body}) (${C.format(entry.term)})`,name)+')'+(args.length?' '+args.join(' '):'');}
  const specs=[
    ['第n项','nth',['[4,7,2]','2'],['原列表','从1开始的序号'],'7','计数依次为1、0，读到第二项7。','nth [4,7,2] 2 → 7\nnth [4,7,2] 0 → 0\nnth [4,7,2] 4 → 0'],
    ['查找位置','indexof',['[4,7,2,7]','7'],['丘奇自然数列表','待查找的丘奇自然数'],'2','从左到右第一次命中的位置是2。','indexof [4,7,2,7] 7 → 2\nindexof [4,7,2,7] 9 → 0'],
    ['末项','last',['[4,7,2]'],['原列表'],'2','当前元素依次作为后缀的默认值传递，最右边的2成为最终结果。','last [4,7,2] → 2\nlast [] → 0'],
    ['去掉末项','init',['[4,7,2]'],['原列表'],'[4,7]','从右边遇到的第一项2被丢弃，之后依次保留7、4。','(假,[]) → (真,[]) → (真,[7]) → (真,[4,7])\ninit [4,7,2] → [4,7]'],
    ['取前n项','take',['[4,7,2]','2'],['原列表','要保留的项数'],'[4,7]','每保留一项数量减一，数量到零后停止。','take [4,7,2] 2 → [4,7]\ntake [4,7,2] 0 → []'],
    ['跳过前n项','drop',['[4,7,2]','2'],['原列表','要跳过的项数'],'[2]','前两项只消耗计数，之后按原顺序构造结果。','drop [4,7,2] 2 → [2]\ndrop [4,7,2] 9 → []'],
    ['是否包含','contains',['[4,7,2]','7'],['丘奇自然数列表','待查找的丘奇自然数'],'λa.λb.a','遇到7时直接选择真，不要求继续判断后缀。','contains [4,7,2] 7 → TRUE\ncontains [] 7 → FALSE'],
    ['全部位置','positions',['[4,7,2,7]','7'],['丘奇自然数列表','待查找的丘奇自然数'],'[2,4]','下标从1开始递增，两次命中对应位置2、4。','positions [4,7,2,7] 7 → [2,4]\npositions [4,7,2] 9 → []'],
    ['出现次数','count',['[4,7,2,7]','7'],['丘奇自然数列表','待统计的丘奇自然数'],'2','每次命中累计次数加一；不是把元素值相加。','count [4,7,2,7] 7 → 2\ncount [] 7 → 0'],
    ['多位非门','notbits',['[1,0,1]'],['二进制数位列表'],'[0,1,0]','每一位取反，三位输入仍然输出三位。','notbits [1,0,1] → [0,1,0]'],
    ['多位与门','andbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[0,0,1]','低位对齐，101与011逐位与，得到001。','andbits [1,0,1] [1,1] → [0,0,1]'],
    ['多位或门','orbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[1,1,1]','低位对齐后，101或011得到111。','orbits [1,0,1] [1,1] → [1,1,1]'],
    ['多位异或门','xorbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[1,1,0]','相同位输出0，不同位输出1；101异或011得到110。','xorbits [1,0,1] [1,1] → [1,1,0]'],
    ['多位与非门','nandbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[1,1,0]','先补零对齐再逐位与非，宽度取较长输入的三位。','nandbits [1,0,1] [1,1] → [1,1,0]'],
    ['多位或非门','norbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[0,0,0]','101或011为111，逐位取非得到000。','norbits [1,0,1] [1,1] → [0,0,0]'],
    ['多位同或门','xnorbits',['[1,0,1]','[1,1]'],['第一个二进制列表','第二个二进制列表'],'[0,0,1]','相同位输出1，不同位输出0。','xnorbits [1,0,1] [1,1] → [0,0,1]'],
    ['多位加法器','addbits',['[1,1,1]','[1]'],['第一个无符号二进制列表','第二个无符号二进制列表'],'[1,0,0,0]','从最低位开始串联全加器：每一位把进位送到下一位，7+1保留最高进位得到8。','低位到高位：(1,1,0) → (和0,进位1)\n(1,0,1) → (和0,进位1)\n(1,0,1) → (和0,进位1)\n余下进位1 → [1,0,0,0]'],
    ['丘奇数转二进制','tobits',['13'],['丘奇自然数'],'[1,1,0,1]','丘奇数13迭代二进制加一13次，内部使用低位在前的Scott列表，最后反转输出。','0 → [0]\n1 → [1]\n2 → [1,0]\n13 → [1,1,0,1]'],
    ['二进制转丘奇数','frombits',['[1,1,0,1]'],['二进制数位列表'],'13','按高位到低位累计，旧值乘2再加当前位。','0 → 0×2+1=1 → 1×2+1=3\n→ 3×2+0=6 → 6×2+1=13']
  ];
  const listNames=new Set(['nth','indexof','last','init','take','drop','contains','positions','count']);
  const examples=specs.map(([title,name,args,roles,expected,description,walkthrough])=>({name:(listNames.has(name)?'丘奇列表 · ':'二进制列表 · ')+title+' · '+name,category:listNames.has(name)?'丘奇列表':'二进制列表',encoding:'church',listOperation:{name,args,roles,title,walkthrough},term:program(name,args),expected:C.format(C.parse(expected)),expectedLabel:expected.startsWith('[')?'丘奇列表 '+expected.replaceAll(',',', '):undefined,description,parameters:roles.map((role,index)=>role+' '+args[index])}));
  function lesson(example){
    const {name,args,roles,title,walkthrough}=example.listOperation,entries=reachable(name),entry=registry.get(name),isBinary=!listNames.has(name),search=['indexof','contains','positions','count'].includes(name),compact=name+' '+args.join(' ');
    return {core:name+' = '+entry.source,symbols:entries.map(({name,source,meaning})=>({name,source,meaning})),libraryEntries:[name],compact,
      inputs:args.map((value,index)=>({name:isBinary?(name==='tobits'?'n':index?'b':'a'):index?(search?'v':'n'):'l',value,encoding:value.startsWith('[')?'丘奇列表':'丘奇自然数',role:roles[index]})),
      basics:['丘奇列表以 λc.λn.c 第一项 (c 第二项 (... n)) 保存元素，传入组合函数和空表结果后执行右折叠。','丘奇自然数决定重复次数；序对和布尔选择器在普通λ表达式内保存状态与选择分支。'],
      foundation:isBinary?'二进制数位使用丘奇数字0、1，不是丘奇布尔真假。\n[1,0,1] = λc.λn.c 1 (c 0 (c 1 n))\n高位在前：101₂ = 1×4+0×2+1 = 5':'[4,7,2] = λc.λn.c 4 (c 7 (c 2 n))\n序号从1开始：第一项4，第二项7，第三项2',
      principle:[entry.meaning,example.description],overview:title+'：'+example.description,
      steps:[['先看调用与结果',example.description,compact+'\n→ '+C.format(C.parse(example.expected))],['入口的完整定义','只传上表列出的实际数据，固定初值和辅助操作在内部。',name+' = '+entry.source],['辅助函数如何配合','下列每个名称都有完整定义，加入入口时会按依赖封装。',entries.filter(item=>item.name!==name).map(item=>item.name+' = '+item.source).join('\n')],['追踪实际数据',entry.meaning,walkthrough],['检查边界','把输入改为空表、零或更长的列表，仍使用相同的函数定义。',isBinary?'frombits [] → 0\ntobits 0 → [0]\naddbits [1,1,1] [1] → [1,0,0,0]':search?'indexof [] 7 → 0\npositions [] 7 → []\ncount [] 7 → 0':'nth [] 1 → 0\nlast [] → 0\ninit [] → []\ntake [] 2 → []\ndrop [] 2 → []']],
      walkthrough,encodingText:isBinary?'高位在前的丘奇列表，每个元素是丘奇自然数0或1；选择丘奇自然数编码后可直接输入[1,0,1]。其他编码下请写[1_church,0_church,1_church]，单独的数值也可加_church后缀。':'列表中的数字使用丘奇自然数；取项、截取与去末项也可保留函数或嵌套列表等λ元素。',
      parameterNote:'只传实际列表、序号或查找值；所有辅助函数与固定初值一起封装进主入口。',
      boundaries:isBinary?['只接受由丘奇自然数0和1组成的有限列表；布尔真和数字1不是同一个编码。','双输入逻辑门和加法从最低位对齐，较短输入左侧补0；逻辑门保留较长输入的位宽，非门保留原位宽。','加法保留最终进位；两个空表相加返回空表，作为数值等于零。tobits 0统一返回[0]，frombits []返回0。','tobits通过丘奇迭代加一计算，迭代次数等于输入自然数；大数需要更多归约时间。没有固定机器整数位宽或自动截断。','含递归的位运算建议使用从左到右正规序；应用序展开不动点组合子可能无法终止。']:[
        '第n项和查找位置均从1开始；第0项没有对应元素。nth、last在空表或越界时返回固定默认值0，所以不能仅凭结果0区分缺项与实际元素0。',
        'indexof返回第一次出现的位置，找不到返回0；positions返回全部位置，找不到返回空表。contains和count分别返回布尔值与出现次数。',
        '按值查找和计数比较的是丘奇自然数，不声称能判断任意两个λ函数是否等价。',
        'init空表或单元素表返回空表；take数量超过长度返回原表，drop数量超过长度返回空表，数量0分别返回空表、原表。'],
      exercise:isBinary?'修改两张表的位宽并测试进位；对n先执行tobits，再把结果传给frombits，应还原同一个丘奇数。':'修改列表，加入重复值0；分别核对首项、末项、所有命中位置以及空表行为。'};
  }
  const API={definitions,examples,program,lesson,reachable};root.LambdaListOperations=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
