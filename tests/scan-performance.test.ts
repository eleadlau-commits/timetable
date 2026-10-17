import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScanPerformance} from '../src/campus-card/scan-performance';

test('performance aggregation counts attempts, failures and rejections and throttles publication',()=>{
  const metrics=new ScanPerformance(0);
  metrics.record(20,1,false);
  assert.deepEqual(metrics.snapshot(200),{frames:1,fps:5,averageMs:20,maxMs:20,attemptsPerFrame:1,maxAttempts:1,successes:0,failures:1,telepenRejections:0});
  metrics.record(40,2,false,true);
  assert.equal(metrics.snapshot(500),undefined);
  metrics.record(15,1,true);
  const final=metrics.snapshot(1000,true)!;
  assert.equal(final.frames,3);assert.equal(final.fps,3);
  assert.equal(final.averageMs,25);assert.equal(final.maxMs,40);
  assert.equal(final.attemptsPerFrame,4/3);assert.equal(final.maxAttempts,2);
  assert.equal(final.successes,1);assert.equal(final.failures,2);assert.equal(final.telepenRejections,1);
});
