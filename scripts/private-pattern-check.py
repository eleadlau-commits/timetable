"""Read-only local image analysis. stdin contains private candidate patterns; stdout never does."""
import json
import math
import sys
from PIL import Image

data = json.load(sys.stdin)
image = Image.open(sys.argv[1]).convert('L')
position = data['position']
def lerp(a, b, t):
    return {'x': a['x'] * (1-t) + b['x'] * t, 'y': a['y'] * (1-t) + b['y'] * t}

checks = []
for fraction in (.2, .35, .5, .65, .8):
    left = lerp(position['topLeft'], position['bottomLeft'], fraction)
    right = lerp(position['topRight'], position['bottomRight'], fraction)
    distance = math.hypot(right['x']-left['x'], right['y']-left['y'])
    count = max(2, round(distance * 2))
    samples = []
    for i in range(count):
        point = lerp(left, right, -.02 + 1.04 * i/(count-1))
        x = max(0, min(image.width-1, round(point['x'])))
        y = max(0, min(image.height-1, round(point['y'])))
        samples.append(image.getpixel((x,y)))
    ordered = sorted(samples)
    dark, light = ordered[len(ordered)//5], ordered[len(ordered)*4//5]
    for proportion in (.4, .45, .5, .55, .6):
        bits = [value < dark + (light-dark)*proportion for value in samples]
        while bits and not bits[0]: bits.pop(0)
        while bits and not bits[-1]: bits.pop()
        if not bits: continue
        runs = []
        previous, length = bits[0], 0
        for bit in bits:
            if bit == previous: length += 1
            else: runs.append(length); previous, length = bit, 1
        runs.append(length)
        checks.append(runs)

summary = {}
for name, candidate in data['patterns'].items():
    expected = list(candidate)
    while expected and expected[-1] == 0: expected.pop()
    # BWIPP includes a final space in some symbols; compare first through last bar.
    if len(expected) % 2 == 0: expected.pop()
    allowed_widths = sorted(set(expected))
    def classify(width): return min(allowed_widths, key=lambda expected_width: abs(width-expected_width))
    best = None
    for runs in checks:
        if len(runs) != len(expected): continue
        errors = []
        classes_match = True
        for i, (actual, modules) in enumerate(zip(runs, expected)):
            lo, hi = max(0, i-10), min(len(runs), i+11)
            local_scale = sum(runs[lo:hi]) / sum(expected[lo:hi])
            normalized = actual / local_scale
            errors.append(abs(normalized-modules))
            if classify(normalized) != modules: classes_match = False
        mean = sum(errors)/len(errors)
        result = {'sameRunCount': True, 'allModuleWidthsMatch': classes_match,
                  'meanModuleError': round(mean, 3), 'maximumModuleError': round(max(errors), 3),
                  'startPatternMatches': all(classify(runs[i] / (sum(runs[:12])/sum(expected[:12]))) == expected[i] for i in range(min(12,len(runs)))),
                  'stopPatternMatches': all(classify(runs[i] / (sum(runs[-11:])/sum(expected[-11:]))) == expected[i] for i in range(max(0,len(runs)-11),len(runs)))}
        if best is None or mean < best[0]: best = (mean, result)
    summary[name] = best[1] if best else {'sameRunCount': False, 'allModuleWidthsMatch': False}
print(json.dumps(summary))
