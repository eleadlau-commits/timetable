import {test,expect} from '@playwright/test';

for(const [name,width,height] of [['portrait',720,1280],['landscape',1280,720],['square',640,640]] as const){
  for(const viewportWidth of [320,390])test(`${name} camera fills compact card-shaped preview at ${viewportWidth}px`,async({page})=>{
    await page.setViewportSize({width:viewportWidth,height:844});await page.goto('/');
    await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
    await page.evaluate(({width,height})=>{
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const paint=()=>{const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgb(30, 190, 90)';ctx.fillRect(0,0,width,height);ctx.fillStyle='rgb(30, 60, 230)';ctx.beginPath();ctx.arc(width/2,height/2,Math.min(width,height)/12,0,Math.PI*2);ctx.fill();};paint();setInterval(paint,100);
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);(window as any).__layoutStream=stream;return stream;}});
    },{width,height});
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    const capture=page.getByRole('button',{name:'Capture barcode',exact:true});await expect(capture).toBeEnabled();
    const dimensions=await page.locator('.camera-preview').evaluate(preview=>{
      const video=preview.querySelector('video')!,guide=preview.querySelector('.scan-guide')!;
      const frame=preview.getBoundingClientRect(),image=video.getBoundingClientRect(),box=guide.getBoundingClientRect();
      return {frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},image:{x:image.x,y:image.y,width:image.width,height:image.height},guide:{x:box.x,y:box.y,width:box.width,height:box.height},native:[video.videoWidth,video.videoHeight],overflow:document.documentElement.scrollWidth>innerWidth,fit:getComputedStyle(video).objectFit,position:getComputedStyle(video).objectPosition};
    });
    expect(dimensions.native).toEqual([width,height]);expect(dimensions.fit).toBe('cover');expect(dimensions.position).toBe('50% 50%');expect(dimensions.overflow).toBe(false);
    expect(Math.abs(dimensions.frame.width/dimensions.frame.height-1.586)).toBeLessThan(.01);expect(dimensions.frame.height).toBeLessThan(240);
    expect(Math.abs(dimensions.image.width-dimensions.frame.width)).toBeLessThan(1);expect(Math.abs(dimensions.image.height-dimensions.frame.height)).toBeLessThan(1);
    const {frame,guide}=dimensions;expect(guide.x).toBeGreaterThan(frame.x);expect(guide.y).toBeGreaterThan(frame.y);
    expect(Math.abs(guide.width/guide.height-1.586)).toBeLessThan(.01);expect(guide.width/frame.width).toBeCloseTo(.92,2);
    expect(guide.x+guide.width).toBeLessThan(frame.x+frame.width);expect(guide.y+guide.height).toBeLessThan(frame.y+frame.height);
    expect(Math.abs(guide.x+guide.width/2-frame.x-frame.width/2)).toBeLessThan(1);expect(Math.abs(guide.y+guide.height/2-frame.y-frame.height/2)).toBeLessThan(1);
    // Sample actual displayed pixels at both sides, outside the guide. The source
    // is synthetic green, so a dark camera-container background cannot pass.
    const screenshot=await page.locator('.camera-preview').screenshot();
    const sides=await page.evaluate(async bytes=>{
      const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);let left=canvas.width,right=0,top=canvas.height,bottom=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(pixels.data[i]<80&&pixels.data[i+1]<100&&pixels.data[i+2]>180){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
      return {edges:[4,canvas.width-5].map(x=>Array.from(ctx.getImageData(x,Math.floor(canvas.height/2),1,1).data)),circle:{width:right-left+1,height:bottom-top+1}};
    },Array.from(screenshot));
    for(const [r,g,b] of sides.edges){expect(g).toBeGreaterThan(90);expect(g).toBeGreaterThan(r*2);expect(g).toBeGreaterThan(b);}
    expect(sides.circle.width).toBeGreaterThan(10);expect(Math.abs(sides.circle.width-sides.circle.height)).toBeLessThanOrEqual(2);
    const button=await capture.boundingBox();expect(button!.height).toBeGreaterThanOrEqual(48);expect(button!.x).toBeGreaterThanOrEqual(0);expect(button!.x+button!.width).toBeLessThanOrEqual(viewportWidth);
    await expect(capture).toBeInViewport();await capture.click();await expect(page.getByRole('alert')).toHaveText('Barcode not recognised. Try again.');await expect(capture).toBeEnabled();
    const cancel=page.getByRole('button',{name:'Cancel scan',exact:true});await expect(cancel).toBeInViewport();await cancel.click();
    expect(await page.evaluate(()=>(window as any).__layoutStream.getTracks().every((track:MediaStreamTrack)=>track.readyState==='ended'))).toBe(true);
  });
}

test('capture, torch, camera selector and cancellation fit a short portrait iPhone viewport',async({page})=>{
  await page.setViewportSize({width:320,height:700});await page.goto('/');
  await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
  await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#eee';ctx.fillRect(0,0,720,1280);setInterval(()=>ctx.fillRect(0,0,720,1280),100);
    (window as any).__layoutConstraints=[];
    Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[{kind:'videoinput',deviceId:'synthetic-rear',label:'Synthetic rear'},{kind:'videoinput',deviceId:'synthetic-front',label:'Synthetic front'}]});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async request=>{
      (window as any).__layoutRequest=request;const stream=canvas.captureStream(10),track=stream.getVideoTracks()[0];
      Object.defineProperty(track,'getCapabilities',{value:()=>({torch:true})});
      Object.defineProperty(track,'applyConstraints',{value:async constraints=>{(window as any).__layoutConstraints.push(constraints);}});return stream;
    }});
  });
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  for(const control of [page.getByRole('button',{name:'Capture barcode',exact:true}),page.getByRole('button',{name:'Turn on torch',exact:true}),page.getByRole('combobox',{name:'Camera',exact:true}),page.getByRole('button',{name:'Cancel scan',exact:true})]){
    await expect(control).toBeInViewport();expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button',{name:'Turn on torch',exact:true}).click();await expect(page.getByRole('button',{name:'Turn off torch',exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Camera',exact:true}).selectOption('synthetic-front');
  await expect.poll(()=>page.evaluate(()=>(window as any).__layoutRequest.video.deviceId?.exact)).toBe('synthetic-front');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
});
