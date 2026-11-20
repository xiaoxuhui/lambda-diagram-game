const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),P=require('../src/presets.js');
const G=require('../src/guide.js');
const catalog=G.catalog();

test('generated naming data matches every raw tutorial',()=>{
  const data=require('../src/guide-name-data.js');
  assert.equal(data.lessons.length,P.examples.length);
  for(const example of P.examples){
    const doc=G.rawLesson(example),stored=data.lessons.find(lesson=>lesson.key===example.name);
    assert.deepEqual(stored.symbols.map(index=>data.symbols[index]),doc.symbols.map(({name,source})=>({name,source})));
    assert.deepEqual(stored.snippets,[doc.core,doc.foundation,doc.walkthrough,...doc.steps.map(step=>step[2]??'')]);
  }
});

test('all tutorials use one name per expression and one definition per name',()=>{
  const byName=new Map(),byExpression=[];
  assert.equal(P.examples.length,76);
  for(const example of P.examples){
    const doc=G.lesson(example);
    for(const symbol of doc.symbols){
      if(byName.has(symbol.name))assert.equal(symbol.source,byName.get(symbol.name),example.name+': '+symbol.name);
      else{
        const term=C.parse(symbol.source);
        const same=byExpression.find(item=>C.equal(item.term,term));
        assert.equal(same,undefined,symbol.name+' also named '+same?.name);
        byExpression.push({term,name:symbol.name});byName.set(symbol.name,symbol.source);
      }
    }
    for(const section of [doc.core,doc.foundation,...doc.steps.map(step=>step[2]??'')]){
      for(const line of section.split(/\n|；/)){
        const match=/^([^\s=]+) = (λ.+)$/.exec(line);
        if(match&&byName.has(match[1]))assert.equal(match[2],byName.get(match[1]),example.name+': '+match[1]);
      }
    }
  }
  for(const entry of catalog.entries()){
    assert.match(entry.name,/^(?:[a-z][a-z0-9]*|S)$/,entry.name);
    assert.ok(!/[A-Z]/.test(entry.source.replace(/\bS\b/g,'')),entry.name);
    assert.equal(entry.source,byName.get(entry.name),entry.name);
    const pending=[C.parse(entry.source)];while(pending.length){const term=pending.pop();if(term.type==='abs'){assert.equal(term.param.length,1,entry.name+': '+term.param);pending.push(term.body);}else if(term.type==='app')pending.push(term.fn,term.arg);}
  }
});

test('common names stay short and the pair selector is f',()=>{
  const entries=catalog.entries(),alias=name=>entries.find(entry=>entry.aliases.includes(name));
  assert.equal(alias('PAIR').name,'pair');assert.equal(alias('PAIR').source,'λa.λb.λf.f a b');
  assert.equal(alias('TRUE').name,'true');assert.equal(alias('FALSE').name,'false');
  assert.equal(alias('SUCC').name,'succ');assert.equal(alias('PRED').name,'pred');
  assert.equal(alias('factorialiter').name,'fac');assert.equal(alias('FAC').name,'recfac');
  assert.equal(alias('S').name,'S');assert.equal(alias('S').source,'λf.λg.λx.f x (g x)');
  for(const name of ['timesdigit','sinseries','fromexternal','toexternal'])assert.ok(entries.some(entry=>entry.name===name),name+' retains its meaning');
});

test('equivalent selectors and cross-domain helpers merge while distinct list constructors stay distinct',()=>{
  const entries=catalog.entries(),group=alias=>entries.filter(entry=>entry.aliases.includes(alias));
  assert.equal(group('TRUE')[0],group('t')[0]);assert.equal(group('TRUE')[0].name,'true');
  assert.equal(group('FALSE')[0],group('NIL')[0]);assert.equal(group('FALSE')[0],group('f')[0]);
  assert.equal(group('ADD')[0],group('APPEND')[0]);assert.equal(group('MUL')[0],group('compose')[0]);
  assert.equal(group('cons').length,2);
  assert.notEqual(group('cons')[0].name,group('cons')[1].name);
  assert.ok(!C.equal(C.parse(group('cons')[0].source),C.parse(group('cons')[1].source)));
});

