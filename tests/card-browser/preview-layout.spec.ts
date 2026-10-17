import {test,expect} from '@playwright/test';

for(const [name,width,height] of [['portrait',720,1280],['landscape',1280,720],['square',640,640]] as const){
  for(const viewportWidth of [320,390])test(`${name} camera fills preview without letterboxing at ${viewportWidth}px`,async({page})=>{
    await page.setViewportSize({width:viewportWidth,height:844});await page.goto('/');
    await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
    await page.evaluate(({width,height})=>{
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const paint=()=>{const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgb(30, 190, 90)';ctx.fillRect(0,0,width,height);};paint();setInterval(paint,100);
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);(window as any).__layoutStream=stream;return stream;}});
    },{width,height});
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    const capture=page.getByRole('button',{name:'Capture barcode',exact:true});await expect(capture).toBeEnabled();
    const dimensions=await page.locator('.camera-preview').evaluate(preview=>{
      const video=preview.querySelector('video')!,guide=preview.querySelector('.scan-guide')!;
      const frame=preview.getBoundingClientRect(),image=video.getBoundingClientRect(),box=guide.getBoundingClientRect();
      return {frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},image:{x:image.x,y:image.y,width:image.width,height:image.height},guide:{x:box.x,y:box.y,width:box.width,height:box.height},native:[video.videoWidth,video.videoHeight],overflow:document.documentElement.scrollWidth>innerWidth,fit:getComputedStyle(video).objectFit,position:getComputedStyle(video).objectPosition};
    });
    expect(dimensions.native).toEqual([width,height]);expect(dimensions.fit).toBe('contain');expect(dimensions.position).toBe('50% 50%');expect(dimensions.overflow).toBe(false);
    expect(Math.abs(dimensions.frame.width/dimensions.frame.height-width/height)).toBeLessThan(.01);
    expect(Math.abs(dimensions.image.width-dimensions.frame.width)).toBeLessThan(1);expect(Math.abs(dimensions.image.height-dimensions.frame.height)).toBeLessThan(1);
    const {frame,guide}=dimensions;expect(guide.x).toBeGreaterThan(frame.x);expect(guide.y).toBeGreaterThan(frame.y);
    expect(guide.x+guide.width).toBeLessThan(frame.x+frame.width);expect(guide.y+guide.height).toBeLessThan(frame.y+frame.height);
    expect(Math.abs(guide.x+guide.width/2-frame.x-frame.width/2)).toBeLessThan(1);expect(Math.abs(guide.y+guide.height/2-frame.y-frame.height/2)).toBeLessThan(1);
    // Sample actual displayed pixels at both sides, outside the guide. The source
    // is synthetic green, so a dark camera-container background cannot pass.
    const screenshot=await page.locator('.camera-preview').screenshot();
    const sides=await page.evaluate(async bytes=>{
      const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
      return [4,canvas.width-5].map(x=>Array.from(ctx.getImageData(x,Math.floor(canvas.height/2),1,1).data));
    },Array.from(screenshot));
    for(const [r,g,b] of sides){expect(g).toBeGreaterThan(90);expect(g).toBeGreaterThan(r*2);expect(g).toBeGreaterThan(b);}
    await capture.scrollIntoViewIfNeeded();const button=await capture.boundingBox();expect(button!.height).toBeGreaterThanOrEqual(48);expect(button!.x).toBeGreaterThanOrEqual(0);expect(button!.x+button!.width).toBeLessThanOrEqual(viewportWidth);
    await expect(capture).toBeInViewport();await capture.click();await expect(page.getByRole('alert')).toHaveText('Barcode not recognised. Try again.');await expect(capture).toBeEnabled();
    const cancel=page.getByRole('button',{name:'Cancel scan',exact:true});await cancel.scrollIntoViewIfNeeded();await expect(cancel).toBeInViewport();await cancel.click();
    expect(await page.evaluate(()=>(window as any).__layoutStream.getTracks().every((track:MediaStreamTrack)=>track.readyState==='ended'))).toBe(true);
  });
}
