export type CaptureMethod='ImageCapture.takePhoto'|'Native video frame (PNG)';
type StillCamera={takePhoto(settings?:{imageWidth?:number;imageHeight?:number}):Promise<Blob>;getPhotoCapabilities?():Promise<{imageWidth?:{max:number};imageHeight?:{max:number}}>};
type CaptureWindow=Window & {ImageCapture?:new(track:MediaStreamTrack)=>StillCamera};

// User-triggered only. Never changes the running camera constraints.
export async function capturePhoto(video:HTMLVideoElement,track:MediaStreamTrack):Promise<{blob:Blob;method:CaptureMethod}>{
  const Constructor=(window as CaptureWindow).ImageCapture;
  if(Constructor){
    try{
      const camera=new Constructor(track);
      if(typeof camera.takePhoto==='function'){
        let settings:{imageWidth:number;imageHeight:number}|undefined;
        try{
          const caps=await camera.getPhotoCapabilities?.();
          const width=caps?.imageWidth?.max,height=caps?.imageHeight?.max;
          if(width&&height&&width>0&&height>0&&Number.isFinite(width)&&Number.isFinite(height)&&width*height<=48000000)settings={imageWidth:width,imageHeight:height};
        }catch{/* Default photo settings can still be used. */}
        const blob=await camera.takePhoto(settings);
        if(blob.size>0&&blob.size<=25*1024*1024)return {blob,method:'ImageCapture.takePhoto'};
      }
    }catch{/* Unsupported native still capture falls back to the active video. */}
  }
  if(video.readyState<2||!video.videoWidth||!video.videoHeight||video.videoWidth*video.videoHeight>48000000)throw new Error('Camera frame unavailable.');
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  try{
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Camera frame unavailable.');
    ctx.drawImage(video,0,0);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Camera frame unavailable.')),'image/png'));
    return {blob,method:'Native video frame (PNG)'};
  }finally{canvas.width=canvas.height=0;}
}
