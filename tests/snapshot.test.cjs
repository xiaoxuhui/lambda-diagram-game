const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),S=require('../src/snapshot.js');
function sample(){return {version:2,savedAt:'2026-10-09T00:00:00.000Z',draft:'(λx.x)(λy.y)',functions:L.add([],'ID','λx.x'),completed:[1,3],mode:'challenge',level:2,
  session:{original:C.parse('(λx.x)(λy.y)'),steps:1,dirty:false,halt:''},view:{speed:180,scale:1.5,autoFit:false,historyOpen:true,helpOpen:false,hintOpen:true},selection:{start:2,end:3},error:''};}
test('complete snapshot restores current term and full history',()=>{const s=S.decode(S.encode(sample()));assert.equal(C.format(s.term),'λy.y');assert.equal(s.history.length,2);assert.equal(s.history[1].change.param,'x');assert.deepEqual(s.completed,[1,3]);assert.equal(s.functions[0].name,'ID');assert.equal(s.view.scale,1.5);assert.equal(s.hasSession,true);});
test('restoration supports expanded AST longer than input budget',()=>{
  const s=sample();let t=C.V('variable'.repeat(50));for(let i=0;i<3;i++)t=C.A(t,t);s.session={original:t,steps:0,dirty:false,halt:''};
  assert.ok(C.format(t).length>1500);assert.deepEqual(S.decode(S.encode(s)).term,t);
});
test('edited draft preserves old run frame and dirty flag',()=>{const s=sample();s.draft='λz.';s.session.dirty=true;const r=S.decode(S.encode(s));assert.equal(r.draft,'λz.');assert.equal(r.session.dirty,true);assert.equal(C.format(r.term),'λy.y');});
test('empty error state roundtrips',()=>{const s=sample();s.session={original:null,steps:0,dirty:true,halt:''};s.error='第 4 个字符：这里需要表达式。';const r=S.decode(S.encode(s));assert.equal(r.term,null);assert.equal(r.history.length,0);assert.equal(r.error,s.error);});
test('repeated-state snapshots can restore manual subsequent steps',()=>{const s=sample();s.session={original:C.parse('(λx.x x)(λx.x x)'),steps:3,dirty:false,halt:'重复'};const r=S.decode(S.encode(s));assert.equal(r.history.length,4);assert.equal(r.session.halt,'重复');});
test('legacy v1 migrates progress and draft without pretending to have history',()=>{
  const r=S.decode(JSON.stringify({version:1,draft:'λq.q',mode:'challenge',level:3,completed:[1,2,2,9,'x']}));
  assert.equal(r.hasSession,false);assert.equal(r.draft,'λq.q');assert.deepEqual(r.completed,[1,2]);assert.equal(r.level,3);
});
test('bad JSON and unknown version are rejected',()=>{assert.throws(()=>S.decode('{'),/JSON/);assert.throws(()=>S.decode('{"version":99}'),/版本/);});
test('oversized file is rejected before parsing',()=>assert.throws(()=>S.decode(' '.repeat(S.MAX_BYTES+1)),/2 MiB/));
test('multibyte text obeys byte budget, not just character count',()=>assert.throws(()=>S.decode('汉'.repeat(800000)),/2 MiB/));
test('malformed AST and executable-looking nodes are rejected',()=>{for(const term of [{type:'eval',code:'alert(1)'},{type:'abs',param:'x'},{type:'var',name:'<script>'}]){const s=sample();s.session.original=term;assert.throws(()=>S.decode(JSON.stringify(s)),/存档无效/);}});
test('overdeep AST is rejected',()=>{let t=C.V('x');for(let i=0;i<301;i++)t=C.L('x',t);const s=sample();s.session.original=t;assert.throws(()=>S.decode(JSON.stringify(s)),/上限/);});
test('oversized AST cannot sneak through shared JSON branches',()=>{let t=C.V('x');for(let i=0;i<12;i++)t=C.A(t,t);const s=sample();s.session.original=t;assert.throws(()=>S.decode(JSON.stringify(s)),/上限/);});
test('impossible replay steps are rejected',()=>{const s=sample();s.session.steps=2;assert.throws(()=>S.decode(JSON.stringify(s)),/步数/);});
test('negative or too many steps are rejected',()=>{for(const steps of [-1,201,1.5]){const s=sample();s.session.steps=steps;assert.throws(()=>S.decode(JSON.stringify(s)),/归约状态/);}});
test('invalid progress, mode, selection and view are rejected',()=>{
  for(const mutate of [s=>s.completed=[6],s=>s.mode='other',s=>s.level=5,s=>s.selection.end=100,s=>s.view.scale=100,s=>s.view.speed=0,s=>s.view.autoFit='yes']){const s=sample();mutate(s);assert.throws(()=>S.decode(JSON.stringify(s)),/存档无效/);}
});
test('duplicate function names cannot enter a snapshot',()=>{const s=sample();s.functions.push(s.functions[0]);assert.throws(()=>S.decode(JSON.stringify(s)),/已存在/);});
test('AST is copied without arbitrary properties',()=>{const s=sample();s.session.original.injected='ignored';const r=S.decode(JSON.stringify(s));assert.ok(!('injected' in r.term));});
test('unfinished function editor draft is preserved',()=>{const s=sample();s.functionDraft={name:'NEW',source:'λx.'};assert.deepEqual(S.decode(S.encode(s)).functionDraft,s.functionDraft);});
test('valid generated names are governed by AST budget rather than input budget',()=>{const s=sample();s.session={original:C.V('x'.repeat(1501)),steps:0,dirty:false,halt:''};assert.equal(S.decode(S.encode(s)).term.name.length,1501);});
test('custom speeds and turbo interval survive snapshot roundtrip',()=>{for(const speed of [1,10,35,60000]){const s=sample();s.view.speed=speed;assert.equal(S.decode(S.encode(s)).view.speed,speed);}});
test('invalid custom speeds are rejected by snapshot validation',()=>{for(const speed of [-1,0,1.5,60001,'10']){const s=sample();s.view.speed=speed;assert.throws(()=>S.decode(JSON.stringify(s)),/视图设置/);}});
