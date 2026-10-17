import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prepareZXingModule,writeBarcode} from 'zxing-wasm';
prepareZXingModule({overrides:{wasmBinary:readFileSync('node_modules/zxing-wasm/dist/full/zxing_full.wasm'),print:()=>{},printErr:()=>{}}});
const first='00123456789012',second='00123456789012345678';
async function saved(page:Page,value=first){
  await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();
  await page.evaluate(async value=>{
    const {manualCard}=await import('/src/campus-card/model.ts');
    await(await import('/src/campus-card/storage.ts')).cardStorage.save(manualCard(value));
  },value);
  await page.reload();await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();
}
async function camera(page:Page,value=second,blank=false){
  const written=await writeBarcode(value,{format:'TelepenNumeric',scale:3,addQuietZones:true});
  await page.evaluate(async({image,blank})=>{
    const bitmap=new Image();bitmap.src=`data:image/png;base64,${image}`;await bitmap.decode();
    const canvas=document.createElement('canvas');canvas.width=Math.max(640,bitmap.width);canvas.height=480;
    const ctx=canvas.getContext('2d')!;const paint=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);if(!blank)ctx.drawImage(bitmap,0,150);};paint();setInterval(paint,100);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);(window as any).__walletStream=stream;return stream;}});
  },{image:Buffer.from(await written.image!.arrayBuffer()).toString('base64'),blank});
}
async function storedValue(page:Page){return page.evaluate(async()=>(await(await import('/src/campus-card/storage.ts')).cardStorage.load())?.value);}
test('empty wallet presents only the primary scan action with comfortable iOS styling',async({page})=>{
  await page.goto('/');const scan=page.getByRole('button',{name:'Scan barcode',exact:true});await expect(scan).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(1);await expect(page.getByRole('heading')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Enter code manually'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Import barcode photo'})).toHaveCount(0);
  const style=await scan.evaluate(button=>({color:getComputedStyle(button).backgroundColor,height:button.getBoundingClientRect().height}));expect(style.color).toBe('rgb(0, 122, 255)');expect(style.height).toBeGreaterThanOrEqual(48);
  expect(await page.getByLabel('Barcode diagnostics',{exact:true}).evaluate(el=>(el as HTMLDetailsElement).open)).toBe(false);
});
test('valid live scan verifies, saves and displays immediately without preview or save steps',async({page})=>{
  await page.goto('/');await expect(page.getByRole('button',{name:'Scan barcode',exact:true})).toBeVisible();await camera(page);
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();
  expect(await storedValue(page)).toBe(second);await expect(page.getByRole('heading',{name:'Preview your card'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Save card',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__walletStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await page.reload();await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();expect(await storedValue(page)).toBe(second);
});
test('validated replacement becomes the saved barcode automatically',async({page})=>{
  await saved(page);await camera(page);await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();expect(await storedValue(page)).toBe(second);
});
test('cancelling replacement retains the saved card and releases the camera',async({page})=>{
  await saved(page);await camera(page,second,true);await page.getByRole('button',{name:'Scan barcode',exact:true}).click();await expect(page.locator('video')).toBeVisible();
  await page.getByRole('button',{name:'Cancel scan',exact:true}).click();await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();expect(await storedValue(page)).toBe(first);
  expect(await page.evaluate(()=>(window as any).__walletStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('camera permission failure preserves the existing barcode',async({page})=>{
  await saved(page);await page.evaluate(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Synthetic denial','NotAllowedError');}}));
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();await expect(page.getByRole('alert')).toContainText('permission denied');await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();expect(await storedValue(page)).toBe(first);
});
test('generation verification failure cannot replace a saved card',async({page})=>{
  await page.route('**/src/campus-card/barcode.ts*',async route=>{
    const response=await route.fetch();let body=await response.text();
    // Simulate a writer/round-trip failure for only the replacement synthetic value.
    body=body.replace(/export async function verifyBarcode\(card\) \{/,`export async function verifyBarcode(card) { if(card.value === '${second}') throw new Error('Synthetic verification failure');`);
    if(!body.includes('Synthetic verification failure'))throw Error('Verification failure harness did not match');await route.fulfill({response,body});
  });
  await saved(page);await camera(page);await page.getByRole('button',{name:'Scan barcode',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('could not be reproduced accurately');await expect(page.getByRole('img',{name:'Campus card barcode',exact:true})).toBeVisible();expect(await storedValue(page)).toBe(first);
});
test('failed save keeps old card and offers a successful retry',async({page})=>{
  await saved(page);await camera(page);
  await page.evaluate(async()=>{const storage=(await import('/src/campus-card/storage.ts')).cardStorage;const save=storage.save.bind(storage);let failed=false;storage.save=async card=>{if(!failed){failed=true;throw Error('Synthetic write refusal');}return save(card);};});
  await page.getByRole('button',{name:'Scan barcode',exact:true}).click();await expect(page.getByRole('alert')).toContainText('previous card has been kept');expect(await storedValue(page)).toBe(first);
  await page.getByRole('button',{name:'Retry saving card',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);expect(await storedValue(page)).toBe(second);
});
for(const width of [320,375,390])test(`saved barcode keeps quiet zones and aspect ratio on ${width}px iPhone layout`,async({page})=>{
  await page.setViewportSize({width,height:700});await saved(page,second);
  const barcode=page.getByRole('img',{name:'Campus card barcode',exact:true}),button=page.getByRole('button',{name:'Scan barcode',exact:true});
  const bars=await barcode.boundingBox(),scan=await button.boundingBox();expect(scan!.y).toBeGreaterThan(bars!.y+bars!.height);expect(scan!.y+scan!.height).toBeLessThanOrEqual(700);
  expect(Math.abs(bars!.x+bars!.width/2-width/2)).toBeLessThan(1);expect(bars!.x).toBeGreaterThanOrEqual(0);expect(bars!.x+bars!.width).toBeLessThanOrEqual(width);
  const result=await barcode.evaluate(async canvas=>{
    const element=canvas as HTMLCanvasElement,rect=element.getBoundingClientRect(),ctx=element.getContext('2d')!;
    const pixels=ctx.getImageData(0,0,element.width,element.height);let edgeWhite=true;
    for(let y=0;y<element.height;y++)for(const x of [0,1,element.width-2,element.width-1]){const i=(y*element.width+x)*4;if(pixels.data[i]<250||pixels.data[i+1]<250||pixels.data[i+2]<250)edgeWhite=false;}
    const decoded=await(await import('/src/campus-card/barcode.ts')).decodeBarcode(pixels);
    return {aspectError:Math.abs(rect.width/rect.height-element.width/element.height),edgeWhite,value:decoded?.value,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(result.aspectError).toBeLessThan(.02);expect(result.edgeWhite).toBe(true);expect(result.value).toBe(second);expect(result.overflow).toBe(false);
  await expect(page.getByRole('button')).toHaveCount(1);expect(await page.locator('.wallet-main').innerText()).not.toContain(second);
});
