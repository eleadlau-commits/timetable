// Synthetic-only browser comparison. Frozen baseline is never imported by the app.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const cases=[
  {name:'Telepen centered',format:'TelepenNumeric',value:'00123456789012'},
  {name:'Code128 centered',format:'Code128',value:'SYNTHETIC-128'},
  {name:'EAN13 centered',format:'EAN13',value:'5901234123457'},
  {name:'ITF centered',format:'ITF',value:'00123456789012345678'},
  {name:'Telepen outside guide',format:'TelepenNumeric',value:'00123456789012',position:'edge'},
  {name:'Telepen rotated',format:'TelepenNumeric',value:'00123456789012',position:'rotated'},
  {name:'Telepen ambiguous',format:'TelepenNumeric',value:'12345678901234'},
  {name:'Blank frame',format:'TelepenNumeric',value:'00123456789012',position:'blank'},
];
const browser=await chromium.launch();
const results=[];
try{
  const page=await browser.newPage();
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  for(const fixture of cases){
    const barcode=await writeBarcode(fixture.value,{format:fixture.format,scale:3,addQuietZones:true});
    const base64=Buffer.from(await barcode.image.arrayBuffer()).toString('base64');
    for(let repeat=0;repeat<3;repeat++)for(const pipeline of repeat%2?['restored','regressed']:['regressed','restored']){
      await page.goto('http://127.0.0.1:5173/');
      await page.evaluate(async()=>{await(await import('/src/campus-card/barcode.ts')).prepareDecoder();});
      const before=(await cdp.send('Performance.getMetrics')).metrics.find(x=>x.name==='TaskDuration').value;
      const result=await page.evaluate(async({base64,position,pipeline,expected,format})=>{
        const bitmap=new Image();bitmap.src=`data:image/png;base64,${base64}`;await bitmap.decode();
        const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
        const ctx=canvas.getContext('2d');
        const paint=()=>{
          ctx.fillStyle='#c5beb0';ctx.fillRect(0,0,canvas.width,canvas.height);
          if(position==='blank')return;
          ctx.save();ctx.translate(canvas.width/2,position==='edge'?85:canvas.height/2);
          if(position==='rotated')ctx.rotate(Math.PI/2);
          ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
        };
        paint();
        let stream;
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{stream=canvas.captureStream(10);return stream;}});
        const producer=setInterval(paint,100);
        const video=document.createElement('video');document.body.append(video);
        let captures=0;
        const original=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(...args){if(args[0]===video&&this.canvas.width>64)captures++;return original.apply(this,args);};
        const module=await import(pipeline==='regressed'?'/tests/benchmarks/regressed-scanner.ts':'/src/campus-card/scanner.ts');
        const baseline=await import('/tests/benchmarks/regressed-live-decoder.ts');baseline.benchmarkCounters.attempts=0;
        const diagnostics=await import('/src/campus-card/diagnostics.ts');
        const start=performance.now();
        let stop;
        const outcome=await new Promise(resolve=>{
          const deadline=setTimeout(()=>resolve({status:'timeout'}),1800);
          stop=module.startScanner(video,card=>{clearTimeout(deadline);resolve({status:card.value===expected&&card.format===format?'exact':'wrong'});},()=>{clearTimeout(deadline);resolve({status:'rejected'});});
        });
        const elapsedMs=performance.now()-start;
        stop();clearInterval(producer);CanvasRenderingContext2D.prototype.drawImage=original;video.remove();
        const stats=diagnostics.diagnosticSnapshot().performance;
        return {...outcome,elapsedMs,captures,attempts:pipeline==='regressed'?baseline.benchmarkCounters.attempts:stats?Math.round(stats.attemptsPerFrame*stats.frames):null,
          processedFps:captures/(elapsedMs/1000)};
      },{base64,position:fixture.position,pipeline,expected:fixture.value,format:fixture.format});
      const after=(await cdp.send('Performance.getMetrics')).metrics.find(x=>x.name==='TaskDuration').value;
      results.push({fixture:fixture.name,pipeline,repeat,...result,mainThreadMs:(after-before)*1000});
    }
    process.stdout.write(`Benchmarked ${fixture.name}\n`);
  }
}finally{await browser.close();}
const mean=(xs,key)=>Math.round(xs.reduce((sum,x)=>sum+x[key],0)/xs.length*10)/10;
const summary=cases.flatMap(fixture=>['regressed','restored'].map(pipeline=>{
  const rows=results.filter(x=>x.fixture===fixture.name&&x.pipeline===pipeline);
  return {fixture:fixture.name,pipeline,exact:rows.filter(x=>x.status==='exact').length,trials:rows.length,statuses:rows.map(x=>x.status).join(','),
    elapsedMs:mean(rows,'elapsedMs'),mainThreadMs:mean(rows,'mainThreadMs'),captures:mean(rows,'captures'),attempts:mean(rows,'attempts'),processedFps:mean(rows,'processedFps')};
}));
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/scanner-benchmark.json',JSON.stringify({environment:'Desktop Chromium; 1920x1080 synthetic canvas at 10fps; 1800ms timeout; warm WASM; three alternating trials; UI preview excluded. TaskDuration includes frame producer and setup, not OS CPU usage.',summary,results},null,2));
console.table(summary);
