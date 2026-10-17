type Size={width:number;height:number};
const modes:Size[]=[{width:3840,height:2160},{width:2560,height:1440},{width:1920,height:1080},{width:1280,height:720}];
// Probe real pairs, not the Cartesian product of independent capability maxima.
export class CameraResolution{
  readonly attempts:string[]=[];
  private slow=0;
  private reduced=false;
  constructor(private video:Pick<HTMLVideoElement,'videoWidth'|'videoHeight'>,private track:MediaStreamTrack,private cancelled:()=>boolean){}
  private async apply(size:Size){
    if(this.cancelled())return false;
    try{await this.track.applyConstraints({width:{exact:size.width},height:{exact:size.height}});}catch{this.attempts.push(`${size.width} × ${size.height}: refused`);return false;}
    const settings=this.track.getSettings();
    if(settings.width!==size.width||settings.height!==size.height){this.attempts.push(`${size.width} × ${size.height}: settings mismatch`);return false;}
    for(let count=0;count<10&&!this.cancelled();count++){
      if(this.video.videoWidth===size.width&&this.video.videoHeight===size.height){this.attempts.push(`${size.width} × ${size.height}: verified`);return true;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    this.attempts.push(`${size.width} × ${size.height}: video mismatch`);return false;
  }
  async negotiate(capabilities:MediaTrackCapabilities){
    const original={width:this.video.videoWidth,height:this.video.videoHeight};
    if(!capabilities.width||!capabilities.height)return;
    for(const size of modes){
      if(size.width*size.height<=original.width*original.height)continue;
      if(size.width>(capabilities.width.max??0)||size.height>(capabilities.height.max??0))continue;
      if(await this.apply(size))return;
      if(this.cancelled())return;
    }
    const settings=this.track.getSettings();
    if(settings.width!==original.width||settings.height!==original.height||this.video.videoWidth!==original.width||this.video.videoHeight!==original.height)await this.apply(original);
  }
  async observe(elapsedMs:number){
    this.slow=elapsedMs>650?this.slow+1:0;
    if(this.reduced||this.slow<3||this.cancelled())return;
    this.reduced=true;
    const original={width:this.video.videoWidth,height:this.video.videoHeight};
    for(const size of modes){if(size.width*size.height<original.width*original.height&&await this.apply(size))return;}
    if(!this.cancelled())await this.apply(original);
  }
}
