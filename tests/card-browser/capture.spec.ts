import {test,expect} from './legacy-ui.fixture';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const value='00123456789012';
async function setup(page:Page,mode='barcode'){
  const numeric=await writeBarcode(value,{format:'TelepenNumeric',scale:3,addQuietZones:true});
  const qr=await writeBarcode('SYNTHETIC-UNSUPPORTED',{format:'QRCode',scale:3});
  await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
  await page.evaluate(async({numeric,qr,mode})=>{
    const load=async(base64:string)=>{const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();return image;};
    const barcode=await load(numeric),unsupported=await load(qr);
    const video=document.createElement('canvas');video.width=640;video.height=480;
    let liveMode='blank';
    const paint=()=>{const ctx=video.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,640,480);if(liveMode==='qr')ctx.drawImage(unsupported,100,150);};
    paint();setInterval(paint,100);
    (window as any).__liveMode=(mode:string)=>{liveMode=mode;paint();};
    (window as any).__mode=mode;(window as any).__stillCalls=0;(window as any).__streams=[];(window as any).__frameReads=0;
    const get=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof get>){if(this.canvas.width===640&&this.canvas.height===480)(window as any).__frameReads++;return get.apply(this,args);};
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=video.captureStream(10);(window as any).__streams.push(stream);return stream;}});
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:class{
      async getPhotoCapabilities(){return {imageWidth:{max:1280},imageHeight:{max:960}};}
      async takePhoto(settings:unknown){
        (window as any).__stillCalls++;(window as any).__photoSettings=settings;
        if((window as any).__mode==='hold')await new Promise<void>(resolve=>(window as any).__release=resolve);
        if((window as any).__mode==='throw')throw new DOMException('Synthetic capture refusal','NotSupportedError');
        const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=960;
        const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,1280,960);
        const mode=(window as any).__mode;
        if(mode!=='blank')ctx.drawImage(mode==='qr'?unsupported:barcode,0,Math.floor((960-barcode.height)/2));
        return new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'));
      }
    }});
  },{numeric:Buffer.from(await numeric.image!.arrayBuffer()).toString('base64'),qr:Buffer.from(await qr.image!.arrayBuffer()).toString('base64'),mode});
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.getByRole('button',{name:'Capture barcode',exact:true})).toBeEnabled();
}
const dd=(page:Page,label:string)=>page.getByLabel('Barcode diagnostics',{exact:true}).locator('dt').filter({hasText:new RegExp(`^${label}$`)}).locator('+ dd');

test('high-resolution native still shares photo decoding, previews, saves and survives reload on mobile',async({page})=>{
  await page.setViewportSize({width:320,height:700});await setup(page,'hold');
  const button=page.getByRole('button',{name:'Capture barcode',exact:true});
  const box=await button.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);
  await button.click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__stillCalls)).toBe(1);
  await expect(page.getByRole('button',{name:'Capturing barcode...',exact:true})).toBeDisabled();
  const reads=await page.evaluate(()=>(window as any).__frameReads);
  const videoTime=await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime);
  await page.waitForTimeout(350);
  expect(await page.evaluate(()=>(window as any).__frameReads)).toBe(reads);
  expect(await page.locator('video').evaluate(video=>(video as HTMLVideoElement).currentTime)).toBeGreaterThan(videoTime);
  await page.evaluate(()=>(window as any).__release());
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await expect(dd(page,'Capture method')).toHaveText('ImageCapture.takePhoto');
  await expect(dd(page,'Captured dimensions')).toHaveText('1280 × 960');
  await expect(dd(page,'Shared photo decoder invoked')).toHaveText('Yes');
  await expect(dd(page,'Captured barcode format / variant')).toHaveText('TelepenNumeric / ]B1');
  expect(await page.evaluate(()=>(window as any).__photoSettings)).toEqual({imageWidth:1280,imageHeight:960});
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
  const saved=await page.evaluate(async()=> (await(await import('/src/campus-card/storage.ts')).cardStorage.load())?.value);
  expect(saved).toBe(value);
});

