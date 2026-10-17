import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const value='00123456789012';
const dd=(page:Page,label:string)=>page.getByLabel('Barcode diagnostics',{exact:true}).locator('dt').filter({hasText:label}).locator('+ dd');
async function camera(page:Page,options:{mode?:string;width?:number;height?:number;hold?:boolean;failFirst?:boolean;refuseResolution?:boolean;support4k?:boolean;brief?:boolean}={}){
  if(options.hold)await page.route('**/src/campus-card/barcode.ts*',async route=>{
    const response=await route.fetch();let body=await response.text();
    body=body.replace('export async function decodePixels(', 'async function originalDecodePixels(');
    body+=`\nexport async function decodePixels(...args){window.__active=(window.__active||0)+1;window.__maxActive=Math.max(window.__maxActive||0,window.__active);try{await new Promise(resolve=>window.__release=resolve);return await originalDecodePixels(...args);}finally{window.__active--;}}`;
    await route.fulfill({response,body});
  });
  const numeric=await writeBarcode(value,{format:'TelepenNumeric',scale:2,addQuietZones:true});
  const qr=await writeBarcode('SYNTHETIC-UNSUPPORTED',{format:'QRCode',scale:3});
  await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
  await page.evaluate(async({numeric,qr,options})=>{
    const load=async(base64:string)=>{const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();return image;};
    const images={numeric:await load(numeric),qr:await load(qr)};
    const source=document.createElement('canvas');source.width=options.width??640;source.height=options.height??480;
    let mode=options.mode??'numeric',mediaAt=Infinity;
    const paint=()=>{const ctx=source.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,source.width,source.height);if(options.brief&&(performance.now()-mediaAt<250||performance.now()-mediaAt>650))return;const image=images[mode as keyof typeof images];if(image)ctx.drawImage(image,0,Math.floor((source.height-image.height)/2));};
    paint();setInterval(paint,33);(window as any).__mode=(next:string)=>{mode=next;paint();};
    const stats={encodes:0,stillCalls:0,sizes:[] as number[][],starts:[] as number[],requests:[] as any[],constraints:[] as any[],streams:[] as MediaStream[]};(window as any).__auto=stats;
    const cameraCanvases=new Set<HTMLCanvasElement>();const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args:Parameters<typeof draw>){if(args[0] instanceof HTMLVideoElement)cameraCanvases.add(this.canvas);return draw.apply(this,args);};
    const read=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof read>){
      if(cameraCanvases.has(this.canvas)){stats.sizes.push([this.canvas.width,this.canvas.height]);stats.starts.push(performance.now());if(options.failFirst&&stats.starts.length===1)throw new Error('Synthetic capture failure');}
      return read.apply(this,args);
    };
    const encode=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(...args:Parameters<typeof encode>){if(cameraCanvases.has(this))stats.encodes++;return encode.apply(this,args);};
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{constructor(){stats.stillCalls++;throw Error('No native still capture');}}});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{
      stats.requests.push(constraints);if(options.refuseResolution&&constraints.video.width)throw new DOMException('Synthetic refusal','OverconstrainedError');
      mediaAt=performance.now();paint();const stream=source.captureStream(30),track=stream.getVideoTracks()[0];
      Object.defineProperty(track,'getCapabilities',{value:()=>({width:{min:320,max:3840},height:{min:240,max:2160}})});
      const apply=track.applyConstraints.bind(track);
      Object.defineProperty(track,'applyConstraints',{value:async(c:MediaTrackConstraints)=>{stats.constraints.push(c);if(options.support4k&&c.width){source.width=(c.width as ConstrainULongRange).exact!;source.height=(c.height as ConstrainULongRange).exact!;paint();}else if(c.width)throw new DOMException('Pair unsupported','OverconstrainedError');else await apply(c);}});
      if(options.support4k)Object.defineProperty(track,'getSettings',{value:()=>({width:source.width,height:source.height})});
      stats.streams.push(stream);return stream;
    }});
  },{numeric:Buffer.from(await numeric.image!.arrayBuffer()).toString('base64'),qr:Buffer.from(await qr.image!.arrayBuffer()).toString('base64'),options});
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
}
test('native 1080p shared pixels scan automatically and save/reload without PNG or Capture button',async({page})=>{
  await page.setViewportSize({width:320,height:700});await camera(page,{width:1920,height:1080});
  await expect(page.getByRole('button',{name:'Capture barcode',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await expect(dd(page,'Capture method')).toHaveText('Native video pixels');await expect(dd(page,'Captured dimensions')).toHaveText('1920 × 1080');
  await expect(dd(page,'Shared photo decoder invoked')).toHaveText('Yes');await expect(dd(page,'decodePhoto() invoked')).toHaveText('No');
  await expect(dd(page,'Captured barcode format / variant')).toHaveText('TelepenNumeric / ]B1');await expect(dd(page,'Scanning active')).toHaveText('No');
  console.log('Synthetic 1080p:',{capture:await dd(page,'Capture time average / maximum').textContent(),decode:await dd(page,'Decode time average / maximum').textContent()});
  const stats=await page.evaluate(()=>(window as any).__auto);expect(stats.encodes).toBe(0);expect(stats.stillCalls).toBe(0);expect(stats.sizes).toEqual([[1920,1080]]);
  expect(stats.requests[0].video.width.ideal).toBe(1920);
  expect(await page.evaluate(()=>(window as any).__auto.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  await page.getByRole('button',{name:'Save card',exact:true}).click();await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  expect(await page.evaluate(async()=> (await(await import('/src/campus-card/storage.ts')).cardStorage.load())?.value)).toBe(value);
});
test('blank frames retry near 500ms and accelerate without reopening the camera',async({page})=>{
  await camera(page,{mode:'blank'});await expect.poll(()=>page.evaluate(()=>(window as any).__auto.starts.length)).toBeGreaterThanOrEqual(10);
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('status')).toHaveText('Scanning...');
  const starts=await page.evaluate(()=>(window as any).__auto.starts);expect(starts[1]-starts[0]).toBeGreaterThanOrEqual(450);expect(starts[1]-starts[0]).toBeLessThan(900);
  expect(starts[9]-starts[8]).toBeLessThan(450);
  await page.evaluate(()=>(window as any).__mode('numeric'));await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  const before=await page.evaluate(()=>(window as any).__auto.starts.length);await page.waitForTimeout(650);expect(await page.evaluate(()=>(window as any).__auto.starts.length)).toBe(before);
});
test('brief Telepen readable view survives the scheduling regression',async({page})=>{
  await camera(page,{brief:true});await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
});
test('slow asynchronous decoding never overlaps; cancel discards late work and restart works',async({page})=>{
  await camera(page,{hold:true});await expect.poll(()=>page.evaluate(()=>typeof(window as any).__release)).toBe('function');
  const videoTime=await page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime);await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>(window as any).__auto.starts.length)).toBe(1);expect(await page.evaluate(()=>(window as any).__maxActive)).toBe(1);
  expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThan(videoTime);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();await page.evaluate(()=>(window as any).__release());await page.waitForTimeout(600);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toHaveCount(0);
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__active)).toBe(1);
  await page.evaluate(()=>(window as any).__release());await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();expect(await page.evaluate(()=>(window as any).__maxActive)).toBe(1);
});
test('failed pixel capture retries instead of becoming stuck',async({page})=>{
  await camera(page,{failFirst:true});await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();expect(await page.evaluate(()=>(window as any).__auto.starts.length)).toBeGreaterThanOrEqual(2);
});
test('unsupported frames are rejected then a supported frame is recognised',async({page})=>{
  await camera(page,{mode:'qr'});await expect(dd(page,'Capture rejection reason')).toContainText('supported 1D');await expect(dd(page,'Recognition status')).toHaveText('Rejected by validation');
  await expect(page.getByRole('alert')).toHaveCount(0);await page.evaluate(()=>(window as any).__mode('numeric'));await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
});
test('initial resolution refusal falls back to delivered 720p',async({page})=>{
  await camera(page,{width:1280,height:720,refuseResolution:true});await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await expect(dd(page,'Camera frame')).toHaveText('1280 × 720');await expect(dd(page,'Captured dimensions')).toHaveText('1280 × 720');expect(await page.evaluate(()=>(window as any).__auto.requests.some((x:any)=>!x.video.width))).toBe(true);
});
test('supported 4K is verified and captured at native dimensions',async({page})=>{
  await camera(page,{width:1920,height:1080,support4k:true});await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:15000});
  await expect(dd(page,'Resolution negotiation')).toContainText('3840 × 2160: verified');await expect(dd(page,'Captured dimensions')).toHaveText('3840 × 2160');
  expect(await page.evaluate(()=>(window as any).__auto.sizes)).toEqual([[3840,2160]]);
  console.log('Synthetic 4K:',{capture:await dd(page,'Capture time average / maximum').textContent(),decode:await dd(page,'Decode time average / maximum').textContent()});
});
