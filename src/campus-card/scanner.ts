import { decodePixels, prepareDecoder } from './barcode';
import { captureVideoFrame, ScanCadence } from './capture';
import { CameraResolution } from './camera-resolution';
import { validateLiveInterpretation, TelepenFrameRejection } from './live-decoder';
import { ScanPerformance } from './scan-performance';
import { cameraDiagnostics } from './camera-diagnostics';
import { beginDiagnostic, diagnosticSnapshot, reportDiagnostic } from './diagnostics';
import type { Card } from './model';

export type CameraTools={torchAvailable:boolean;focusAvailable:boolean;setTorch(on:boolean):Promise<boolean>;focusAt(x:number,y:number):Promise<boolean>};
type PhotoCapabilities=MediaTrackCapabilities & {focusMode?:string[];pointsOfInterest?:unknown;torch?:boolean};
export function cameraError(error:unknown){
  const name=(error as {name?:string})?.name;
  if(name==='NotAllowedError'||name==='SecurityError')return 'Camera permission denied. Allow camera access in Safari or browser settings and retry.';
  if(name==='NotFoundError')return 'No camera found. Import a barcode photo instead.';
  if(name==='NotReadableError')return 'Camera is busy. Close other camera apps and retry.';
  return 'Camera could not start. Retry or import a barcode photo.';
}
export function startScanner(video:HTMLVideoElement,onCard:(card:Card)=>void,onError:(message:string)=>void,options:{deviceId?:string;onReady?:(tools:CameraTools)=>void}={}):()=>void{
  let closed=false,torchOn=false,stream:MediaStream|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const canvas=document.createElement('canvas');
  let metrics:ScanPerformance|undefined,focusRequest='Not advertised',capabilities:PhotoCapabilities={};
  let captures=0,firstCaptureAt:number|undefined;
  let captured=0,captureTotal=0,captureMax=0,resolution:CameraResolution|undefined;
  const cadence=new ScanCadence();
  beginDiagnostic();
  const stop=()=>{
    if(!closed&&metrics){const stats=metrics.snapshot(performance.now(),true);if(stats)reportDiagnostic({performance:stats});}
    closed=true;clearTimeout(timer);
    reportDiagnostic({scanningActive:false});
    if(torchOn){void stream?.getVideoTracks()[0]?.applyConstraints({advanced:[{torch:false} as MediaTrackConstraintSet]}).catch(()=>{});torchOn=false;}
    stream?.getTracks().forEach(track=>track.stop());video.pause();video.srcObject=null;canvas.width=canvas.height=0;
  };
  const fail=(message:string)=>{stop();onError(message);};
  void(async()=>{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){reportDiagnostic({scan:'Failed',stage:'Camera',reason:'Camera access requires a secure browser context.'});fail('Camera needs a secure connection. Use HTTPS on iPhone, or localhost on this computer.');return;}
    try{
      const selection=options.deviceId?{deviceId:{exact:options.deviceId}}:{facingMode:{ideal:'environment'}};
      try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...selection,width:{ideal:1920},height:{ideal:1080}}});}
      catch(error){if((error as {name?:string})?.name!=='OverconstrainedError')throw error;if(closed)return;stream=await navigator.mediaDevices.getUserMedia({audio:false,video:selection});}
      if(closed){stream.getTracks().forEach(track=>track.stop());return;}
      video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();if(closed)return;
      const track=stream.getVideoTracks()[0];
      try{capabilities=(track.getCapabilities?.()??{}) as PhotoCapabilities;}catch{/* Optional metadata is not required for scanning. */}
      if(capabilities.focusMode?.includes('continuous')){
        try{await track.applyConstraints({advanced:[{focusMode:'continuous'} as MediaTrackConstraintSet]});focusRequest='Applied';}catch{focusRequest='Refused';}
      }
      if(closed)return;
      resolution=new CameraResolution(video,track,()=>closed);
      await resolution.negotiate(capabilities);
      if(closed)return;
      const tools:CameraTools={
        torchAvailable:capabilities.torch===true,
        focusAvailable:'pointsOfInterest' in capabilities&&!!capabilities.focusMode?.some(mode=>mode==='single-shot'||mode==='continuous'),
        async setTorch(on){if(closed||capabilities.torch!==true)return false;try{await track.applyConstraints({advanced:[{torch:on} as MediaTrackConstraintSet]});torchOn=on&&!closed;return !closed;}catch{return false;}},
        async focusAt(x,y){if(closed||!tools.focusAvailable)return false;try{await track.applyConstraints({advanced:[{pointsOfInterest:[{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}],focusMode:capabilities.focusMode?.includes('single-shot')?'single-shot':'continuous'} as MediaTrackConstraintSet]});return !closed;}catch{return false;}},
      };
      try{await prepareDecoder();}catch{if(!closed){reportDiagnostic({scan:'Failed',stage:'Decoder',reason:'The barcode decoder could not initialise.'});fail('Barcode reader could not load. Reconnect and reload the app.');}return;}
      if(closed)return;
      if(import.meta.env.DEV){metrics=new ScanPerformance(performance.now());reportDiagnostic({scanningActive:true,resolutionProbe:resolution.attempts.join('; ')||'No higher mode advertised',...cameraDiagnostics(video,track,focusRequest,capabilities),processing:'Native full-frame ImageData → shared decodePixels; no PNG or resize'});}
      options.onReady?.(tools);
    }catch(error){if(!closed){reportDiagnostic({scan:'Failed',stage:'Camera',reason:cameraError(error)});fail(cameraError(error));}return;}

    const tick=async()=>{
      if(closed)return;
      const started=performance.now();
      if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
        let attempts=0,decodeMs=0,captureMs=0,rejected=false,card:Card|null=null;
        if(import.meta.env.DEV){
          captures++;firstCaptureAt??=started;
          reportDiagnostic({captureAttempts:captures,scanFrequency:captures>1?(captures-1)*1000/(started-firstCaptureAt):undefined,captureStatus:'Capturing',captureMethod:'Native video pixels',captureFrame:`${video.videoWidth} × ${video.videoHeight}`,captureDecoderInvoked:false,photoPipelineInvoked:false,captureReason:'Pending',captureFormat:'Not detected',captureVariant:'Not detected',format:'Not detected',variant:'Not detected',telepenCandidate:'Not detected',scan:'Scanning',stage:'Camera',reason:'Capturing a native video frame.'});
        }
        try{
          const pixels=captureVideoFrame(video,canvas);
          if(closed)return;
          captureMs=performance.now()-started;
          captured++;captureTotal+=captureMs;captureMax=Math.max(captureMax,captureMs);
          const decodeStarted=performance.now();
          try{
            if(import.meta.env.DEV)reportDiagnostic({captureDecoderInvoked:true,captureStatus:'Decoding'});
            card=await decodePixels(pixels,'scan',{
              isCancelled:()=>closed,
              onDecode:import.meta.env.DEV?()=>{attempts++;}:undefined,
              validateResult:(image,result)=>validateLiveInterpretation(image,result,import.meta.env.DEV?()=>{attempts++;}:undefined),
            });
          }finally{decodeMs=performance.now()-decodeStarted;}
        }catch(error){
          if(closed)return;
          rejected=error instanceof TelepenFrameRejection;
          if(import.meta.env.DEV){
            const diagnostic=diagnosticSnapshot();
            reportDiagnostic({framesRejected:true,...(!diagnostic.captureDecoderInvoked?{recognition:'Capture or processing failure' as const}:{}),captureStatus:'Failed',captureFormat:diagnostic.format,captureVariant:diagnostic.variant,captureReason:diagnostic.captureDecoderInvoked?diagnostic.reason:'Frame capture failed; another frame will be attempted.',...(rejected?{recognition:'Telepen ambiguity' as const,telepenRejection:'Automatic Alpha also has a valid known Numeric profile; no conversion was attempted.'}:{})});
          }
        }
        if(closed)return;
        if(import.meta.env.DEV&&metrics){
          metrics.record(decodeMs,attempts,!!card,rejected);
          const stats=metrics.snapshot(performance.now(),true);
          reportDiagnostic({performance:stats,framesCaptured:captured,captureAverageMs:captured?captureTotal/captured:0,captureMaxMs:captureMax,captureTimeMs:captureMs||performance.now()-started,...cameraDiagnostics(video,stream!.getVideoTracks()[0],focusRequest,capabilities)});
        }
        if(card){reportDiagnostic({captureStatus:'Succeeded',captureFormat:card.format,captureVariant:card.symbologyIdentifier,captureReason:'None'});stop();onCard(card);return;}
        await resolution?.observe(performance.now()-started);
        if(import.meta.env.DEV)reportDiagnostic({resolutionProbe:resolution?.attempts.join('; ')||'No higher mode advertised'});
      }
      // One awaited capture/decode; retries (including failures) cannot form a queue.
      if(!closed)timer=setTimeout(()=>void tick(),cadence.nextDelay(performance.now()-started));
    };
    if(!closed)void tick();
  })();
  return stop;
}
