import type { Card } from './model';

export type FrameRegion = 'guide' | 'full' | 'vertical';
export function frameRegion(width: number, height: number, region: FrameRegion) {
  const x = region === 'full' ? 0 : Math.round(width * (region === 'guide' ? .04 : .22));
  const y = region === 'full' ? 0 : Math.round(height * (region === 'guide' ? .22 : .04));
  return { x, y, width: Math.max(1, width - 2*x), height: Math.max(1, height - 2*y) };
}

// Local percentile stretching retains resolution and does not alter the original frame.
export function contrastFrame(input: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const output = new Uint8ClampedArray(input.length);
  const tile = 96;
  for (let top = 0; top < height; top += tile) for (let left = 0; left < width; left += tile) {
    const right = Math.min(width, left+tile), bottom = Math.min(height, top+tile);
    const histogram = new Uint32Array(256);
    for (let y=top; y<bottom; y++) for (let x=left; x<right; x++) {
      const i=(y*width+x)*4; histogram[(77*input[i]+150*input[i+1]+29*input[i+2]) >> 8]++;
    }
    const count=(right-left)*(bottom-top);
    let low=0, high=255, sum=0;
    for (let i=0; i<256; i++) { sum+=histogram[i]; if (sum>=count*.05) { low=i; break; } }
    sum=0;
    for (let i=255; i>=0; i--) { sum+=histogram[i]; if (sum>=count*.05) { high=i; break; } }
    for (let y=top; y<bottom; y++) for (let x=left; x<right; x++) {
      const i=(y*width+x)*4, gray=(77*input[i]+150*input[i+1]+29*input[i+2]) >> 8;
      const value=high-low>=24 ? Math.max(0,Math.min(255,Math.round((gray-low)*255/(high-low)))) : gray;
      output[i]=output[i+1]=output[i+2]=value; output[i+3]=255;
    }
  }
  return output;
}

export function frameHint(pixels: Uint8ClampedArray, previous?: Uint8Array) {
  const samples = new Uint8Array(pixels.length/4);
  let motion=0, highlights=0, low=255, high=0;
  for (let i=0;i<samples.length;i++) {
    const j=i*4, value=(77*pixels[j]+150*pixels[j+1]+29*pixels[j+2]) >> 8;
    samples[i]=value; low=Math.min(low,value); high=Math.max(high,value);
    if (value>247) highlights++; if (previous?.length===samples.length) motion+=Math.abs(value-previous[i]);
  }
  const hint = previous && motion/samples.length>18 ? 'Hold steady' : high-low<55 && highlights/samples.length>.25 ? 'Reduce glare' : 'Move closer';
  return { hint, samples };
}

export class FrameConfirmation {
  private previous: { card: Card; time: number; stamp: number } | null = null;
  accept(card: Card, time: number, stamp: number) {
    const p=this.previous;
    const confirmed=!!p && stamp!==p.stamp && time-p.time<=2000 && card.value===p.card.value && card.format===p.card.format && card.symbologyIdentifier===p.card.symbologyIdentifier;
    this.previous={card,time,stamp}; return confirmed;
  }
  clear() { this.previous=null; }
}
