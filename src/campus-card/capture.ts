export type CaptureMethod='Native video pixels';

// Reuse one canvas. No crop, upscale, lossy compression or native still-photo call.
export function captureVideoFrame(video:HTMLVideoElement,canvas:HTMLCanvasElement):ImageData{
  const width=video.videoWidth,height=video.videoHeight;
  if(video.readyState<2||!width||!height||width*height>48000000)throw new Error('Camera frame unavailable.');
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Camera frame unavailable.');
  ctx.drawImage(video,0,0);
  return ctx.getImageData(0,0,width,height);
}

// Start-to-start target, not an extra wait after the reader finishes.
export function nextCaptureDelay(elapsedMs:number){
  return Math.max(16,500-elapsedMs);
}

export class ScanCadence{
  private fast=0;
  nextDelay(elapsedMs:number){
    this.fast=elapsedMs<100?this.fast+1:0;
    const target=this.fast>=8?200:this.fast>=4?300:500;
    return elapsedMs>=target?Math.min(100,Math.max(16,elapsedMs/10)):target-elapsedMs;
  }
}
