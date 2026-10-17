import { BarcodeProcessingError, decodePhoto, prepareDecoder } from './barcode';
import { capturePhoto } from './capture';
import { decodeLiveFrame, TelepenFrameRejection } from './live-decoder';
import { ScanPerformance } from './scan-performance';
import { cameraDiagnostics } from './camera-diagnostics';
import { beginDiagnostic, diagnosticSnapshot, reportDiagnostic } from './diagnostics';
import type { Card } from './model';

export type CameraTools = { torchAvailable: boolean; focusAvailable: boolean; setTorch(on:boolean):Promise<boolean>; focusAt(x:number,y:number):Promise<boolean>; captureBarcode():Promise<void> };
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
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  let metrics:ScanPerformance|undefined;
  let focusRequest='Not advertised';
  let capturing=false,afterCaptureFailure=false,activeFrame:Promise<void>|undefined;
  let resume=()=>{};
  beginDiagnostic();
  const stop=()=>{ if(!closed&&metrics){const stats=metrics.snapshot(performance.now(),true);if(stats)reportDiagnostic({performance:stats});} closed=true; clearTimeout(timer); if(torchOn){void stream?.getVideoTracks()[0]?.applyConstraints({advanced:[{torch:false} as MediaTrackConstraintSet]}).catch(()=>{});torchOn=false;} stream?.getTracks().forEach(t=>t.stop()); video.pause(); video.srcObject=null; canvas.width=canvas.height=0; };
  const fail=(message:string)=>{ stop(); onError(message); };
  void(async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){ reportDiagnostic({scan:'Failed',stage:'Camera',reason:'Camera access requires a secure browser context.'}); fail('Camera needs a secure connection. Use HTTPS on iPhone, or localhost on this computer.'); return; }
    try {
      const selection=options.deviceId?{deviceId:{exact:options.deviceId}}:{facingMode:{ideal:'environment'}};
      try { stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...selection,width:{ideal:1920},height:{ideal:1080}}}); }
      catch(error){ if((error as {name?:string})?.name!=='OverconstrainedError') throw error; if(closed)return; stream=await navigator.mediaDevices.getUserMedia({audio:false,video:selection}); }
      if(closed){stream.getTracks().forEach(t=>t.stop());return;}
      video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();if(closed)return;
      const track=stream.getVideoTracks()[0];
      let capabilities:PhotoCapabilities={};
      try{capabilities=(track.getCapabilities?.()??{}) as PhotoCapabilities;}catch{/* Older camera implementations can throw despite exposing the method. */}
      const advanced:Record<string,unknown>={};
      if(capabilities.focusMode?.includes('continuous'))advanced.focusMode='continuous';
      if(Object.keys(advanced).length){try{await track.applyConstraints({advanced:[advanced as MediaTrackConstraintSet]});focusRequest='Applied';}catch{focusRequest='Refused';/*Optional device controls must not prevent scanning.*/}}
      if(closed)return;
      const tools:CameraTools={
        async captureBarcode(){
          if(closed||capturing)return;
          capturing=true;clearTimeout(timer);
          try{
            await activeFrame;
            if(closed)return;
            beginDiagnostic();reportDiagnostic({captureStatus:'Capturing',captureDecoderInvoked:false});
            const captured=await capturePhoto(video,track);
            if(closed)return;
            const card=await decodePhoto(captured.blob,captured.method,()=>closed);
            if(closed)return;
            stop();onCard(card);
          }catch{
            if(closed)return;
            afterCaptureFailure=true;
            if(import.meta.env.DEV){const diagnostic=diagnosticSnapshot();reportDiagnostic({captureStatus:'Failed',captureFormat:diagnostic.format,captureVariant:diagnostic.variant,captureReason:diagnostic.captureDecoderInvoked?diagnostic.reason:'Camera still image could not be opened or captured.'});}
            throw new Error('Barcode not recognised. Try again.');
          }finally{capturing=false;if(!closed)resume();}
        },
        torchAvailable:capabilities.torch===true,
        focusAvailable:'pointsOfInterest' in capabilities && !!capabilities.focusMode?.some(mode=>mode==='single-shot'||mode==='continuous'),
        async setTorch(on){if(closed||capabilities.torch!==true)return false;try{await track.applyConstraints({advanced:[{torch:on} as MediaTrackConstraintSet]});torchOn=on&&!closed;return !closed;}catch{return false;}},
        async focusAt(x,y){
          if(closed||!tools.focusAvailable)return false;
          try{await track.applyConstraints({advanced:[{pointsOfInterest:[{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}],focusMode:capabilities.focusMode?.includes('single-shot')?'single-shot':'continuous'} as MediaTrackConstraintSet]});return !closed;}catch{return false;}
        },
      };
      try{await prepareDecoder();}catch{if(!closed){reportDiagnostic({scan:'Failed',stage:'Decoder',reason:'The barcode decoder could not initialise.'});fail('Barcode reader could not load. Reconnect and reload the app.');}return;}
      if(closed)return; options.onReady?.(tools);
      reportDiagnostic({cameraFrame:`${video.videoWidth} × ${video.videoHeight}`,processing:'Full frame, original pixels; no preprocessing'});
      if(import.meta.env.DEV){metrics=new ScanPerformance(performance.now());reportDiagnostic(cameraDiagnostics(video,track,focusRequest));}
    }catch(error){if(!closed){reportDiagnostic({scan:'Failed',stage:'Camera',reason:cameraError(error)});fail(cameraError(error));}return;}
    const tick=async()=>{
      if(closed||capturing)return;
      try{
        // Playback statistics are optional telemetry, not a frame-delivery signal.
        // Some implementations can report the same count while video pixels change.
        if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
          if(canvas.width!==video.videoWidth)canvas.width=video.videoWidth;
          if(canvas.height!==video.videoHeight)canvas.height=video.videoHeight;
          ctx.drawImage(video,0,0);
          const image=ctx.getImageData(0,0,canvas.width,canvas.height);
          let attempts=0;
          const started=metrics?performance.now():0;
          let card:Card|null=null, rejected=false;
          try{card=await decodeLiveFrame(image,metrics?()=>{attempts++;}:undefined);}
          catch(error){
            if(!(error instanceof TelepenFrameRejection)){
              metrics?.record(performance.now()-started,attempts,false);
              throw error;
            }
            // A provisional interpretation must not terminate the live session.
            rejected=true;
            reportDiagnostic({telepenRejection:'Automatic Alpha also has a valid known Numeric profile; no conversion was attempted.'});
          }
          if(closed)return;
          if(import.meta.env.DEV&&metrics){
            metrics.record(performance.now()-started,attempts,!!card,rejected);
            const performanceStats=metrics.snapshot(performance.now(),!!card);
            if(performanceStats)reportDiagnostic({performance:performanceStats,...cameraDiagnostics(video,stream!.getVideoTracks()[0],focusRequest)});
          }
          if(card){stop();onCard(card);return;}
          options.onHint?.('Hold steady');
        }
      }catch(error){
        // After a failed manual capture, an unreadable/unsupported live frame must
        // not dismiss the camera while the user is adjusting the same card.
        if(!closed&&afterCaptureFailure&&error instanceof BarcodeProcessingError){resume();return;}
        if(!closed){if(!(error instanceof BarcodeProcessingError))reportDiagnostic({scan:'Failed',stage:'Decoder',reason:'Camera frame capture or processing failed before a confirmed decode.'});fail(error instanceof BarcodeProcessingError?error.message:'Could not process the camera frame. Retry scanning or import a photo.');}return;
      }
      // Schedule only after decoding completes; one reader job at a time.
      resume();
    };
    resume=()=>{if(!closed&&!capturing)timer=setTimeout(()=>{activeFrame=tick();},150);};
    if(!closed)activeFrame=tick();
  })();
  return stop;
}