test('all example and challenge programs preserve Lambda binding structure and numeric suffixes',()=>{
  for(const item of [...P.examples,...P.levels]){
    const raw=P.rawInputSourceFor(item),renamed=P.inputSourceFor(item);
    assert.ok(C.equal(E.parse(raw).term,E.parse(renamed).term),item.name);
    assert.deepEqual(renamed.match(/-?\d+(?:\.\d+)?_(?:church|decimal)/g),raw.match(/-?\d+(?:\.\d+)?_(?:church|decimal)/g),item.name);
    // Renaming must preserve explicit parentheses for composition by prefix.
    if(item.decimalOperation)assert.ok(C.equal(E.parse('3_church '+raw).term,E.parse('3_church '+renamed).term),item.name);
    assert.equal(renamed.replace(/`[^`]+`|[^\sλ\\().\[\],`]+/g,'#'),raw.replace(/`[^`]+`|[^\sλ\\().\[\],`]+/g,'#'),item.name);
  }
  for(const precision of [0,2,8]){
    const item=P.examples.find(example=>example.decimalOperation==='DIV');
    assert.ok(C.equal(E.parse(P.rawInputSourceFor(item,precision)).term,E.parse(P.inputSourceFor(item,precision)).term));
  }
});

test('renaming respects shadowing and nested helpers without capturing variables',()=>{
  const cases=[
    '(λI.(λI.I) I) (λx.x)',
    '(λADD.(λadd.add ADD) (λm n f x.m f (n f x))) (λm n f x.m f (n f x))',
    '(λI.λid.I id) (λx.x)',
    'λt.λf.t f',
    'λf.λselector.selector f',
    'λselector.λf.selector f',
    'λfunction.λf.function f',
    '(λTRUE.λtrue.TRUE true) (λa b.a)'
  ];
  for(const raw of cases)assert.ok(C.equal(C.parse(raw),C.parse(catalog.source(raw))),raw);
});

test('mathematical functions, syntax variables and local continuation functions keep their meanings',()=>{
  for(const prefix of ['多项式','符号求导','定积分','生成导函数','生成原函数']){
    const doc=G.lesson(P.examples.find(example=>example.name.startsWith(prefix)));
    const text=JSON.stringify(doc.steps);
    assert.ok(!text.includes('false′('));
    assert.ok(!text.includes('λADD'));
    assert.ok(doc.basics.some(text=>text.includes('f(x) 表示输入函数')));
    assert.ok(doc.steps.some(step=>step[2]?.includes('true = λa.λb.a')));
  }
  const poly=G.lesson(P.examples.find(example=>example.name.startsWith('多项式')));
  assert.match(poly.steps[3][2],/B=6\+1=7/);
  for(const [prefix,notation] of [['组合数','C(4, 2)'],['排列数','A(4, 2)']])assert.ok(G.titleFor(P.examples.find(example=>example.name.startsWith(prefix))).includes(notation));
  assert.match(poly.steps.map(step=>step[2]).join('\n'),/chain = λg\.λa\.λh\.λs\.h \(g s a\)/);
  const decimal=G.lesson(P.examples.find(example=>example.decimalOperation==='POW'));
  assert.ok(!JSON.stringify(decimal.steps).includes('ISZERO'));
  assert.ok(!decimal.foundation.includes('id f '));
  const syntax=G.rawLesson(P.examples[0]).basics[1];
  assert.ok(decimal.basics.includes(syntax));
  const sine=G.lesson(P.examples.find(example=>example.decimalOperation==='SIN'));
  assert.ok(sine.steps.some(step=>step[2]?.includes('tₖ₊₁')));
  const displayed=JSON.stringify(P.examples.map(example=>{const {symbols,...doc}=G.lesson(example);return {...doc,symbols:symbols.map(({uses,...symbol})=>symbol)};}));
  assert.ok(!/\b(?:TRUE|FALSE|ISZERO|NOT|NEG|ABS|SHIFT_LEFT)\b/.test(displayed));
});
