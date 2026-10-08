const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const port = Number(process.env.PORT || 4189);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{
  let relative;
  try { relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end();return; }
  const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  const fromRoot=path.relative(root,file);
  if(fromRoot.startsWith('..') || path.isAbsolute(fromRoot) || fromRoot.split(path.sep).some(x=>x.startsWith('.'))) { res.writeHead(403).end();return; }
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);});
});
server.listen(port,'127.0.0.1',()=>console.log(`Lambda Lab: http://127.0.0.1:${server.address().port}`));
module.exports=server;
