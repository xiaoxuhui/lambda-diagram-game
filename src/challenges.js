(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),D=root.LambdaDecimal||require('./decimal.js'),M=root.LambdaPolynomial||require('./polynomial.js');
  function compile(level){
    return level.encoding==='decimal'?D.expand(C.parseInput(level.start),level.decimalPlaces??6):C.parse(level.start);
  }
  function matches(level,term){
    if(!term||C.findRedex(term))return false;
    if(level.targetType==='decimal'){
      const value=D.read(term);
      return !!value&&!value.error&&!value.approximate&&D.format(value)===level.target;
    }
    if(level.targetType==='polynomial'){
      const value=M.readPolynomial(term);return value!==null&&M.formatPolynomial(value)===level.target;
    }
    if(level.targetType==='rational'){
      const value=M.readRational(term);return value!==null&&M.formatRational(value)===level.target;
    }
    return C.equal(term,C.parse(level.target));
  }
  const API={compile,matches};root.LambdaChallenges=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