for(const mode of ['blank','qr','throw'])test(`failed ${mode} capture keeps the camera and retries without reacquiring it`,async({page})=>{
  await setup(page,mode);
  const streams=await page.evaluate(()=>(window as any).__streams.length);
  await page.getByRole('button',{name:'Capture barcode',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Barcode not recognised. Try again.');
  await expect(dd(page,'Still capture')).toHaveText('Failed');
  if(mode==='qr'){
    await expect(dd(page,'Capture rejection reason')).toContainText('supported 1D');
    await page.evaluate(()=>(window as any).__liveMode('qr'));
    await page.waitForTimeout(400);
  }
  await expect(page.locator('video')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__streams.at(-1).getVideoTracks()[0].readyState)).toBe('live');
  await page.evaluate(()=>{(window as any).__mode='barcode';(window as any).__liveMode('blank');});
  await page.getByRole('button',{name:'Capture barcode',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__streams.length)).toBe(streams);
  expect(await page.evaluate(()=>(window as any).__stillCalls)).toBe(2);
});

for(const native of ['absent','refused'])test(`native frame fallback preserves dimensions and quiet zones when still API is ${native}`,async({page})=>{
  const generated=await writeBarcode(value,{format:'TelepenNumeric',scale:2,addQuietZones:true});
  await page.goto('/');
  const result=await page.evaluate(async({image,native})=>{
    const bitmap=new Image();bitmap.src=`data:image/png;base64,${image}`;await bitmap.decode();
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const ctx=canvas.getContext('2d')!;const paint=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,640,480);ctx.drawImage(bitmap,0,150);};paint();
    const interval=setInterval(paint,100),stream=canvas.captureStream(10);
    const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();
    Object.defineProperty(window,'ImageCapture',{configurable:true,value:native==='absent'?undefined:class{async takePhoto(){throw Error('Synthetic refusal');}}});
    try{
      const captured=await(await import('/src/campus-card/capture.ts')).capturePhoto(video,stream.getVideoTracks()[0]);
      const card=await(await import('/src/campus-card/barcode.ts')).decodePhoto(captured.blob,captured.method);
      const bitmap=await createImageBitmap(captured.blob);const dimensions=[bitmap.width,bitmap.height];bitmap.close();
      return {method:captured.method,dimensions,value:card.value,format:card.format,variant:card.symbologyIdentifier};
    }finally{clearInterval(interval);stream.getTracks().forEach(track=>track.stop());video.pause();video.srcObject=null;}
  },{image:Buffer.from(await generated.image!.arrayBuffer()).toString('base64'),native});
  expect(result).toEqual({method:'Native video frame (PNG)',dimensions:[640,480],value,format:'TelepenNumeric',variant:']B1'});
});

test('cancelling an in-flight still capture releases camera and discards its late result',async({page})=>{
  await setup(page,'hold');await page.getByRole('button',{name:'Capture barcode',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__stillCalls)).toBe(1);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
  await page.evaluate(()=>(window as any).__release());
  await page.waitForTimeout(200);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__streams.every((stream:MediaStream)=>stream.getTracks().every(track=>track.readyState==='ended')))).toBe(true);
});

test('a failed capture leaves the existing saved credential unchanged',async({page})=>{
  await setup(page,'blank');await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
  await page.getByRole('button',{name:'Enter code manually',exact:true}).click();
  await page.getByLabel('Number underneath the barcode').fill(value);
  await page.getByRole('button',{name:'Preview barcode',exact:true}).click();
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  await expect(page.getByRole('button',{name:'Replace',exact:true})).toBeVisible();
  const before=await page.evaluate(async()=> (await import('/src/campus-card/storage.ts')).cardStorage.load());
  await page.getByRole('button',{name:'Replace',exact:true}).click();
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await page.getByRole('button',{name:'Capture barcode',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Barcode not recognised. Try again.');
  const after=await page.evaluate(async()=> (await import('/src/campus-card/storage.ts')).cardStorage.load());
  expect(after).toEqual(before);
});
