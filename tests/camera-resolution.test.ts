import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraResolution} from '../src/campus-card/camera-resolution';
function rig(mode:'supported'|'joint-refusal'|'ignored'|'video-mismatch'='supported'){
  const video={videoWidth:1920,videoHeight:1080};let settings={width:1920,height:1080};const calls:number[][]=[];
  const track={getSettings:()=>settings,async applyConstraints(c:MediaTrackConstraints){
    const width=(c.width as ConstrainULongRange).exact!,height=(c.height as ConstrainULongRange).exact!;calls.push([width,height]);
    if(mode==='joint-refusal'&&width>1920)throw new Error('Unsupported pair');
    if(mode==='ignored')return;
    settings={width,height};if(mode!=='video-mismatch'||width===1920){video.videoWidth=width;video.videoHeight=height;}
  }} as MediaStreamTrack;
  return {video,track,calls,resolution:new CameraResolution(video,track,()=>false)};
}
const caps={width:{min:320,max:3840},height:{min:240,max:2160}};
test('highest actual pair is verified against settings and video',async()=>{
  const r=rig();await r.resolution.negotiate(caps);assert.deepEqual(r.calls,[[3840,2160]]);assert.equal(r.video.videoWidth,3840);
});
test('independent maxima do not imply a supported pair',async()=>{
  const r=rig('joint-refusal');await r.resolution.negotiate(caps);assert.equal(r.video.videoWidth,1920);assert.equal(r.calls.length,2);
});
test('ignored constraints cannot masquerade as higher resolution',async()=>{
  const r=rig('ignored');await r.resolution.negotiate(caps);assert.equal(r.video.videoWidth,1920);assert.ok(r.resolution.attempts.every(x=>x.includes('settings mismatch')));
});
test('settings without matching video dimensions are rejected and original mode restored',async()=>{
  const r=rig('video-mismatch');await r.resolution.negotiate(caps);assert.equal(r.track.getSettings().width,1920);assert.ok(r.resolution.attempts.some(x=>x.includes('video mismatch')));
});
test('sustained excessive latency reduces real camera resolution once',async()=>{
  const r=rig();await r.resolution.negotiate(caps);await r.resolution.observe(700);await r.resolution.observe(700);assert.equal(r.video.videoWidth,3840);
  await r.resolution.observe(700);assert.equal(r.video.videoWidth,2560);const count=r.calls.length;for(let i=0;i<10;i++)await r.resolution.observe(900);assert.equal(r.calls.length,count);
});
test('cancelled negotiation applies no constraints',async()=>{
  const r=rig();await new CameraResolution(r.video,r.track,()=>true).negotiate(caps);assert.equal(r.calls.length,0);
});
