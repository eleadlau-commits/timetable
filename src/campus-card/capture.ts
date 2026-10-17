export type CaptureMethod='Native video frame (PNG)';

// Reuse one canvas. No crop, upscale, lossy compression or native still-photo call.
export async function captureVideoFrame(video:HTMLVideoElement,canvas:HTMLCanvasElement):Promise<Blob>{
  const width=video.videoWidth,height=video.videoHeight;
  if(video.readyState<2||!width||!height||width*height>48000000)throw new Error('Camera frame unavailable.');
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Camera frame unavailable.');
  ctx.drawImage(video,0,0);
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Camera frame unavailable.')),'image/png'));
}

// Start-to-start target: about 1 Hz, less on slow devices; never queue work.
export function nextCaptureDelay(elapsedMs:number){
  return Math.max(150,Math.max(1000,2*elapsedMs)-elapsedMs);
}
