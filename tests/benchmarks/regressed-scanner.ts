import { BarcodeProcessingError, prepareDecoder } from '../../src/campus-card/barcode';
import { decodeLiveFrame } from './regressed-live-decoder';
import { contrastFrame, frameHint, frameRegion, FrameConfirmation, type FrameRegion } from '../../src/campus-card/live-frame';
import { beginDiagnostic, reportDiagnostic } from '../../src/campus-card/diagnostics';
import type { Card } from '../../src/campus-card/model';

export type CameraTools = { torchAvailable: boolean; focusAvailable: boolean; setTorch(on:boolean):Promise<boolean>; focusAt(x:number,y:number):Promise<boolean> };
type PhotoCapabilities = MediaTrackCapabilities & { focusMode?:string[]; exposureMode?:string[]; pointsOfInterest?:unknown; torch?:boolean };
export function cameraError(error: unknown) {
  const name=(error as {name?:string})?.name;
  if (name==='NotAllowedError'||name==='SecurityError') return 'Camera permission denied. Allow camera access in Safari or browser settings and retry.';
  if (name==='NotFoundError') return 'No camera found. Import a barcode photo instead.';
  if (name==='NotReadableError') return 'Camera is busy. Close other camera apps and retry.';
  return 'Camera could not start. Retry or import a barcode photo.';
}
export function startScanner(video:HTMLVideoElement,onCard:(card:Card)=>void,onError:(message:string)=>void,options:{deviceId?:string;onReady?:(tools:CameraTools)=>void;onHint?:(hint:string)=>void}={}):()=>void {
  let closed=false, torchOn=false, stream:MediaStream|undefined, timer:ReturnType<typeof setTimeout>|undefined;
  let tickNumber=0, lastStamp=-1, lockedRegion:FrameRegion|undefined, previousSamples:Uint8Array|undefined;
  const canvas=document.createElement('canvas'), thumbnail=document.createElement('canvas'); thumbnail.width=64; thumbnail.height=48;
  const confirmation=new FrameConfirmation();
  beginDiagnostic();
  const stop=()=>{ closed=true; clearTimeout(timer); confirmation.clear(); previousSamples=undefined; if(torchOn){void stream?.getVideoTracks()[0]?.applyConstraints({advanced:[{torch:false} as MediaTrackConstraintSet]}).catch(()=>{});torchOn=false;} stream?.getTracks().forEach(t=>t.stop()); video.pause(); video.srcObject=null; canvas.width=canvas.height=thumbnail.width=thumbnail.height=0; };
  const fail=(message:string)=>{ stop(); onError(message); };
  void(async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){ reportDiagnostic({scan:'Failed',stage:'Camera',reason:'Camera access requires a secure browser context.'}); fail('Camera needs a secure connection. Use HTTPS on iPhone, or localhost on this computer.'); return; }
    try {
      const selection=options.deviceId?{deviceId:{exact:options.deviceId}}:{facingMode:{ideal:'environment'}};
      try { stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...selection,width:{ideal:2560},height:{ideal:1440},frameRate:{ideal:30,max:30}}}); }
      catch(error){ if((error as {name?:string})?.name!=='OverconstrainedError') throw error; if(closed)return; stream=await navigator.mediaDevices.getUserMedia({audio:false,video:selection}); }
      if(closed){stream.getTracks().forEach(t=>t.stop());return;}
      video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();if(closed)return;
      const track=stream.getVideoTracks()[0];
      let capabilities:PhotoCapabilities={};
      try{capabilities=(track.getCapabilities?.()??{}) as PhotoCapabilities;}catch{/* Older camera implementations can throw despite exposing the method. */}
      const advanced:Record<string,unknown>={};
      if(capabilities.focusMode?.includes('continuous'))advanced.focusMode='continuous';
      if(capabilities.exposureMode?.includes('continuous'))advanced.exposureMode='continuous';
      if(Object.keys(advanced).length){try{await track.applyConstraints({advanced:[advanced as MediaTrackConstraintSet]});}catch{/*Optional device controls must not prevent scanning.*/}}
      if(closed)return;
      const tools:CameraTools={
        torchAvailable:capabilities.torch===true,
        focusAvailable:'pointsOfInterest' in capabilities && !!capabilities.focusMode?.some(mode=>mode==='single-shot'||mode==='continuous'),
        async setTorch(on){if(closed||capabilities.torch!==true)return false;try{await track.applyConstraints({advanced:[{torch:on} as MediaTrackConstraintSet]});torchOn=on&&!closed;return !closed;}catch{return false;}},
        async focusAt(x,y){
          if(closed||!tools.focusAvailable)return false;
          confirmation.clear();
          try{await track.applyConstraints({advanced:[{pointsOfInterest:[{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}],focusMode:capabilities.focusMode?.includes('single-shot')?'single-shot':'continuous'} as MediaTrackConstraintSet]});return !closed;}catch{return false;}
        },
      };
      try{await prepareDecoder();}catch{if(!closed){reportDiagnostic({scan:'Failed',stage:'Decoder',reason:'The barcode decoder could not initialise.'});fail('Barcode reader could not load. Reconnect and reload the app.');}return;}
      if(closed)return; options.onReady?.(tools);
      reportDiagnostic({cameraFrame:`${video.videoWidth} × ${video.videoHeight}`,processing:'Native resolution; no JPEG compression'});
    }catch(error){if(!closed){reportDiagnostic({scan:'Failed',stage:'Camera',reason:cameraError(error)});fail(cameraError(error));}return;}
    const tick=async()=>{
      if(closed)return;
      const started=performance.now();
      try{
        const decodedFrames=video.getVideoPlaybackQuality?.().totalVideoFrames;
        const stamp=decodedFrames&&decodedFrames>0?decodedFrames:video.currentTime;
        if(video.readyState>=2&&video.videoWidth&&stamp!==lastStamp){
          lastStamp=stamp;
          const small=thumbnail.getContext('2d',{willReadFrequently:true})!;small.drawImage(video,0,0,64,48);
          const quality=frameHint(small.getImageData(0,0,64,48).data,previousSamples);previousSamples=quality.samples;
          const region=lockedRegion??(['guide','full','vertical'] as const)[tickNumber++%3];
          const rect=frameRegion(video.videoWidth,video.videoHeight,region);
          canvas.width=rect.width;canvas.height=rect.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);
          const image=ctx.getImageData(0,0,rect.width,rect.height);
          reportDiagnostic({cameraFrame:`${video.videoWidth} × ${video.videoHeight}`,processing:`${region} crop, original pixels`});
          let card=await decodeLiveFrame(image);
          if(closed)return;
          if(!card&&region!=='full'){
            reportDiagnostic({processing:`${region} crop, local grayscale contrast`});
            card=await decodeLiveFrame(new ImageData(contrastFrame(image.data,image.width,image.height),image.width,image.height));
          }
          if(closed)return;
          if(card){
            if(confirmation.accept(card,performance.now(),lastStamp)){stop();onCard(card);return;}
            lockedRegion=region; options.onHint?.('Hold steady');
            reportDiagnostic({reason:'Decoded successfully; waiting for agreement in a second video frame.'});
          }else{lockedRegion=undefined;options.onHint?.(quality.hint);}
        }
      }catch(error){if(!closed){if(!(error instanceof BarcodeProcessingError))reportDiagnostic({scan:'Failed',stage:'Decoder',reason:'Camera frame capture or processing failed before a confirmed decode.'});fail(error instanceof BarcodeProcessingError?error.message:'Could not process the camera frame. Retry scanning or import a photo.');}return;}
      // Decode calls never overlap. Slow devices automatically receive a longer pause.
      if(!closed)timer=setTimeout(()=>void tick(),Math.min(700,Math.max(150,performance.now()-started)));
    };
    if(!closed)void tick();
  })();
  return stop;
}

