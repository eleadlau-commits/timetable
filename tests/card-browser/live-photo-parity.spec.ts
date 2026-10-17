import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});

for(const sample of [
  {format:'TelepenNumeric',value:'00123456789012',rotated:false},
  {format:'TelepenNumeric',value:'00123456789012',rotated:true},
  {format:'Code128',value:'SYNTHETIC-128',rotated:false},
  {format:'EAN13',value:'5901234123457',rotated:false},
  {format:'ITF',value:'00123456789012345678',rotated:false},
] as const){
  test(`live/photo parity retains native pixels and quiet zones: ${sample.format}, rotated=${sample.rotated}`,async({page})=>{
    const generated=await writeBarcode(sample.value,{format:sample.format,scale:2,addQuietZones:true});
    const base64=Buffer.from(await generated.image!.arrayBuffer()).toString('base64');
    await page.goto('/');
    await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
    const photo=await page.evaluate(async({base64,rotated})=>{
      const bitmap=new Image();bitmap.src=`data:image/png;base64,${base64}`;await bitmap.decode();
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d')!;
      const paint=()=>{
        ctx.fillStyle='white';ctx.fillRect(0,0,640,480);
        if(rotated){ctx.save();ctx.translate(320,240);ctx.rotate(Math.PI/2);ctx.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);ctx.restore();}
        // The image's own left quiet zone begins at the frame boundary.
        else ctx.drawImage(bitmap,0,Math.floor((480-bitmap.height)/2));
      };
      paint();
      const blob=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/png'));
      const photo=await(await import('/src/campus-card/barcode.ts')).decodePhoto(blob);
      setInterval(paint,100);
      const capturedCanvases=new Set<HTMLCanvasElement>();
      (window as any).__captureSizes=[];
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args:Parameters<typeof draw>){
        if(args[0] instanceof HTMLVideoElement)capturedCanvases.add(this.canvas);
        return draw.apply(this,args);
      };
      const get=CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof get>){
        if(capturedCanvases.has(this.canvas))(window as any).__captureSizes.push([this.canvas.width,this.canvas.height,...args.slice(0,4)]);
        return get.apply(this,args);
      };
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>canvas.captureStream(10)});
      return {format:photo.format,value:photo.value,bytes:photo.bytes,variant:photo.symbologyIdentifier};
    },{base64,rotated:sample.rotated});
    expect(photo.format).toBe(sample.format);expect(photo.value).toBe(sample.value);
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
    const diagnostics=page.getByLabel('Barcode diagnostics',{exact:true});
    await expect(diagnostics.locator('dt').filter({hasText:/^Camera frame$/}).locator('+ dd')).toHaveText('640 × 480');
    await expect(diagnostics).toContainText('1920 × 1080 (ideal, not guaranteed)');
    if(sample.format==='TelepenNumeric')await expect(diagnostics.locator('dt').filter({hasText:'Telepen candidate (latest frame)'}).locator('+ dd')).toHaveText('Accepted');
    const captures=await page.evaluate(()=>(window as any).__captureSizes);
    expect(captures.length).toBeGreaterThan(0);
    expect(captures.every((size:number[])=>JSON.stringify(size)===JSON.stringify([640,480,0,0,640,480]))).toBe(true);
    await page.getByRole('button',{name:'Save card',exact:true}).click();
    const live=await page.evaluate(async()=>{
      const card=await(await import('/src/campus-card/storage.ts')).cardStorage.load();
      return {format:card?.format,value:card?.value,bytes:card?.bytes,variant:card?.symbologyIdentifier};
    });
    expect(live).toEqual(photo);
  });
}
