// Durham University room codes → buildings.
//
// Rooms and buildings from the AccessAble guides to Durham's learning spaces
// (https://www.accessable.co.uk/durham-university/learning-spaces), October 2026.
// Map positions from OpenStreetMap where it has the building, otherwise from AccessAble.
// A room code is a building prefix plus a room number, e.g. CLC013 = Calman Learning Centre, room 013.
//
// To add a building, add it to BUILDINGS (name, street, latitude, longitude) and, if its
// code isn't the same as its key, point the code at it in PREFIXES.
// ROOMS only lists rooms with their own name, or rooms in a different building from their prefix.

const BUILDINGS = {
  BL: ['Department of Biosciences', 'South Road, Durham', 54.76502, -1.57233],
  CB: ['Confluence Building', 'Lower Mountjoy, South Road, Durham', 54.76776, -1.57038],
  CC: ['Chemistry Courtyard Computer Suite', 'Chemistry Building, Lower Mountjoy, South Road, Durham', 54.7682, -1.5711],
  CG: ['Chemistry Building', 'Lower Mountjoy, South Road, Durham', 54.7682, -1.5711],
  CGMC: ['Materials Chemistry', 'Lower Mountjoy, South Road, Durham', 54.76786, -1.57196],
  CL: ['38–39 North Bailey', 'North Bailey, Durham', 54.774, -1.5749],
  CLC: ['Calman Learning Centre', 'Stockton Road, Durham', 54.76737, -1.57198],
  D: ['Dawson Building', 'Lower Mountjoy, South Road, Durham', 54.76803, -1.5725],
  DH: ['Dunelm House', 'New Elvet, Durham', 54.77331, -1.57194],
  E: ['Christopherson Building', 'South Road, Durham', 54.76724, -1.57032],
  EH: ['Elvet Hill House', 'Mill Hill Lane, Durham', 54.76416, -1.5814],
  ER: ['Elvet Riverside', 'New Elvet, Durham', 54.77474, -1.5722],
  ER1: ['Elvet Riverside 1', '83 New Elvet, Durham', 54.77474, -1.5722],
  ER2: ['Elvet Riverside 2', 'Court Lane, Durham', 54.77413, -1.57206],
  ES: ['Arthur Holmes Building', 'Lower Mountjoy, South Road, Durham', 54.76724, -1.57149],
  HH: ['Hallgarth House', '77 Hallgarth Street, Durham', 54.77159, -1.57005],
  HIG: ['Higginson Building', 'South Road, Durham', 54.76677, -1.56991],
  HS: ['43–46 North Bailey', 'North Bailey, Durham', 54.77452, -1.57476],
  IM: ['Al-Qasimi Building', 'Elvet Hill Road, Durham', 54.76566, -1.58165],
  L: ['Psychology Building', 'Upper Mountjoy, Stockton Road, Durham', 54.7654, -1.57162],
  MCS: ['Mathematical Sciences and Computer Science Building', 'Stockton Road, Durham', 54.76337, -1.57197],
  MHL: ['Mill Hill Lane', 'Mill Hill Lane, Durham', 54.76307, -1.58111],
  MU: ['Divinity House', 'Palace Green, Durham', 54.77398, -1.57548],
  NB48: ['48–49 North Bailey', 'North Bailey, Durham', 54.77493, -1.57474],
  OC: ['Ogden Centre for Fundamental Physics', 'South Road, Durham', 54.76669, -1.57402],
  OE: ['Old Elvet', 'Old Elvet, Durham', 54.775, -1.5688],
  OE29: ['29 Old Elvet', 'Old Elvet, Durham', 54.77463, -1.56767],
  OE32: ['32 Old Elvet', 'Old Elvet, Durham', 54.77482, -1.56794],
  OE32B: ['Back of 32 Old Elvet', 'Old Elvet, Durham', 54.77482, -1.56794],
  OE42: ['42 Old Elvet', 'Old Elvet, Durham', 54.77519, -1.5691],
  OE48: ['47–49 Old Elvet', 'Old Elvet, Durham', 54.77529, -1.56996],
  OE50: ['50–51 Old Elvet', 'Old Elvet, Durham', 54.77531, -1.5701],
  OTL: ['Territorial Lane Building', 'Territorial Lane, Durham', 54.7757, -1.57],
  PCL: ['Palatine Centre', 'Stockton Road, Durham', 54.76863, -1.57209],
  PG: ['Pemberton Building', 'Palace Green, Durham', 54.77407, -1.57537],
  PH: ['Rochester Building (Physics)', 'Lower Mountjoy, South Road, Durham', 54.767, -1.57386],
  RH: ['Rowan House', 'Stockton Road, Durham', 54.76425, -1.57256],
  SS58: ['58 Saddler Street', 'Saddler Street, Durham', 54.77581, -1.57486],
  TH: ['Abbey House', 'Palace Green, Durham', 54.77391, -1.57535],
  TLC: ['Teaching and Learning Centre', 'South Road, Durham', 54.76722, -1.57621],
  W: ['West Building', 'Lower Mountjoy, South Road, Durham', 54.76759, -1.57388],
  WB: ['Waterside Building', 'Riverside Place, Durham', 54.78042, -1.57547],
};

