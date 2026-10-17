import {test,expect} from './legacy-ui.fixture';
import type {Page} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { prepareZXingModule, writeBarcode } from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const synthetic='00123456789012';
async function camera(page:Page, effect='normal', text=synthetic) {
  const barcode=await writeBarcode(text,{format:'TelepenNumeric',scale:3,addQuietZones:true});
  if(!barcode.image)throw new Error('Synthetic image unavailable');
  const base64=Buffer.from(await barcode.image.arrayBuffer()).toString('base64');
  await page.evaluate(async({base64,effect})=>{
    const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=effect==='reduced'?640:1280;canvas.height=effect==='reduced'?480:960;
    const ctx=canvas.getContext('2d')!;
    function paint(){
      ctx.fillStyle='#c5beb0';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.save();ctx.translate(canvas.width/2,canvas.height/2);
      if(effect==='rotated')ctx.rotate(Math.PI/2);
      if(effect==='blur')ctx.filter='blur(0.6px)';
      const scale=effect==='reduced'?.85:1;
      ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);ctx.restore();
      if(effect==='shadow'){
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const i=(y*canvas.width+x)*4,factor=.25+.65*x/canvas.width;
          pixels.data[i]*=factor;pixels.data[i+1]*=factor;pixels.data[i+2]*=factor;
        }
        ctx.putImageData(pixels,0,0);
      }
      if(effect==='glare'){
        ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.ellipse(canvas.width/2,canvas.height/2+16,150,13,-.03,0,Math.PI*2);ctx.fill();
      }
    }
    paint();
    (window as any).__replaceBarcode=async(base64:string)=>{image.src=`data:image/png;base64,${base64}`;await image.decode();paint();};
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      const stream=canvas.captureStream(effect==='single'?0:10);
      (window as any).__stream=stream;
      (window as any).__nextFrame=()=>{paint();stream.getVideoTracks()[0].requestFrame();};
      if(effect!=='single')setInterval(paint,100);
      else setTimeout(()=>{paint();stream.getVideoTracks()[0].requestFrame();},300);
      return stream;
    }});
  },{base64,effect});
}
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();});

for(const effect of ['rotated','reduced','shadow','glare','blur']){
  test(`live Telepen handles synthetic ${effect} and saves the exact value`,async({page})=>{
    await camera(page,effect);
    await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Save card',exact:true}).click();
    await expect(page.getByRole('button',{name:'Full-screen barcode',exact:true})).toBeVisible();
    const result=await page.evaluate(async()=>{
      const saved=await(await import('/src/campus-card/storage.ts')).cardStorage.load();
      return {value:saved?.value,format:saved?.format,variant:saved?.symbologyIdentifier};
    });
    expect(result).toEqual({value:synthetic,format:'TelepenNumeric',variant:']B1'});
  });
}

test('an ambiguous Alpha/Numeric interpretation is rejected rather than converted',async({page})=>{
  await camera(page,'normal','12345678901234');
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.getByLabel('Barcode diagnostics',{exact:true})).toContainText('no conversion was attempted');
  await expect(page.getByLabel('Barcode diagnostics',{exact:true}).locator('dt').filter({hasText:'Telepen candidate (latest frame)'}).locator('+ dd')).toHaveText('Rejected');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(()=> (window as any).__stream.getVideoTracks()[0].readyState)).toBe('live');
  await expect(page.getByRole('button',{name:'Save card',exact:true})).toHaveCount(0);
  const next=await writeBarcode(synthetic,{format:'TelepenNumeric',scale:3,addQuietZones:true});
  const base64=Buffer.from(await next.image!.arrayBuffer()).toString('base64');
  await page.evaluate(base64=>(window as any).__replaceBarcode(base64),base64);
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  const saved=await page.evaluate(async()=> (await (await import('/src/campus-card/storage.ts')).cardStorage.load())?.format);
  expect(saved).toBe('TelepenNumeric');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Barcode diagnostics',{exact:true})).toContainText('no conversion was attempted');
});

test('one checksum-valid video frame promptly reaches preview without a second-frame gate',async({page})=>{
  await camera(page,'single');
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Preview your card'})).toBeVisible();
  // Read the rendered diagnostics, avoiding a second module instance after Vite HMR.
  const panel=page.getByLabel('Barcode diagnostics',{exact:true});
  await expect(panel.locator('dt').filter({hasText:/^Processed frames \/ second$/}).locator('+ dd')).toContainText('(1 frames)');
  await expect(panel.locator('dt').filter({hasText:/^Reader attempts per frame average \/ maximum$/}).locator('+ dd')).toHaveText('1.0 / 1');
});

async function blankCamera(page:Page, capabilities:Record<string,unknown>, rejectControls=false, rejectResolution=false){
  await page.evaluate(({capabilities,rejectControls,rejectResolution})=>{
    (window as any).__applied=[];(window as any).__requests=[];
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async constraints=>{
      (window as any).__requests.push(constraints);
      if(rejectResolution&&constraints.video.width)throw new DOMException('Synthetic resolution refusal','OverconstrainedError');
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,640,480);
      const stream=canvas.captureStream(10);setInterval(()=>ctx.fillRect(0,0,640,480),100);
      const track=stream.getVideoTracks()[0];
      Object.defineProperty(track,'getCapabilities',{value:()=>capabilities});
      Object.defineProperty(track,'applyConstraints',{value:async constraints=>{
        (window as any).__applied.push(constraints);
        if(rejectControls)throw new DOMException('Synthetic control refusal','OverconstrainedError');
      }});
      (window as any).__stream=stream;return stream;
    }});
  },{capabilities,rejectControls,rejectResolution});
}

test('supported focus and torch are retained without forcing exposure and are cleaned up',async({page})=>{
  await blankCamera(page,{focusMode:['continuous','single-shot'],exposureMode:['continuous'],pointsOfInterest:[],torch:true});
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await page.getByRole('button',{name:'Turn on torch',exact:true}).click();
  await expect(page.getByRole('button',{name:'Turn off torch',exact:true})).toBeVisible();
  await page.locator('video').click();
  const applied=await page.evaluate(()=> (window as any).__applied.flatMap((x:any)=>x.advanced));
  expect(applied.some((x:any)=>x.focusMode==='continuous')).toBe(true);
  expect(applied.some((x:any)=>x.exposureMode!==undefined)).toBe(false);
  expect(applied.some((x:any)=>x.torch===true)).toBe(true);
  const point=applied.find((x:any)=>x.pointsOfInterest)?.pointsOfInterest[0];
  expect(point).toBeDefined();
  expect(point.x).toBeCloseTo(.5,1);
  expect(point.y).toBeCloseTo(.5,1);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
  expect(await page.evaluate(()=> (window as any).__stream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  expect(await page.evaluate(()=> (window as any).__applied.some((x:any)=>x.advanced.some((a:any)=>a.torch===false)))).toBe(true);
});

test('unsupported controls stay hidden and high-resolution refusal has a safe fallback',async({page})=>{
  await blankCamera(page,{},false,true);
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.locator('video')).toBeVisible();
  await expect(page.getByRole('button',{name:'Turn on torch',exact:true})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=> (window as any).__requests.some((x:any)=>!x.video.width))).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
});

test('optional camera control rejection never prevents preview or cancellation',async({page})=>{
  await blankCamera(page,{focusMode:['continuous'],pointsOfInterest:[],torch:true},true);
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await page.getByRole('button',{name:'Turn on torch',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();
});
