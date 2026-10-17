import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextCaptureDelay,ScanCadence} from '../src/campus-card/capture';
test('initial cadence targets 500ms start to start',()=>{
  for(const elapsed of [0,20,100,400]){assert.equal(elapsed+nextCaptureDelay(elapsed),500);assert.equal(elapsed+new ScanCadence().nextDelay(elapsed),500);}
});
test('consistently fast decoding moves through 3Hz toward 5Hz',()=>{
  const cadence=new ScanCadence();for(let i=0;i<3;i++)assert.equal(cadence.nextDelay(40),460);
  for(let i=0;i<4;i++)assert.equal(cadence.nextDelay(40),260);assert.equal(cadence.nextDelay(40),160);
  assert.equal(cadence.nextDelay(200),300);assert.equal(cadence.nextDelay(40),460);
});
test('slow decoding retries promptly after a bounded UI yield',()=>{
  for(const elapsed of [600,1000,2500]){const delay=new ScanCadence().nextDelay(elapsed);assert.ok(delay>=16&&delay<=100);}
});
