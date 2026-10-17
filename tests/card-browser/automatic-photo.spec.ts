import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const value='00123456789012';
const dd=(page:Page,label:string)=>page.getByLabel('Barcode diagnostics',{exact:true}).locator('dt').filter({hasText:label}).locator('+ dd');
async function camera(page:Page,options:{mode?:string;width?:number;height?:number;hold?:'encode'|'open';failFirst?:boolean;refuseResolution?:boolean}={}){
  const numeric=await writeBarcode(value,{format:'TelepenNumeric',scale:2,addQuietZones:true});
  const qr=await writeBarcode('SYNTHETIC-UNSUPPORTED',{format:'QRCode',scale:3});
  await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
  await page.evaluate(async({numeric,qr,options})=>{
    const load=async(base64:string)=>{const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();return image;};
    const images={numeric:await load(numeric),qr:await load(qr)};
    const source=document.createElement('canvas');source.width=options.width??640;source.height=options.height??480;
    let mode=options.mode??'numeric';
    const paint=()=>{const ctx=source.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,source.width,source.height);const image=images[mode as keyof typeof images];if(image)ctx.drawImage(image,0,Math.floor((source.height-image.height)/2));};
    paint();setInterval(paint,100);
    (window as any).__mode=(next:string)=>{mode=next;paint();};
    const stats={encodes:0,activeEncodes:0,maxEncodes:0,opens:0,activeOpens:0,maxOpens:0,photoReads:0,stillCalls:0,bitmapCloses:0,sizes:[] as number[][],starts:[] as number[],requests:[] as any[],streams:[] as MediaStream[]};
    (window as any).__auto=stats;
    const cameraCanvases=new Set<HTMLCanvasElement>();
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args:Parameters<typeof draw>){if(args[0] instanceof HTMLVideoElement)cameraCanvases.add(this.canvas);return draw.apply(this,args);};
    const read=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof read>){if(this.canvas.width===source.width&&this.canvas.height===source.height&&!cameraCanvases.has(this.canvas))stats.photoReads++;return read.apply(this,args);};
    const encode=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){
      if(!cameraCanvases.has(this))return encode.call(this,callback,type,quality);
      stats.encodes++;stats.activeEncodes++;stats.maxEncodes=Math.max(stats.maxEncodes,stats.activeEncodes);stats.sizes.push([this.width,this.height]);stats.starts.push(performance.now());
      const done=(blob:Blob|null)=>{stats.activeEncodes--;callback(blob);};
      const run=()=>encode.call(this,done,type,quality);
      if(options.failFirst&&stats.encodes===1){queueMicrotask(()=>done(null));return;}
      if(options.hold==='encode'&&stats.encodes===1){(window as any).__release=run;return;}
      run();
    };
    const open=window.createImageBitmap.bind(window);
    window.createImageBitmap=async function(input,...args:any[]){
      stats.opens++;stats.activeOpens++;stats.maxOpens=Math.max(stats.maxOpens,stats.activeOpens);
      try{
        if(options.hold==='open'&&stats.opens===1)await new Promise<void>(resolve=>(window as any).__release=resolve);
        const bitmap=await (open as any)(input,...args);
        const close=bitmap.close.bind(bitmap);bitmap.close=()=>{stats.bitmapCloses++;close();};return bitmap;
      }finally{stats.activeOpens--;}
    } as typeof createImageBitmap;
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{constructor(){stats.stillCalls++;throw Error('Continuous scanning must not use native still capture');}}});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
      stats.requests.push(constraints);
      if(options.refuseResolution&&constraints.video.width)throw new DOMException('Synthetic resolution refusal','OverconstrainedError');
      const stream=source.captureStream(10);const track=stream.getVideoTracks()[0];
      Object.defineProperty(track,'getCapabilities',{value:()=>({width:{min:320,max:3840},height:{min:240,max:2160}})});
      stats.streams.push(stream);return stream;
    }});
  },{numeric:Buffer.from(await numeric.image!.arrayBuffer()).toString('base64'),qr:Buffer.from(await qr.image!.arrayBuffer()).toString('base64'),options});
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
}

