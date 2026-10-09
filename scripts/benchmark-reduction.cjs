const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),ref=process.argv[2];
function load(file){const context={module:{exports:{}},exports:{},require};vm.createContext(context);vm.runInContext(ref?execFileSync('git',['show',`${ref}:src/${file}.js`],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'src',`${file}.js`),'utf8'),context);return context.module.exports;}
const C=load('core');
function time(run,repeats=5){run();const times=[];for(let i=0;i<repeats;i++){const start=performance.now();run();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return Number(times[Math.floor(times.length/2)].toFixed(3));}
function coldTime(build){const times=[];for(let i=0;i<5;i++){const term=build();C.inspect(term);const start=performance.now();C.step(term);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return Number(times[2].toFixed(3));}
function sparse(size){let body=C.V('z');for(let i=0;i<size;i++)body=C.A(C.V('f'),body);return C.A(C.A(C.V('g'),C.L('z',body)),C.A(C.L('x',C.V('x')),C.V('y')));}
function substituteCase(size){let body=C.V('x');for(let i=0;i<size;i++)body=C.L(`a${i}`,body);return C.A(C.L('x',body),C.V('y'));}
const rows=[];
for(const size of [300,900,1800]){
  const term=sparse(size);C.inspect(term);
  rows.push({case:'one-redex-large-normal-subtree',size,nodes:C.inspect(term).nodes,firstStepMs:coldTime(()=>sparse(size)),findMs:time(()=>C.findRedex(term)),stepMs:time(()=>C.step(term)),formatMs:time(()=>C.format(term)),equalSmallMs:time(()=>C.equal(term,C.parse('λa.a')))});
}
for(const size of [100,300,600]){const term=substituteCase(size);C.inspect(term);rows.push({case:'one-substitution-under-many-binders',size,nodes:C.inspect(term).nodes,firstStepMs:coldTime(()=>substituteCase(size)),stepMs:time(()=>C.step(term))});}
console.log(JSON.stringify({revision:ref||'working-tree',node:process.version,rows},null,2));
