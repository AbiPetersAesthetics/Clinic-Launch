// Schematic drawings of the shopfront, the reception and a treatment room, coloured
// from Abi's chosen finishes. They compare combinations; they are not renders.
// A surface with nothing chosen is drawn hatched.
import type { CSSProperties } from "react";

export type Role = "shop_main" | "shop_trim" | "feature" | "walls" | "walls_clinical" | "woodwork" | "floor_clinical" | "floor_front";
export type Colours = Partial<Record<Role, string | null>>;

const SERIF: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const UNDECIDED = "#E8E5DF";

function mix(hex: string, other: string, t: number): string {
  const a = hex.replace("#", ""), b = other.replace("#", "");
  const c = [0, 2, 4].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
const dark = (h: string | null | undefined, t = 0.18) => (h ? mix(h, "#000000", t) : "#CFCAC1");
const light = (h: string | null | undefined, t = 0.18) => (h ? mix(h, "#FFFFFF", t) : "#F2F0EB");
const fill = (h: string | null | undefined) => h ?? "url(#undecided)";
// Ink or white, whichever reads on the colour.
function onColour(h: string | null | undefined): string {
  if (!h) return "#8A857C";
  const n = h.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#1F2A44" : "#FFFFFF";
}

function Undecided() {
  return (
    <pattern id="undecided" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill={UNDECIDED} />
      <rect width="2" height="8" fill="#D3CEC5" />
    </pattern>
  );
}

function Sheen({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
      <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
    </linearGradient>
  );
}

// A panelled door in the woodwork colour, with its architrave.
function Door({ x, y, h, wood }: { x: number; y: number; h: number; wood: string | null }) {
  return (
    <g>
      <rect x={x} y={y} width="64" height={h} fill={fill(wood)} />
      <rect x={x + 6} y={y + 6} width="52" height={h - 6} fill={wood ? light(wood, 0.1) : "url(#undecided)"} />
      <rect x={x + 12} y={y + 14} width="40" height="44" fill="none" stroke={dark(wood, 0.2)} strokeWidth="1.5" />
      <rect x={x + 12} y={y + 66} width="40" height={h - 82} fill="none" stroke={dark(wood, 0.2)} strokeWidth="1.5" />
      <circle cx={x + 50} cy={y + 64} r="2.5" fill="#C9A96A" />
    </g>
  );
}

export function Shopfront({ c }: { c: Colours }) {
  const main = c.shop_main ?? null, trim = c.shop_trim ?? null;
  return (
    <svg viewBox="0 0 420 300" className="w-full h-auto block" role="img" aria-label="Shopfront schematic: fascia, pilasters and stall riser in the main colour; door and window frames in the trim colour">
      <defs>
        <Undecided />
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DFE8EF" /><stop offset="0.48" stopColor="#C9D7E2" /><stop offset="0.52" stopColor="#EAF1F6" /><stop offset="1" stopColor="#B7C7D5" />
        </linearGradient>
      </defs>
      <rect width="420" height="300" fill="#EEF1F5" />
      <rect x="20" y="0" width="380" height="70" fill="#D9D2C6" />
      <rect x="70" y="8" width="58" height="50" fill="#B9C6D2" stroke="#F4F2ED" strokeWidth="3" />
      <rect x="292" y="8" width="58" height="50" fill="#B9C6D2" stroke="#F4F2ED" strokeWidth="3" />
      {/* the frame behind everything, so the joints read as shadow lines */}
      <rect x="20" y="114" width="380" height="156" fill={dark(main, 0.25)} />
      {/* cornice and fascia */}
      <rect x="14" y="64" width="392" height="10" fill={dark(main)} />
      <rect x="20" y="74" width="380" height="40" fill={fill(main)} />
      <text x="210" y="101" textAnchor="middle" fontSize="19" fontWeight={600} letterSpacing="3" fill={trim ?? onColour(main)} style={SERIF}>ABI PETERS SKIN CLINIC</text>
      {/* console brackets, pilasters and plinths */}
      <rect x="20" y="114" width="26" height="12" fill={dark(main)} />
      <rect x="374" y="114" width="26" height="12" fill={dark(main)} />
      <rect x="20" y="126" width="26" height="144" fill={fill(main)} />
      <rect x="374" y="126" width="26" height="144" fill={fill(main)} />
      <rect x="18" y="258" width="30" height="12" fill={dark(main)} />
      <rect x="372" y="258" width="30" height="12" fill={dark(main)} />
      {/* the window: frame in trim, glass, stall riser in the main colour */}
      <rect x="56" y="122" width="208" height="148" fill={fill(trim)} />
      <rect x="64" y="130" width="192" height="98" fill="url(#glass)" />
      <rect x="64" y="228" width="192" height="6" fill={dark(trim)} />
      <rect x="64" y="234" width="192" height="28" fill={fill(main)} />
      {/* the door: frame, fanlight, panelled leaf */}
      <rect x="278" y="122" width="88" height="148" fill={fill(trim)} />
      <rect x="286" y="130" width="72" height="26" fill="url(#glass)" />
      <rect x="286" y="162" width="72" height="108" fill={fill(trim)} />
      <rect x="294" y="170" width="56" height="44" fill="none" stroke={light(trim, 0.3)} strokeWidth="2" />
      <rect x="294" y="222" width="56" height="40" fill="none" stroke={light(trim, 0.3)} strokeWidth="2" />
      <circle cx="348" cy="218" r="3" fill="#C9A96A" />
      {/* pavement */}
      <rect x="0" y="270" width="420" height="30" fill="#BFBAB2" />
      <rect x="0" y="270" width="420" height="3" fill="#A9A49C" />
    </svg>
  );
}

export function Reception({ c, id = "rc" }: { c: Colours; id?: string }) {
  const walls = c.walls ?? null, feature = c.feature ?? null, wood = c.woodwork ?? null, floor = c.floor_front ?? null;
  const hb = `${id}-herringbone`, sheen = `${id}-sheen`;
  return (
    <svg viewBox="0 0 420 300" className="w-full h-auto block" role="img" aria-label="Reception schematic: panelled feature wall, plain wall, woodwork and a herringbone floor">
      <defs>
        <Undecided />
        <Sheen id={sheen} />
        <pattern id={hb} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(0.55)">
          <rect width="40" height="40" fill={fill(floor)} />
          <path d="M0 0 L20 20 L20 40 L0 20 Z" fill={floor ? mix(floor, "#000000", 0.07) : "#DDD9D1"} />
          <path d="M20 20 L40 0 L40 20 L20 40 Z" fill={floor ? mix(floor, "#FFFFFF", 0.07) : "#E4E0D8"} />
          <path d="M0 0 L20 20 L40 0 M0 20 L20 40 L40 20" fill="none" stroke={floor ? mix(floor, "#000000", 0.16) : "#CFCAC1"} strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="420" height="300" fill="#F7F6F2" />
      <rect y="32" width="420" height="4" fill="#E6E3DC" />
      <rect y="36" width="420" height="180" fill={fill(walls)} />
      {/* the feature wall: two rows of moulded panels and a dado */}
      <rect x="0" y="36" width="224" height="180" fill={fill(feature)} />
      {[14, 84, 154].map(x => [48, 140].map(y => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="56" height="64" fill="none" stroke={light(feature, 0.28)} strokeWidth="2.5" />
          <rect x={x + 4} y={y + 4} width="48" height="56" fill="none" stroke={dark(feature, 0.22)} strokeWidth="1" />
        </g>
      )))}
      <rect x="0" y="124" width="224" height="5" fill={light(feature, 0.28)} />
      {/* the desk, in front of the panelling */}
      <rect x="64" y="160" width="130" height="56" fill="#E6DECD" />
      <rect x="60" y="152" width="138" height="9" fill="#CDBFA3" />
      <rect x="74" y="172" width="110" height="2" fill="#D9CFBB" />
      {/* wall art and a certificate on the plain wall */}
      <rect x="238" y="60" width="54" height="46" fill="#F2F0EB" stroke="#2F2F2F" strokeWidth="2" />
      <rect x="300" y="72" width="30" height="38" fill="#E9EEF2" stroke="#2F2F2F" strokeWidth="2" />
      <Door x={338} y={94} h={122} wood={wood} />
      {/* skirting */}
      <rect y="210" width="420" height="8" fill={fill(wood)} />
      <rect y="210" width="420" height="1.5" fill={light(wood, 0.3)} />
      {/* the floor */}
      <rect y="218" width="420" height="82" fill={`url(#${hb})`} />
      <rect y="218" width="420" height="82" fill={`url(#${sheen})`} />
    </svg>
  );
}

