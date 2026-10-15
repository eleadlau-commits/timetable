export function decodePolyline(encoded: string): [number, number][] {
  let index = 0, lat = 0, lon = 0;
  const points: [number, number][] = [];
  function component() {
    let result = 0, shift = 0, byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid route geometry');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid route geometry');
      result |= (byte & 31) << shift; shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
  while (index < encoded.length) { lat += component(); lon += component(); points.push([lat / 1e5, lon / 1e5]); }
  return points;
}
