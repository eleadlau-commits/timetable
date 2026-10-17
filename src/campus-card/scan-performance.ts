// Aggregate metadata only: never accepts an image, credential or decoder payload.
export class ScanPerformance {
  private frames=0;
  private successes=0;
  private failures=0;
  private attempts=0;
  private maxAttempts=0;
  private totalMs=0;
  private maxMs=0;
  private lastPublished=-Infinity;
  private rejections=0;
  constructor(private started:number) {}
  record(decodeMs:number, attempts:number, success:boolean, rejected=false) {
    this.frames++; this.successes+=Number(success); this.failures+=Number(!success);
    this.attempts+=attempts; this.maxAttempts=Math.max(this.maxAttempts,attempts);
    this.totalMs+=decodeMs; this.maxMs=Math.max(this.maxMs,decodeMs);
    this.rejections+=Number(rejected);
  }
  snapshot(now:number, force=false) {
    if (!force && now-this.lastPublished<1000) return undefined;
    this.lastPublished=now;
    return {frames:this.frames, fps:this.frames/Math.max(.001,(now-this.started)/1000),
      averageMs:this.totalMs/Math.max(1,this.frames), maxMs:this.maxMs,
      attemptsPerFrame:this.attempts/Math.max(1,this.frames), maxAttempts:this.maxAttempts,
      successes:this.successes, failures:this.failures, telepenRejections:this.rejections};
  }
}
