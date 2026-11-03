(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),L=root.LambdaLibrary||require('./library.js'),E=root.LambdaDataEncoding||require('./data-encoding.js'),S=root.LambdaSnapshot||require('./snapshot.js');
  const definitions=[
    ['CHURCH_SUCC','λn f x.f (n f x)'],
    ['LIST_EMPTY','λc n.n'],
    ['LIST_CONS','λh t c n.c h (t c n)'],
    ['LIST_ONE','λx c n.c x n'],
    ['LIST_APPEND','λa b c n.a c (b c n)'],
    ['LIST_HEAD','λl d.l (λh r.h) d'],
    ['LIST_LENGTH','λl.l (λh r.CHURCH_SUCC r) 0_church'],
    ['LIST_IS_EMPTY','λl.l (λh r.λx y.y) (λx y.x)'],
    ['LIST_TAIL','λl.(l (λh p.(λa b k.k a b) (LIST_CONS h (p (λx y.x))) (p (λx y.x))) ((λa b k.k a b) LIST_EMPTY LIST_EMPTY)) (λx y.y)'],
    ['SET_ZERO','LIST_EMPTY'],
    ['SET_SUCC','λs.LIST_APPEND s (LIST_ONE s)'],
    ['SET_FROM_CHURCH','λn.n SET_SUCC SET_ZERO'],
    ['SET_TO_CHURCH','LIST_LENGTH'],
    ['SET_ADD','λa b.(SET_TO_CHURCH b) SET_SUCC a'],
    ['SET_MUL','λa b.(SET_TO_CHURCH b) (SET_ADD a) SET_ZERO']
  ];
  function create(){
    let functions=[];
    for(const [name,source] of definitions)functions=L.add(functions,name,source,Infinity,'church',6,[],E.parse(source));
    let dataEncodings=E.define([],'Set','SET_FROM_CHURCH',term=>L.expand(term,functions));
    dataEncodings=E.withInputFormat(dataEncodings,'Set','s{n}');
    for(let number=0;number<=5;number++){
      const result=C.normalize(C.A(dataEncodings[0].term,C.parse(String(number))),Infinity);
      if(result.status!=='normal')throw new C.LambdaError('默认集合数字未能归约到正规形。');
      dataEncodings=E.putMapping(dataEncodings,'Set',String(number),result.term);
    }
    const raw={version:2,draft:'SET_ADD 1_Set 2_Set',functions,dataEncodings,encodingDraft:{name:'',source:''},functionDraft:{name:'',source:''},completed:[],mode:'free',level:0,
      session:{original:null,steps:0,dirty:true,halt:'',encodings:[]},
      view:{numberEncoding:'custom:Set',numberFormats:{},decimalPlaces:6,speed:10,strategy:'normal',direction:'left',scale:1,autoFit:true,panX:0,panY:0,historyOpen:false,helpOpen:false,hintOpen:false},
      selection:{start:0,end:0},error:''};
    return S.decode(S.encode(raw));
  }
  const API={create,definitions};root.LambdaDefaultState=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