test('automatic native 1080p photo decoding has no capture button and saves/reloads on mobile',async({page})=>{
  await page.setViewportSize({width:320,height:700});await camera(page,{width:1920,height:1080});
  await expect(page.getByRole('button',{name:'Capture barcode',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await expect(dd(page,'Capture method')).toHaveText('Native video frame (PNG)');
  await expect(dd(page,'Captured dimensions')).toHaveText('1920 × 1080');
  await expect(dd(page,'Shared photo decoder invoked')).toHaveText('Yes');
  await expect(dd(page,'decodePhoto() invoked')).toHaveText('Yes');
  await expect(dd(page,'Captured barcode format / variant')).toHaveText('TelepenNumeric / ]B1');
  console.log('Synthetic 1920x1080 frame timings:',{capture:await dd(page,'Frame capture time').textContent(),decode:await dd(page,'Decode time average / maximum').textContent()});
  await expect(dd(page,'Advertised dimension ranges')).toContainText('3840');
  const stats=await page.evaluate(()=>(window as any).__auto);
  expect(stats.requests.some((x:any)=>x.video.width?.ideal===1920&&x.video.height?.ideal===1080)).toBe(true);
  expect(stats.sizes.every((x:number[])=>x[0]===1920&&x[1]===1080)).toBe(true);
  expect(stats.photoReads).toBeGreaterThan(0);expect(stats.stillCalls).toBe(0);
  expect(await page.evaluate(()=>(window as any).__auto.streams.every((stream:MediaStream)=>stream.getTracks().every(track=>track.readyState==='ended')))).toBe(true);
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  expect(await page.evaluate(async()=> (await(await import('/src/campus-card/storage.ts')).cardStorage.load())?.value)).toBe(value);
});

test('blank frames retry at a measured cadence before recognising a supported image without reopening the camera',async({page})=>{
  await camera(page,{mode:'blank'});
  await expect.poll(()=>page.evaluate(()=>(window as any).__auto.encodes)).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('status')).toHaveText('Scanning...');
  const requests=await page.evaluate(()=>(window as any).__auto.requests.length);
  const metadata={frequency:await dd(page,'Actual scanning frequency').textContent(),decode:await dd(page,'Decode time average / maximum').textContent(),capture:await dd(page,'Frame capture time').textContent()};
  console.log('Synthetic automatic photo scanning measurements:',metadata);
  const starts=await page.evaluate(()=>(window as any).__auto.starts);
  expect(starts[1]-starts[0]).toBeGreaterThanOrEqual(900);
  await page.evaluate(()=>(window as any).__mode('numeric'));
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:10000});
  expect(await page.evaluate(()=>(window as any).__auto.requests.length)).toBe(requests);
  const before=await page.evaluate(()=>(window as any).__auto.encodes);await page.waitForTimeout(1200);
  expect(await page.evaluate(()=>(window as any).__auto.encodes)).toBe(before);
});

for(const hold of ['encode','open'] as const)test(`one automatic operation at a time during slow ${hold}; cancellation discards late work`,async({page})=>{
  await camera(page,{mode:'blank',hold});
  await expect.poll(()=>page.evaluate(()=>typeof(window as any).__release)).toBe('function');
  const videoTime=await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime);
  await page.waitForTimeout(1250);
  expect(await page.evaluate(()=>(window as any).__auto.encodes)).toBe(1);
  expect(await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(videoTime);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
  const before=await page.evaluate(()=>(window as any).__auto.photoReads);
  await page.evaluate(()=>(window as any).__release());await page.waitForTimeout(1200);
  const stats=await page.evaluate(()=>(window as any).__auto);
  expect(stats.encodes).toBe(1);expect(stats.photoReads).toBe(before);expect(stats.maxEncodes).toBe(1);expect(stats.maxOpens).toBeLessThanOrEqual(1);
  if(hold==='open')expect(stats.bitmapCloses).toBe(1);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toHaveCount(0);
});

test('a failed PNG capture retries automatically instead of leaving a stuck scanner',async({page})=>{
  await camera(page,{failFirst:true});
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:10000});
  expect(await page.evaluate(()=>(window as any).__auto.encodes)).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('unsupported frames remain rejected but the next supported frame can be recognised',async({page})=>{
  await camera(page,{mode:'qr'});
  await expect(dd(page,'Capture rejection reason')).toContainText('supported 1D');
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('video')).toBeVisible();
  await page.evaluate(()=>(window as any).__mode('numeric'));
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:10000});
});

test('resolution refusal falls back and reports delivered native dimensions rather than ideal dimensions',async({page})=>{
  await camera(page,{width:640,height:480,refuseResolution:true});
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await expect(dd(page,'Camera frame')).toHaveText('640 × 480');
  await expect(dd(page,'Captured dimensions')).toHaveText('640 × 480');
  const stats=await page.evaluate(()=>(window as any).__auto);
  expect(stats.requests.some((x:any)=>!x.video.width)).toBe(true);
  expect(stats.sizes.every((x:number[])=>x[0]===640&&x[1]===480)).toBe(true);
});