export function TreatmentRoom({ c, id = "tr" }: { c: Colours; id?: string }) {
  const walls = c.walls_clinical ?? null, wood = c.woodwork ?? null, floor = c.floor_clinical ?? null;
  const sheen = `${id}-sheen`;
  return (
    <svg viewBox="0 0 420 300" className="w-full h-auto block" role="img" aria-label="Treatment room schematic: clinical walls, cabinetry, a couch, the door and a coved vinyl floor">
      <defs>
        <Undecided />
        <Sheen id={sheen} />
      </defs>
      <rect width="420" height="300" fill="#F7F6F2" />
      <rect y="32" width="420" height="4" fill="#E6E3DC" />
      <rect y="36" width="420" height="170" fill={fill(walls)} />
      {/* wall cabinet and basin unit */}
      <rect x="26" y="54" width="126" height="56" fill="#F5F4F0" stroke="#D5D1C9" strokeWidth="1.5" />
      <line x1="89" y1="54" x2="89" y2="110" stroke="#D5D1C9" strokeWidth="1.5" />
      <rect x="80" y="78" width="4" height="10" fill="#B9B4AB" />
      <rect x="94" y="78" width="4" height="10" fill="#B9B4AB" />
      <rect x="34" y="150" width="110" height="56" fill="#F5F4F0" stroke="#D5D1C9" strokeWidth="1.5" />
      <rect x="30" y="144" width="118" height="8" fill="#E3E0D8" />
      <ellipse cx="89" cy="148" rx="26" ry="5" fill="#FFFFFF" stroke="#CFCAC1" />
      <path d="M89 138 V128 Q89 122 96 124" fill="none" stroke="#9EA3A8" strokeWidth="2.5" strokeLinecap="round" />
      {/* the couch */}
      <rect x="166" y="180" width="6" height="26" fill="#6E6E6E" />
      <rect x="290" y="180" width="6" height="26" fill="#6E6E6E" />
      <rect x="160" y="172" width="146" height="10" rx="2" fill="#7C7C7C" />
      <rect x="156" y="150" width="112" height="24" rx="6" fill="#DEDAD2" />
      <path d="M266 174 V150 L296 130 Q304 126 307 134 L308 172 Z" fill="#DEDAD2" />
      {/* a trolley */}
      <rect x="312" y="150" width="26" height="4" fill="#C8C8C8" />
      <rect x="312" y="176" width="26" height="4" fill="#C8C8C8" />
      <rect x="314" y="150" width="2" height="56" fill="#B0B0B0" />
      <rect x="334" y="150" width="2" height="56" fill="#B0B0B0" />
      <Door x={344} y={84} h={122} wood={wood} />
      {/* coved skirting, then the floor */}
      <path d="M0 214 V210 Q0 206 4 206 H416 Q420 206 420 210 V214 Z" fill={fill(floor)} />
      <rect y="214" width="420" height="86" fill={fill(floor)} />
      <rect y="214" width="420" height="86" fill={`url(#${sheen})`} />
    </svg>
  );
}
