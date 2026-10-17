// Read only diagnostic metadata. Never return camera labels, IDs, images or values.
export function cameraDiagnostics(video: Pick<HTMLVideoElement,'videoWidth'|'videoHeight'>, track: MediaStreamTrack, focusRequest: string, capabilities?:MediaTrackCapabilities) {
  let settings: MediaTrackSettings & {focusMode?:string;exposureMode?:string}={};
  try{settings=track.getSettings?.()??{};}catch{/* Optional telemetry must not affect scanning. */}
  const mode=(value:unknown)=>typeof value==='string'&&['none','manual','single-shot','continuous'].includes(value)?value:'Not reported';
  const dimensions=(width:unknown,height:unknown)=>typeof width==='number'&&Number.isFinite(width)&&width>0&&typeof height==='number'&&Number.isFinite(height)&&height>0?`${width} × ${height}`:'Not reported';
  const range=(value:ULongRange|undefined)=>value&&typeof value.min==='number'&&typeof value.max==='number'&&Number.isFinite(value.min)&&Number.isFinite(value.max)?`${value.min}..${value.max}`:'Not reported';
  return {
    cameraRequest:'1920 × 1080 (ideal, not guaranteed)',
    cameraFrame:dimensions(video.videoWidth,video.videoHeight),
    cameraTrack:dimensions(settings.width,settings.height),
    cameraFocus:`${mode(settings.focusMode)}; continuous-focus request: ${focusRequest}`,
    cameraExposure:mode(settings.exposureMode),
    cameraCapabilities:capabilities?`Width ${range(capabilities.width)}; height ${range(capabilities.height)} (independent min/max ranges)`:'Not reported',
  };
}
