const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pin=JSON.parse(fs.readFileSync(path.join(root,'components/ui-conventions.lock.json'),'utf8'));
test('fixed v1 component bytes and combined native script parse across releases',()=>{
 for(const name of ['ui-conventions.js','ui-conventions.css'])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'components',name))).digest('hex'),pin.files[name]);
 for(const name of ['src/index.template.html','dist/index.html','arrow-viewer.html','dist/index.self-extract.html']){let html=fs.readFileSync(path.join(root,name),'utf8');const payload=html.match(/id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\r\n]+)<\/script>/);if(payload)html=zlib.gunzipSync(Buffer.from(payload[1],'base64')).toString('utf8');const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!(/type="(application|text)\//.test(x[1])));new vm.Script(scripts.map(x=>x[2]).join('\n;\n'),{filename:name});}
});
test('language priority URL/shared/legacy/browser and explicit storage error',()=>{
 const ui=require('../components/ui-conventions.js'),writes=[],values=new Map([[ui.languageKey,'ja'],['old','en']]),storage={getItem:k=>values.get(k),setItem:(k,v)=>writes.push([k,v])};
 const opts={storage,legacyKeys:['old'],languages:['fr','en-US','ja-JP']};assert.equal(ui.resolveLanguage({...opts,url:'https://example.test/?lang=en'}),'en');assert.equal(ui.resolveLanguage({...opts,url:'?lang=xx'}),'ja');values.delete(ui.languageKey);assert.equal(ui.resolveLanguage(opts),'en');values.delete('old');assert.equal(ui.resolveLanguage(opts),'en');assert.equal(writes.length,0);assert.equal(ui.chooseLanguage('ja',{storage:{setItem(){throw Error('quota')}},url:'',history:null}).persisted,false);
});
