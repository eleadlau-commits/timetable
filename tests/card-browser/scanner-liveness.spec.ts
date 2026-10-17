import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';

prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});

for(const format of ['Code128','TelepenNumeric'] as const){
  test(`camera continues processing after a blank frame with stale playback statistics: ${format}`,async({page})=>{
    let pageErrors=0,consoleErrors=0,wasmFailures=0;
    page.on('pageerror',()=>pageErrors++);
    page.on('console',message=>{if(message.type()==='error')consoleErrors++;});
    page.on('requestfailed',request=>{if(request.url().includes('.wasm'))wasmFailures++;});
    await page.goto('/');
    await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
    const value=format==='TelepenNumeric'?'00123456789012':'SYNTHETIC-128';
    const generated=await writeBarcode(value,{format,scale:3,addQuietZones:true});
    const base64=Buffer.from(await generated.image!.arrayBuffer()).toString('base64');
    await page.evaluate(async base64=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
      const ctx=canvas.getContext('2d')!;
      let showBarcode=false;
      const paint=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,1280,720);if(showBarcode)ctx.drawImage(image,(1280-image.width)/2,(720-image.height)/2);};
      paint();setInterval(paint,100);
      (window as any).__showBarcode=()=>{showBarcode=true;paint();};
      // The media pixels advance, but this optional statistics API is stale.
      Object.defineProperty(HTMLVideoElement.prototype,'getVideoPlaybackQuality',{configurable:true,value:()=>({totalVideoFrames:1,droppedVideoFrames:0,corruptedVideoFrames:0,creationTime:0})});
      const original=CanvasRenderingContext2D.prototype.getImageData;
      (window as any).__captures=0;
      CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof original>){
        if(this.canvas.width===1280&&this.canvas.height===720)(window as any).__captures++;
        return original.apply(this,args);
      };
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
        const stream=canvas.captureStream(10);(window as any).__lastStream=stream;return stream;
      }});
    },base64);
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).__captures)).toBeGreaterThan(0);
    await expect(page.getByLabel('Barcode diagnostics',{exact:true})).toContainText('No barcode detected yet');
    await page.evaluate(()=>(window as any).__showBarcode());
    await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:4000});
    expect(await page.evaluate(()=>(window as any).__captures)).toBeGreaterThan(1);
    // HMR can give a dynamic import a separate diagnostics module instance.
    const panel=page.getByLabel('Barcode diagnostics',{exact:true});
    await expect(panel.locator('dt').filter({hasText:/^Successful \/ unsuccessful frames$/}).locator('+ dd')).toHaveText(/^1 \/ [1-9]\d*$/);
    await expect(panel.locator('dt').filter({hasText:/^Reader attempts per frame average \/ maximum$/}).locator('+ dd')).toHaveText('1.0 / 1');
    const timing=await panel.locator('dt').filter({hasText:/^Decode time average \/ maximum$/}).locator('+ dd').textContent();
    console.log(`${format} synthetic average / maximum decoder time: ${timing}`);
    await page.getByRole('button',{name:'Save card',exact:true}).click();
    await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
    // Stop/restart uses the same deliberately stale statistics.
    await page.getByRole('button',{name:'Replace',exact:true}).click();
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
    const saved=await page.evaluate(async()=>{
      const card=await(await import('/src/campus-card/storage.ts')).cardStorage.load();
      return {value:card?.value,format:card?.format};
    });
    expect(saved).toEqual({value,format});
    expect(pageErrors).toBe(0);expect(consoleErrors).toBe(0);expect(wasmFailures).toBe(0);
  });
}
