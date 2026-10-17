import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastFrame, frameHint, frameRegion, FrameConfirmation } from '../src/campus-card/live-frame';
import { scannedCard } from '../src/campus-card/model';

test('guide crops preserve source pixels and include horizontal, vertical and full alternatives',()=>{
  assert.deepEqual(frameRegion(1000,1000,'guide'),{x:40,y:220,width:920,height:560});
  assert.deepEqual(frameRegion(1000,1000,'vertical'),{x:220,y:40,width:560,height:920});
  assert.deepEqual(frameRegion(1000,1000,'full'),{x:0,y:0,width:1000,height:1000});
});
test('local contrast preserves resolution and original data while stretching gray bars',()=>{
  const input=new Uint8ClampedArray(8*4);
  for(let i=0;i<8;i++){input.set([i<4?70:140,i<4?70:140,i<4?70:140,255],i*4);}
  const before=input.slice(), output=contrastFrame(input,8,1);
  assert.deepEqual(input,before);assert.equal(output.length,input.length);
  assert.equal(output[0],0);assert.equal(output[16],255);assert.equal(output[3],255);
  const uniform=new Uint8ClampedArray([230,230,230,255]);
  assert.equal(contrastFrame(uniform,1,1)[0],230);
});
test('confirmation requires the same value and format on distinct recent frames',()=>{
  const gate=new FrameConfirmation(), card=scannedCard('00123456789012','TelepenNumeric');
  assert.equal(gate.accept(card,0,1),false);
  assert.equal(gate.accept(card,100,1),false);
  assert.equal(gate.accept(card,300,2),true);
  gate.clear();assert.equal(gate.accept(card,500,3),false);
  assert.equal(gate.accept(card,3001,4),false);
  assert.equal(gate.accept(scannedCard('00998877665544','TelepenNumeric'),3200,5),false);
  assert.equal(gate.accept(scannedCard('00998877665544','Code128'),3300,6),false);
});
test('quality hints distinguish frame movement and flat glare without exposing data',()=>{
  const white=new Uint8ClampedArray([255,255,255,255,255,255,255,255]);
  assert.equal(frameHint(white).hint,'Reduce glare');
  assert.equal(frameHint(white,new Uint8Array([0,0])).hint,'Hold steady');
  assert.equal(frameHint(new Uint8ClampedArray([10,10,10,255,190,190,190,255])).hint,'Move closer');
});
