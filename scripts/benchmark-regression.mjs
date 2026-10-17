// Synthetic-only comparison against exact historical scanner modules.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
const repository=process.env.CAMPUS_CARD_GIT_DIR??(existsSync('.git')?'.':'.git-backup/campus-card');
for(const sha of ['5b957587976b5f0487f25b497b683035da73972d','1e8eb002a3703fe2daae54fa55d64c9832a2d97d']){
  const dir=`artifacts/scanner-baselines/${sha.slice(0,8)}`;mkdirSync(dir,{recursive:true});
  for(const name of ['scanner','barcode','capture','diagnostics','live-decoder','scan-performance','camera-diagnostics','model'])writeFileSync(`${dir}/${name}.ts`,execFileSync('git',['-C',repository,'show',`${sha}:src/campus-card/${name}.ts`]));
}
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const fixtures=[
  {name:'Telepen stable',format:'TelepenNumeric',text:'00123456789012'},
  {name:'Telepen brief readable view',format:'TelepenNumeric',text:'00123456789012',effect:'brief'},
  {name:'Telepen narrow blurred',format:'TelepenNumeric',text:'00123456789012',effect:'blur',scale:1},
  {name:'Telepen rotated',format:'TelepenNumeric',text:'00123456789012',effect:'rotate'},
  {name:'Code128',format:'Code128',text:'SYNTHETIC-128'},
  {name:'EAN13',format:'EAN13',text:'5901234123457'},
  {name:'ITF',format:'ITF',text:'00123456789012345678'},
  {name:'Telepen ambiguous',format:'TelepenNumeric',text:'12345678901234'},
];
const pipelines=process.argv.includes('--baseline-only')?['5b957587','1e8eb002']:['5b957587','1e8eb002','current'];
const results=[],browser=await chromium.launch();
try{
  const page=await browser.newPage();
  for(const fixture of fixtures){
    const written=await writeBarcode(fixture.text,{format:fixture.format,scale:fixture.scale??2,addQuietZones:true});
    const image=Buffer.from(await written.image.arrayBuffer()).toString('base64');
    for(let repeat=0;repeat<3;repeat++)for(const pipeline of repeat%2?[...pipelines].reverse():pipelines){
      await page.goto('http://127.0.0.1:5173/');
      const prefix=pipeline==='current'?'/src/campus-card':`/artifacts/scanner-baselines/${pipeline}`;
      const result=await page.evaluate(async({image,prefix,fixture})=>{
        const barcode=await import(`${prefix}/barcode.ts`);await barcode.prepareDecoder();
        const scannerSource=await(await fetch(`${prefix}/scanner.ts`)).text();
        // Follow Vite's exact dependency URL (including HMR timestamp) so metrics
        // come from the scanner's singleton rather than a second module instance.
        const diagnosticURL=scannerSource.match(/from\s+["']([^"']*\/diagnostics\.ts[^"']*)["']/)?.[1]??`${prefix}/diagnostics.ts`;
        const scanner=await import(`${prefix}/scanner.ts`),diagnostics=await import(diagnosticURL);
        const bitmap=new Image();bitmap.src=`data:image/png;base64,${image}`;await bitmap.decode();
        const source=document.createElement('canvas');source.width=1280;source.height=720;
        const ctx=source.getContext('2d');let mediaAt=Infinity;
        const paint=()=>{
          ctx.fillStyle='#eee';ctx.fillRect(0,0,1280,720);
          const age=performance.now()-mediaAt;if(fixture.effect==='brief'&&(age<250||age>650))return;
          ctx.save();ctx.translate(640,360);if(fixture.effect==='rotate')ctx.rotate(Math.PI/2);if(fixture.effect==='blur')ctx.filter='blur(0.35px)';ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();
        };
        const producer=setInterval(paint,33);paint();
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{mediaAt=performance.now();paint();return source.captureStream(30);}});
        const video=document.createElement('video');video.muted=true;document.body.append(video);
        let pngCalls=0,pngMs=0,pixelReads=0,captureTotalMs=0,captureMaxMs=0;
        const encode=HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob=function(callback,...args){const started=performance.now();pngCalls++;return encode.call(this,blob=>{pngMs+=performance.now()-started;callback(blob);},...args);};
        const read=CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData=function(...args){const start=performance.now();pixelReads++;try{return read.apply(this,args);}finally{const ms=performance.now()-start;captureTotalMs+=ms;captureMaxMs=Math.max(captureMaxMs,ms);}};
        const started=performance.now();let stop;
        const status=await new Promise(resolve=>{
          const deadline=setTimeout(()=>resolve('timeout'),2200);
          stop=scanner.startScanner(video,card=>{clearTimeout(deadline);resolve(card.value===fixture.text&&card.format===fixture.format?'exact':'wrong');},()=>{clearTimeout(deadline);resolve('rejected');});
        });
        const elapsedMs=performance.now()-started;stop();clearInterval(producer);video.remove();
        HTMLCanvasElement.prototype.toBlob=encode;CanvasRenderingContext2D.prototype.getImageData=read;
        const stats=diagnostics.diagnosticSnapshot().performance;
        return {status,elapsedMs,pngCalls,pngMs,pixelReads,pixelReadAverageMs:captureTotalMs/pixelReads,pixelReadMaxMs:captureMaxMs,decodeAverageMs:stats?.averageMs??null,decodeMaxMs:stats?.maxMs??null};
      },{image,prefix,fixture});
      results.push({fixture:fixture.name,pipeline,repeat,...result});
    }
    console.log(`Benchmarked synthetic ${fixture.name}`);
  }
}finally{await browser.close();}
const average=(rows,key)=>Math.round(rows.reduce((sum,row)=>sum+(row[key]??0),0)/rows.length*10)/10;
const summary=fixtures.flatMap(fixture=>pipelines.map(pipeline=>{
  const rows=results.filter(row=>row.fixture===fixture.name&&row.pipeline===pipeline);
  return {fixture:fixture.name,pipeline,exact:rows.filter(row=>row.status==='exact').length,trials:rows.length,meanElapsedMs:average(rows,'elapsedMs'),pngCalls:average(rows,'pngCalls'),pngMs:average(rows,'pngMs'),meanDecodeMs:average(rows,'decodeAverageMs'),maxDecodeMs:Math.max(...rows.map(row=>row.decodeMaxMs??0))};
}));
const output=process.argv.includes('--baseline-only')?'artifacts/regression-baselines.json':'artifacts/regression-comparison.json';
writeFileSync(output,JSON.stringify({environment:'Desktop Chromium; warm WASM; synthetic 1280x720 at 30fps; three alternating-order trials; 2200ms timeout; no physical camera or credential data',summary,results},null,2));console.table(summary);
