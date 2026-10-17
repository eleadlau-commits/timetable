import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraDiagnostics} from '../src/campus-card/camera-diagnostics';

test('camera telemetry distinguishes requested, negotiated and actual frame dimensions without IDs',()=>{
  const track={getSettings:()=>({width:640,height:480,focusMode:'continuous',exposureMode:'manual',deviceId:'PRIVATE-DEVICE',groupId:'PRIVATE-GROUP'})} as unknown as MediaStreamTrack;
  const result=cameraDiagnostics({videoWidth:1280,videoHeight:720},track,'Applied');
  assert.equal(result.cameraFrame,'1280 × 720');assert.equal(result.cameraTrack,'640 × 480');
  assert.equal(result.cameraRequest,'1920 × 1080 (ideal, not guaranteed)');
  assert.equal(result.cameraFocus,'continuous; continuous-focus request: Applied');
  assert.equal(result.cameraExposure,'manual');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('camera telemetry is tolerant of missing or throwing optional settings and rejects arbitrary mode strings',()=>{
  const missing={getSettings:()=>{throw Error('Unavailable');}} as unknown as MediaStreamTrack;
  assert.equal(cameraDiagnostics({videoWidth:0,videoHeight:0},missing,'Not advertised').cameraFrame,'Not reported');
  const unknown={getSettings:()=>({focusMode:'PRIVATE',exposureMode:'PRIVATE'})} as unknown as MediaStreamTrack;
  assert.ok(!JSON.stringify(cameraDiagnostics({videoWidth:640,videoHeight:480},unknown,'Refused')).includes('PRIVATE'));
});

test('camera capabilities report independent ranges without claiming a joint supported mode',()=>{
  const track={getSettings:()=>({width:1920,height:1080})} as MediaStreamTrack;
  const result=cameraDiagnostics({videoWidth:1920,videoHeight:1080},track,'Not advertised',{width:{min:320,max:3840},height:{min:240,max:2160}});
  assert.equal(result.cameraCapabilities,'Width 320..3840; height 240..2160 (independent min/max ranges)');
});