// Code prefix → building, where they differ or share a building.
const PREFIXES = {
  DHE: 'DH',
  ENGEX: 'E',
  ERA: 'ER1',
  PO: 'OE48',
  SS: 'SS58',
};

// Room code (letters and digits only) → [room name, building if not the usual one for its prefix].
const ROOMS = {
  BL201: ['The Whitehead Room'],
  CB0008: ['Heawood Lecture Theatre'],
  CG141: ['The Musgrove Room'],
  CG193: ['The Coates Laboratory'],
  CG85: ['Richard D. Chambers FRS Lecture Theatre'],
  CG91: ['Arthur Holmes Lecture Theatre'],
  CG93: ['Scarborough Lecture Theatre'],
  CLC013: ['Arnold Wolfendale Lecture Theatre'],
  CLC202: ['Rosemary Cramp Lecture Theatre'],
  CLC203: ['Ken Wade Lecture Theatre'],
  CLC406: ['Derman Christopherson Room'],
  CLC407: ['Kingsley Barrett Room'],
  D125: ['Bilsborough Laboratory'],
  D133: ['Fenwick Human Osteology Laboratory'],
  D203: ['Kiln Laboratory'],
  D204: ['Fenwick Human Osteology Laboratory'],
  D210: ['Birley Room'],
  D233: ['Conservation Laboratory'],
  D243: ['Archaeology Isotopes Laboratory'],
  D244: ['Digital Visualisation Laboratory'],
  DHC05A: ['The Learning Lounge'],
  DHD16: ['Vane Tempest Room'],
  DHE01: ['Fonteyn Ballroom'],
  E092: ['Page Laboratory'],
  E145: ['Civils Laboratory'],
  E219: ['Focus Room'],
  E240: ['', 'HIG'],
  ENGEX1: ['Computer Classroom'],
  L050: ['F V Smith Lecture Theatre'],
  MCS0001: ['Scott Logic Lecture Theatre'],
  MCS3070: ['Magic Room'],
  MU106: ['', 'NB48'],
  OC218: ['Stirling Room'],
  OE113: ['', 'OE32B'],
  PCL048: ['Hogan Lovells Lecture Theatre'],
  PCL152: ['Moot Court'],
  PH132: ['Sir James Knott Room'],
  PH220: ['Level 2 Teaching Laboratory'],
  WB0001: ['Lecture Theatre'],
  WB1003: ['Financial Trading Lab'],
  WB2003: ['Executive Lecture Theatre'],
  WB2005: ['Executive Learning Room'],
};

// Room-code-shaped tokens: letters, optional dash or space, then a number
// (e.g. CLC013, CLC 013, CB-0008, CB-LG001, OE42-1008, DH-A04).
const CODE_RE = /\b[A-Z]{1,5}[-\s]?[A-Z]{0,2}\d[A-Z0-9/-]*/gi;

function buildingKeyFor(code) {
  const upper = code.toUpperCase();
  const room = ROOMS[upper.replace(/[^A-Z0-9]/g, '')];
  if (room?.[1]) return room[1];
  const [, letters, digits] = upper.match(/^([A-Z]+)[-\s]?(\d*)/) || [];
  if (!letters) return null;
  // Codes like OE42-1008 or SS58-1003 name the building before the dash.
  const beforeDash = upper.split('-')[0];
  if (upper.includes('-') && BUILDINGS[beforeDash]) return beforeDash;
  // ER1xx rooms are in Elvet Riverside 1, ER2xx in Elvet Riverside 2.
  if (digits && BUILDINGS[letters + digits[0]]) return letters + digits[0];
  if (PREFIXES[letters]) return PREFIXES[letters];
  return BUILDINGS[letters] ? letters : null;
}

// Finds the first known room code in a timetable location.
// Returns { code, room, building, address, lat, lng } or null if nothing matches.
export function lookupPlace(location) {
  if (!location) return null;
  for (const [token] of location.matchAll(CODE_RE)) {
    const key = buildingKeyFor(token);
    if (!key) continue;
    const [building, address, lat, lng] = BUILDINGS[key];
    const room = ROOMS[token.toUpperCase().replace(/[^A-Z0-9]/g, '')]?.[0] || '';
    return { code: token.toUpperCase(), room, building, address, lat, lng };
  }
  return null;
}
