import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextCaptureDelay} from '../src/campus-card/capture';
test('automatic cadence targets one second start-to-start on responsive devices',()=>{
  for(const elapsed of [0,20,100,400,500])assert.equal(elapsed+nextCaptureDelay(elapsed),1000);
});
test('slow decoding increases the interval without creating concurrent work',()=>{
  for(const elapsed of [600,1000,2500]){assert.equal(nextCaptureDelay(elapsed),elapsed);assert.equal(elapsed+nextCaptureDelay(elapsed),2*elapsed);}
});
