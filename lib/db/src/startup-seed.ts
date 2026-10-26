/**
 * Startup seed — runs automatically when the API server boots.
 * Uses the shared db pool (does NOT close it).
 * Always replaces phases + tasks with the exact V5 Winchester data.
 */

import { db } from "./index";
import * as schema from "./schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  BACKLINK_OPPORTUNITIES,
  BACKLINK_LISTING_PACK,
  BACKLINK_TEMPLATES,
} from "./backlink-seed-data";

// Rooms and kit: Abi's view. The budget lines are plan tasks (kit_lines points at
// launch_tasks) so the figures follow the Plan & Timeline; areas only group them.
// Each seed runs once per project and is skipped when its rows exist. The paint pot
// comes from migrateKitV38, which also gives every line its board label and order.
const KIT_AREAS = [
  { areaKey: "treatment", name: "Treatment rooms", sortOrder: 1, covers: "Two treatment rooms; room 2 is the one the plan calls the consultation room. CBS's contract covers the partitions, doors, basins, clinical vinyl floors, lighting and locks." },
  { areaKey: "reception", name: "Reception", sortOrder: 2, covers: "CBS's contract covers the herringbone floor, the decoration, the lighting and the glazed screen." },
  { areaKey: "finish", name: "Finishing touches", sortOrder: 4, covers: "Extras on top of the build. Where the plan shows £0, the line was cut in the savings or carries no cost of its own: raise it in the plan before buying." },
  { areaKey: "opening", name: "Opening", sortOrder: 5, covers: "Stock, kit for the two of you, and insurance." },
];
// The owner's list of 30 September 2026 as tidied on 1 October: the joinery decision
// line repeated the installation line and is off the board, and the consultation room
// is treatment room 2. Matched to plan tasks by title.
const KIT_LINES: { match: RegExp; areaKey: string }[] = [
  { match: /^Product Display.*Retail Shelving/i, areaKey: "reception" },
  { match: /^Joinery.*Cabinetry.*Installation/i, areaKey: "reception" },
  { match: /^Wall Panelling.*Feature Finish/i, areaKey: "finish" },
  { match: /^Treatment Couch/i, areaKey: "treatment" },
  { match: /^Reception furniture and styling/i, areaKey: "reception" },
  { match: /^Consultation Room Furniture/i, areaKey: "treatment" },
  { match: /^Treatment Room Furniture/i, areaKey: "treatment" },
  { match: /^Wall Art, Certificates/i, areaKey: "finish" },
  { match: /^Furniture \/ Equipment Installation and Room Dressing/i, areaKey: "finish" },
  { match: /^Retail \/ Skincare Opening Stock/i, areaKey: "opening" },
  { match: /^FIGS scrubs/i, areaKey: "opening" },
  { match: /^Hamilton Fraser/i, areaKey: "opening" },
];
// Colours and finishes: the surfaces Abi decides (paint inside and out, the floors),
// each with a shortlist of options and one chosen. The role names the part of the
// Rooms & Kit schematics a surface colours. Seeded once; she renames, adds and
// shortlists from there. The starters are the brand colours to match, not paints.
const FINISH_SURFACES: { zone: string; role: string; name: string; brief: string; starters?: { name: string; hex: string; note: string }[] }[] = [
  { zone: "outside", role: "shop_main", name: "Shopfront: fascia, pilasters and stall riser", brief: "The white. Exterior eggshell or masonry paint. The lease and the conservation area can both have a say in shopfront colours, so check before the repaint is booked.", starters: [{ name: "Brand white", hex: "#FFFFFF", note: "The white to match: ask the merchant for their nearest exterior white or a colour match." }] },
  { zone: "outside", role: "shop_trim", name: "Shopfront: door and window frames", brief: "The blue. CBS refurbish the shopfront (Ref 17); the paint for it sits in the Paint pot.", starters: [{ name: "Brand navy", hex: "#1F2A44", note: "The logo navy, the colour to match. Have a sample colour matched or pick the nearest real colour." }] },
  { zone: "inside", role: "feature", name: "Feature wall and panelling", brief: "The blue, behind the reception desk. Decorative moulding fitted by Abi's father; the materials are the wall panelling line.", starters: [{ name: "Brand navy", hex: "#1F2A44", note: "The logo navy, the colour to match." }] },
  { zone: "inside", role: "walls", name: "Reception walls", brief: "Emulsion. Front of house decoration is in CBS's contract (Ref 14); the colour is Abi's call." },
  { zone: "inside", role: "walls_clinical", name: "Treatment rooms and corridor walls", brief: "Antimicrobial emulsion (Dulux Sterishield or similar), two coats, in both treatment rooms and the corridor, as the infection control policy asks. Tinted ranges are limited, so pick from what the paint comes in." },
  { zone: "inside", role: "woodwork", name: "Doors, frames and skirting", brief: "Eggshell or satin on the inside woodwork. The treatment rooms have coved vinyl instead of skirting." },
  { zone: "floor", role: "floor_clinical", name: "Treatment rooms floor", brief: "Clinical safety vinyl with welded seams and 100 mm coving in both treatment rooms, in CBS's contract (Ref 13); Tarkett iQ Granit and Polyflor were the plan's candidates. The range and colour are Abi's to pick." },
  { zone: "floor", role: "floor_front", name: "Reception floor", brief: "Herringbone LVT, in CBS's contract (Ref 13). The range and colour are Abi's to pick." },
];
async function seedFinishes(projectId: number) {
  const existing = await db.select().from(schema.finishSurfacesTable).where(eq(schema.finishSurfacesTable.projectId, projectId));
  if (existing.length > 0) return false;
  let order = 0;
  for (const s of FINISH_SURFACES) {
    const [row] = await db.insert(schema.finishSurfacesTable).values({ projectId, zone: s.zone, role: s.role, name: s.name, brief: s.brief, sortOrder: ++order }).returning();
    if (s.starters?.length) await db.insert(schema.finishOptionsTable).values(s.starters.map((o, j) => ({ projectId, surfaceId: row.id, name: o.name, brand: "Abi Peters brand", code: o.hex, hex: o.hex, note: o.note, status: "idea", sortOrder: j + 1 })));
  }
  return true;
}
// V38, 1 October 2026: the owner's tidy of Abi's board. The joinery decision line
// repeated the installation line, so it leaves the board (the plan keeps it). The
// consultation room is treatment room 2, so its line joins the treatment rooms. A
// paint pot, outside and inside, arrives as two plan lines at £0 for the owner to
// price. Every line gets a short board label and a place in the room order, and the
// area and surface texts catch up. Runs once: the paint area is written last, as the
// marker, so a run cut short finishes on the next boot.
const KIT_V38_PAINT = [
  { title: "Paint: outside (shopfront white and blue)", notes: "The paint for the shopfront: the white (fascia, pilasters, stall riser) and the blue (door and window frames), chosen on Abi's Rooms & Kit board. At £0 until priced. CBS's Ref 17 covers the shopfront refurbishment: confirm which paint their price already includes." },
  { title: "Paint: inside (walls, feature blue, woodwork)", notes: "The paint for inside: the reception walls, the feature wall blue, the antimicrobial emulsion for the treatment rooms and corridor, and the woodwork, chosen on Abi's Rooms & Kit board. At £0 until priced. CBS's Ref 14 covers the decoration: confirm which paint their price already includes." },
];
const KIT_V38_PAINT_AREA = { name: "Paint", covers: "The paint you buy for the decorators, outside and in. CBS's contract covers the decorating (Ref 14) and the shopfront (Ref 17): check which paint their price already includes, so this pot holds only what you choose on top." };
const KIT_V38_AREA_ORDER: Record<string, number> = { treatment: 1, reception: 2, paint: 3, finish: 4, opening: 5, consult: 90, front: 91 };
const KIT_V38_ORDER: { match: RegExp; label: string }[] = [
  { match: /^Treatment Couch/i, label: "Treatment couch" },
  { match: /^Treatment Room Furniture/i, label: "Treatment room 1: furniture, equipment and styling" },
  { match: /^Consultation Room Furniture/i, label: "Treatment room 2: furniture and styling" },
  { match: /^Joinery.*Cabinetry.*Installation/i, label: "Reception desk and clinical cabinetry" },
  { match: /^Reception furniture and styling/i, label: "Reception furniture and styling" },
  { match: /^Product Display.*Retail Shelving/i, label: "Retail shelving, display and LED" },
  { match: /^Paint: outside/i, label: "Outside: the shopfront white and blue" },
  { match: /^Paint: inside/i, label: "Inside: walls, the feature blue and woodwork" },
  { match: /^Wall Panelling.*Feature Finish/i, label: "Wall panelling and feature moulding" },
  { match: /^Wall Art, Certificates/i, label: "Wall art, certificates and picture lights" },
  { match: /^Furniture \/ Equipment Installation and Room Dressing/i, label: "Installation and room dressing" },
  { match: /^Retail \/ Skincare Opening Stock/i, label: "Retail and skincare opening stock" },
  { match: /^FIGS scrubs/i, label: "Scrubs and trainers for Abi and David" },
  { match: /^Hamilton Fraser/i, label: "Insurance: indemnity and premises" },
];
// Surface texts that named the consultation room or a figure that has since moved;
// each changes only while it still reads as first seeded.
const FINISH_V38: { role: string; from: { name?: string; brief?: string }; to: { name?: string; brief: string } }[] = [
  { role: "shop_trim", from: { brief: "The blue. The repaint is a plan line (contractor managed): shopfront, window frames and front door in the brand colours." }, to: { brief: "The blue. CBS refurbish the shopfront (Ref 17); the paint for it sits in the Paint pot." } },
  { role: "feature", from: { brief: "The blue, behind the reception desk. Decorative moulding fitted by Abi's father; the plan carries £600 of materials." }, to: { brief: "The blue, behind the reception desk. Decorative moulding fitted by Abi's father; the materials are the wall panelling line." } },
  { role: "walls", from: { name: "Reception and consultation room walls" }, to: { name: "Reception walls", brief: "Emulsion. Front of house decoration is in CBS's contract (Ref 14); the colour is Abi's call." } },
  { role: "walls_clinical", from: { brief: "Antimicrobial emulsion (Dulux Sterishield or similar), two coats, as the infection control policy asks. Tinted ranges are limited, so pick from what the paint comes in." }, to: { brief: "Antimicrobial emulsion (Dulux Sterishield or similar), two coats, in both treatment rooms and the corridor, as the infection control policy asks. Tinted ranges are limited, so pick from what the paint comes in." } },
  { role: "floor_clinical", from: { brief: "Clinical safety vinyl with welded seams and 100 mm coving, in CBS's contract; Tarkett iQ Granit and Polyflor were the plan's candidates. The range and colour are Abi's to pick." }, to: { brief: "Clinical safety vinyl with welded seams and 100 mm coving in both treatment rooms, in CBS's contract (Ref 13); Tarkett iQ Granit and Polyflor were the plan's candidates. The range and colour are Abi's to pick." } },
  { role: "floor_front", from: { name: "Reception and consultation room floor" }, to: { name: "Reception floor", brief: "Herringbone LVT, in CBS's contract (Ref 13). The range and colour are Abi's to pick." } },
];
// V47, 11 October 2026 (owner): everything in the 9A layout pack (10 October) that the plan
// and the board did not yet hold goes in uncosted, at £0 with "price to come", so nothing in
// the design is missing. Building extras and gaps are plan lines in the building works
// phase; furniture and kit are items on Abi's board under their plan line; the lobby and
// utility get their own area and two plan lines. Each line or item goes in once, by name.
const V47_SRC = "From the 9A layout pack, 10 October 2026.";
const V47_BUILD: { title: string; notes: string }[] = [
  { title: "Emergency lights and exit signs (price needed)", notes: "Not in CBS's price (Q2002C) and not in Arundel's fire alarm commissioning. Layout pack point 10: price needed from CBS or Arundel. " + V47_SRC },
  { title: "Ramp edge guarding (price needed)", notes: "The glass ramp panel is out of CBS's price, so the platform edge has no guarding: a handrail, an upstand or the panel back. Layout pack point 11 and the reception plan, note 17. " + V47_SRC },
  { title: "LED strips: reception shelves and treatment room cupboards (CBS variation)", notes: "Warm LED under the three reception shelves (about 3 m, dimmer D3) and under the wall cupboards in both treatment rooms (about 2.9 m). Not in Q2002C: price separately (sheet 32). " + V47_SRC },
  { title: "Hang and power the two Tala pendants, with dimmers (CBS variation)", notes: "Our two Tala pendants (over the sofa and the desk), two Tala-compatible dimmers, the window pendant on its own switch. Small extra, first fix (point 5). " + V47_SRC },
  { title: "Two high sockets for audio (CBS variation)", notes: "Omitted from Q2002C. Small extra, first fix (point 6). " + V47_SRC },
  { title: "Reception desk power module and cable tray (CBS variation)", notes: "Two sockets and USB-C under the worktop, and a cable tray. Small extra, first fix (point 7). " + V47_SRC },
  { title: "Utility door re-hung to open out, with a closer (CBS variation)", notes: "Hinged on the WC1 side, opening into the lobby. Small extra, second fix (point 8). " + V47_SRC },
  { title: "Fixings for our items: mirror, art, hooks, worktop timber (CBS)", notes: "Mirror and art into masonry, coat hooks, the Room 2 worktop wall timber. Small extra, first fix (point 17). " + V47_SRC },
  { title: "Coffee sink and tap in the lobby (CBS variation)", notes: "Compact sink unit (K3) on the existing services; not in CBS's price. " + V47_SRC },
  { title: "Switches and sockets in BG Nexus black nickel (extra over white)", notes: "Same finish throughout, with Tala-compatible dimmers to match. Tell CBS before they order (point 13). " + V47_SRC },
  { title: "Herringbone LVT in the treatment rooms, not clinical vinyl (difference to agree)", notes: "Karndean Korlok Texas White Ash in every room. Agree the difference with CBS and check the floor against their allowance (points 1 and 14). " + V47_SRC },
  { title: "Credit due from CBS: basins and taps (Ref 10.1)", notes: "We supply the Arezzo basins and Alberta taps; CBS fit. Ask for the credit against 10.1 (3,005 in all). A credit, so it will bring the total down (point 2). " + V47_SRC },
  { title: "Credit due from CBS: clinical fixings", notes: "We fit the dispensers and sharps brackets. Ask for the credit (point 3). " + V47_SRC },
  { title: "Laser supply and stop button: keep or omit (credit if omitted)", notes: "The laser is not bought. Keep points 47 and 55 as provision, or omit them for a credit. David to decide (point 9). " + V47_SRC },
];
const V47_LOBBY_LINES: { title: string; label: string; notes: string }[] = [
  { title: "Lobby coffee station: machine, fridge, wine cooler, cupboards", label: "Lobby coffee station", notes: "The coffee station in the lobby bay: bean to cup machine, under-counter fridge, slimline wine cooler, Howdens units with a Calacatta top, mirror. Ours, not in CBS. At £0 until priced. " + V47_SRC },
  { title: "Utility storage: clinical waste cupboard, lockers, COSHH cupboard", label: "Utility: waste, lockers, cleaning", notes: "Lockable vented clinical waste cupboard, 8 staff lockers, lockable COSHH cupboard. Ours, not in CBS (CBS 16 at £0). At £0 until priced. " + V47_SRC },
];
const V47_ITEMS: { line: RegExp | string; area: string; name: string; note: string }[] = [
  { line: /^Reception furniture and styling/i, area: "reception", name: "Wall art: plaster relief face, black frame (Etsy, made to order)", note: "800 wide by 1,000 high, centred on the cabinet, 2 fixings into masonry. Chosen. Price to come." },
  { line: /^Reception furniture and styling/i, area: "reception", name: "Floor plant, faux, about 1.2 m, stone pot", note: "To choose. Price to come." },
  { line: /^Reception furniture and styling/i, area: "reception", name: "Coat hooks: a rail of 4, landing wall", note: "To choose. Price to come." },
  { line: /^Reception furniture and styling/i, area: "reception", name: "Desk styling: vase of stems, tray, reed diffuser", note: "To choose. Price to come." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Practitioner stool, room 1", note: "To choose. Price to come." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Sharps bin, room 1", note: "Still to choose. Price to come." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Floor stand for the Omega 7 lamp", note: "Sold separately from the lamp. Price to come." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Mirror and screen or tablet arm, over the room 1 desk", note: "At seated eye height. Price to come." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Lec Pharmacy Plus fridge, 47 L, glass door", note: "Marked bought in the pack: add what it cost and where it was paid." },
  { line: /^Treatment Room Furniture/i, area: "treatment", name: "Skin analyser on its own trolley", note: "To choose. Check whether this is the skin analysis platform already paid (4,250). Price to come." },
  { line: /^Consultation Room Furniture/i, area: "treatment", name: "Room 2: Lapis bed (deferred)", note: "Deferred: waits for the second clinician." },
  { line: /^Consultation Room Furniture/i, area: "treatment", name: "Room 2: stool, Omega 7 lamp, trolley, fridge, dispensers (deferred)", note: "Deferred: waits for the second clinician. The cupboards, worktop, basin and tap go in now, as room 1." },
  { line: "Lobby coffee station: machine, fridge, wine cooler, cupboards", area: "lobby", name: "Coffee machine, bean to cup", note: "On the worktop, open shelf above. To choose. Price to come." },
  { line: "Lobby coffee station: machine, fridge, wine cooler, cupboards", area: "lobby", name: "Under-counter fridge, 600 wide (milk and staff)", note: "Front-venting. To choose. Price to come." },
  { line: "Lobby coffee station: machine, fridge, wine cooler, cupboards", area: "lobby", name: "Slimline wine cooler, 300 wide", note: "Front-venting, built under. To choose. Price to come." },
  { line: "Lobby coffee station: machine, fridge, wine cooler, cupboards", area: "lobby", name: "Howdens units and worktop: navy base, white wall, Calacatta top", note: "Who fits to agree with CBS (point 29). Price to come." },
  { line: "Lobby coffee station: machine, fridge, wine cooler, cupboards", area: "lobby", name: "Full-length mirror, 500 by 1,500, safety backed", note: "Outside the WCs, security fixings. To choose. Price to come." },
  { line: "Utility storage: clinical waste cupboard, lockers, COSHH cupboard", area: "lobby", name: "Clinical waste cupboard, lockable and vented", note: "700 by 400, full height. Price to come." },
  { line: "Utility storage: clinical waste cupboard, lockers, COSHH cupboard", area: "lobby", name: "Staff lockers, 8 (4 by 2)", note: "1,200 by 450 by 1,800. Price to come." },
  { line: "Utility storage: clinical waste cupboard, lockers, COSHH cupboard", area: "lobby", name: "COSHH and cleaning cupboard, lockable", note: "Price to come." },
];
async function migratePackGapsV47(projectId: number) {
  const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
  if (!phases.length) return;
  // Every line, archived ones too, decides what already went in: a line archived later
  // (V49) must not come back on the next boot.
  const all = await db.select().from(schema.tasksTable).where(inArray(schema.tasksTable.phaseId, phases.map(p => p.id)));
  const gone = new Set(all.filter(t => t.archived).map(t => t.title));
  const tasks = all.filter(t => !t.archived);
  const build = tasks.find(t => t.title === "Arundel fire alarm (total)") ?? tasks.find(t => /^Ref 14 - Decoration/i.test(t.title));
  const ffe = tasks.find(t => /^Treatment Room Furniture/i.test(t.title));
  if (!build || !ffe) return;
  const base = { owner: "Abi + David", status: "not_started", riskLevel: "low", costTier: "low", selectedCost: 0, costVatStatus: "inc_vat", supplyScope: "to_confirm", procurementStatus: "to_specify", priority: "medium", budgetStatus: "not_set", includeInLaunchBudget: true, includeInRiskView: true };
  let bOrder = tasks.filter(t => t.phaseId === build.phaseId).reduce((m, t) => Math.max(m, t.sortOrder), 0);
  for (const b of V47_BUILD) {
    if (gone.has(b.title) || tasks.some(t => t.title === b.title)) continue;
    const [row] = await db.insert(schema.tasksTable).values({ ...base, phaseId: build.phaseId, title: b.title, notes: b.notes, owner: "David", supplier: /CBS/.test(b.title) ? "CBS" : null, sortOrder: ++bOrder } as any).returning();
    tasks.push(row);
  }
  let fOrder = tasks.filter(t => t.phaseId === ffe.phaseId).reduce((m, t) => Math.max(m, t.sortOrder), 0);
  for (const l of V47_LOBBY_LINES) {
    if (gone.has(l.title)) continue;
    let task = tasks.find(t => t.title === l.title);
    if (!task) { [task] = await db.insert(schema.tasksTable).values({ ...base, phaseId: ffe.phaseId, title: l.title, notes: l.notes, sortOrder: ++fOrder } as any).returning(); tasks.push(task); }
    const [linked] = await db.select().from(schema.kitLinesTable).where(and(eq(schema.kitLinesTable.projectId, projectId), eq(schema.kitLinesTable.taskId, task.id)));
    if (!linked) await db.insert(schema.kitLinesTable).values({ projectId, taskId: task.id, areaKey: "lobby", sortOrder: V47_LOBBY_LINES.indexOf(l), label: l.label } as any);
  }
  const items = await db.select().from(schema.kitItemsTable).where(eq(schema.kitItemsTable.projectId, projectId));
  for (const it of V47_ITEMS) {
    if (items.some(x => x.name === it.name)) continue;
    const task = typeof it.line === "string" ? tasks.find(t => t.title === it.line) : tasks.find(t => (it.line as RegExp).test(t.title));
    if (!task) continue;
    await db.insert(schema.kitItemsTable).values({ projectId, areaKey: it.area, taskId: task.id, name: it.name, amountGbp: 0, status: "planned", note: it.note + " " + V47_SRC } as any);
  }
  // The area last: it marks the step as done for anyone reading the board.
  const [area] = await db.select().from(schema.kitAreasTable).where(and(eq(schema.kitAreasTable.projectId, projectId), eq(schema.kitAreasTable.areaKey, "lobby")));
  if (!area) await db.insert(schema.kitAreasTable).values({ projectId, areaKey: "lobby", name: "Lobby, coffee and utility", covers: "The coffee station in the lobby bay, the lobby mirror, and the utility's clinical waste cupboard, lockers and cleaning cupboard. All ours: none of it is in CBS's contract. At £0 until priced.", sortOrder: 3, budgetGbp: 0 } as any);
}
// V49, 12 October 2026 (owner): the 9A pack re-issued as three sets (the full pack, CBS
// Issue 2 and the design pack), still Rev DS of 10 October. No price moved. The points to
// discuss were renumbered and four changed: CBS take the emergency lights and exit signs
// (agreed verbally); the desk power module and the clinical fixings credit are dropped;
// replacing the WCs is new and open. The notes follow the new numbering, the two dropped
// lines are archived (not deleted), the WCs and the take-home shelf go in at £0, and Abi's
// finishes board takes the finishes the pack has chosen. Every step only while the line,
// item or surface still reads as V47 or the first seed left it.
const V49_SRC = "Checked against the 9A packs re-issued 12 October 2026 (Rev DS, CBS Issue 2).";
const V49_NOTES: Record<string, string> = {
  "Emergency lights and exit signs (price needed)": "CBS are doing the emergency lights and exit signs, agreed verbally (point 8; the lighting sheet says \"Emergency lighting: yours\"). Get it in writing, with whether it is inside Q2002C or an extra. The fire alarm itself is Arundel's.",
  "Ramp edge guarding (price needed)": "The glass ramp panel is out of CBS's price, so the platform edge has no guarding: a handrail, an upstand or the panel back (point 9; reception plan, note 17).",
  "LED strips: reception shelves and treatment room cupboards (CBS variation)": "Warm LED under the three reception shelves (dimmer D3) and under the wall cupboards in both treatment rooms (U1, own switch by the door). Not in Q2002C: CBS to price (point 24).",
  "Hang and power the two Tala pendants, with dimmers (CBS variation)": "Our two Tala pendants (over the sofa and the desk), two Tala-compatible dimmers, the window pendant on its own switch. First fix (point 5).",
  "Two high sockets for audio (CBS variation)": "Omitted from Q2002C. First fix (point 6).",
  "Utility door re-hung to open out, with a closer (CBS variation)": "The utility door opens out into the lobby with a closer fitted (design pack, critical dimension 17; the closer matches the ironmongery, point 10). No longer a separate point: confirm with CBS whether it is in their price.",
  "Fixings for our items: mirror, art, hooks, worktop timber (CBS)": "Backing timber in the partitions for our dispensers, sharps brackets and cupboards (point 3), fixings for the take-home shelf (point 23), mirror and art into masonry, coat hooks. Confirm with CBS what their price covers.",
  "Coffee sink and tap in the lobby (CBS variation)": "Our sink and tap on the existing services, CBS to connect (lobby sheet). Not in CBS's price.",
  "Switches and sockets in BG Nexus black nickel (extra over white)": "BG Nexus Metal black nickel throughout, with Tala-compatible dimmers to match; closest match is fine. Tell CBS before second fix (point 11).",
  "Herringbone LVT in the treatment rooms, not clinical vinyl (difference to agree)": "Karndean Korlok Texas White Ash herringbone (Howdens SDH1210) in every room, the WCs and utility included, chosen 10 October. CBS priced clinical vinyl in the treatment rooms (13.2): agree the difference (points 1 and 12).",
  "Credit due from CBS: basins and taps (Ref 10.1)": "We supply the Arezzo basins and Alberta taps; CBS connect at plumbing second fix (point 2). Ask for the credit against 10.1 (3,005 in all). A credit, so it will bring the total down.",
  "Laser supply and stop button: keep or omit (credit if omitted)": "The laser is not bought. Keep points 47 and 55 as provision, or omit them for a credit. David to decide (point 7).",
};
const V49_ARCHIVE: Record<string, string> = {
  "Reception desk power module and cable tray (CBS variation)": "Dropped in the 12 October 2026 re-issue: no longer a point to discuss, and the reception plan has a double socket at the desk wall end (note 18).",
  "Credit due from CBS: clinical fixings": "Dropped in the 12 October 2026 re-issue: the dispensers and sharps brackets are ours (point 3), and CBS's Q2002C already omits the clinical fixing sundries (ref 16), so there is no credit to ask for.",
};
const V49_WCS = { title: "WCs: replace the existing WCs and basins (to discuss, price needed)", notes: "Point 25, new in the 12 October re-issue: take out the existing WCs and basins for new ones, which we may cost in. The WC and finishes sheets still say they are kept: decide, then get CBS's price. " + V49_SRC };
const V49_PAINT_IN = { from: "Paint: inside (walls, feature blue, woodwork)", to: "Paint: inside (walls, ceilings, woodwork)", label: "Inside: walls, ceilings and woodwork", notes: "Wimborne White No. 239 on the walls (Diamond Matt; Sterishield in the treatment rooms and corridor) and the ceilings (Vinyl Matt), Railings No. 31 on the inside face of the shopfront frames, all Dulux colour matched; the door colour is to follow. The pack has no feature wall. CBS's Ref 14 covers the decoration, finishes to their advice: confirm their price includes the paint, then this line closes at £0. " + V49_SRC };
const V49_PAINT_OUT = { title: "Paint: outside (shopfront white and blue)", notes: "All White No. 2005 on the fascia and surround and Railings No. 31 on the door and window frames, Dulux colour matched, finishes to CBS's advice; both need listed building consent. CBS's Ref 17 refurbishes the shopfront: confirm their price includes the paint, then this line closes at £0. " + V49_SRC };
const V49_SHELF = { name: "Take-home shelf over the room 1 desk, made by Bill", note: "800 by 200, white, underside at 1,450, for 3 to 5 sealed take-home products; fixings into the wall (point 23). Bill makes it; materials price to come. " + V49_SRC };
const V49_HOWDENS = { name: "Howdens units and worktop: navy base, white wall, Calacatta top", from: "Who fits to agree with CBS (point 29). Price to come. " + V47_SRC, to: "Ours, not CBS's (point 3); CBS connect the sink. Price to come. " + V49_SRC };
// The finishes the pack has chosen, as options on Abi's board. Swatches are approximate.
const V49_FINISHES: { role: string; option?: { name: string; brand: string; finish: string; hex: string; note: string }; brief?: { from: string; to: string } }[] = [
  { role: "shop_main", option: { name: "All White No. 2005", brand: "Farrow & Ball, Dulux colour match", finish: "Weathershield Exterior Satin (CBS to advise)", hex: "#F3F1EA", note: "Fascia and surround. Needs listed building consent. Chosen in the 9A pack." } },
  { role: "shop_trim", option: { name: "Railings No. 31", brand: "Farrow & Ball, Dulux colour match", finish: "Weathershield Satin outside, Diamond Eggshell inside (CBS to advise)", hex: "#3B4049", note: "Door and window frames, both faces. Outside needs listed building consent. Chosen in the 9A pack." } },
  { role: "feature", brief: { from: FINISH_V38[1].to.brief, to: "Not in the 9A pack re-issued on 12 October: the walls are Wimborne White throughout, with no feature wall or moulding. Keep this only if Abi still wants one; the wall panelling line is at £0." } },
  { role: "walls", option: { name: "Wimborne White No. 239", brand: "Farrow & Ball, Dulux colour match", finish: "Diamond Matt; ceilings Vinyl Matt (CBS to advise)", hex: "#EDE9DF", note: "Walls and ceilings throughout. Chosen in the 9A pack." } },
  { role: "walls_clinical", option: { name: "Wimborne White No. 239", brand: "Farrow & Ball, Dulux colour match", finish: "Sterishield Diamond Matt (CBS to advise)", hex: "#EDE9DF", note: "Treatment rooms and corridor, wipeable. Chosen in the 9A pack." } },
  { role: "floor_clinical", option: { name: "Texas White Ash herringbone", brand: "Karndean Korlok (Howdens SDH1210)", finish: "Herringbone click LVT, 708 by 177, 6.5 mm, Class 33", hex: "#E3DBCD", note: "Every room, as reception. CBS priced clinical vinyl here (13.2): the difference is a variation to agree." }, brief: { from: FINISH_V38[4].to.brief, to: "Herringbone LVT, as reception: Karndean Korlok Texas White Ash, chosen 10 October. CBS priced clinical safety vinyl here (Ref 13.2), so the difference is a variation to agree (a plan line)." } },
  { role: "floor_front", option: { name: "Texas White Ash herringbone", brand: "Karndean Korlok (Howdens SDH1210)", finish: "Herringbone click LVT, 708 by 177, 6.5 mm, Class 33", hex: "#E3DBCD", note: "Reception, ramp, landing, corridor, lobby, utility and WCs. Chosen in the 9A pack." } },
];
async function migratePackReissueV49(projectId: number) {
  const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
  if (!phases.length) return;
  const all = await db.select().from(schema.tasksTable).where(inArray(schema.tasksTable.phaseId, phases.map(p => p.id)));
  const live = all.filter(t => !t.archived);
  const seeded = new Map(V47_BUILD.map(b => [b.title, b.notes]));
  // 1. Notes on the new numbering, while each still holds V47's note.
  for (const [title, note] of Object.entries(V49_NOTES)) {
    const t = live.find(x => x.title === title && x.notes === seeded.get(title));
    if (t) await db.update(schema.tasksTable).set({ notes: note + " " + V49_SRC, updatedAt: new Date() }).where(eq(schema.tasksTable.id, t.id));
  }
  // 2. The two dropped lines, archived while still uncosted and as V47 left them.
  for (const [title, reason] of Object.entries(V49_ARCHIVE)) {
    const t = live.find(x => x.title === title && x.notes === seeded.get(title));
    if (!t || +(t.selectedCost ?? 0) > 0 || +(t.committedCost ?? 0) > 0 || +(t.actualCost ?? 0) > 0) continue;
    await db.update(schema.tasksTable).set({ archived: true, archivedReason: reason, updatedAt: new Date() } as any).where(eq(schema.tasksTable.id, t.id));
  }
  // 3. Arundel's note no longer calls the emergency lights a gap.
  await db.execute(sql`UPDATE launch_tasks SET notes = replace(notes, 'Emergency lights and exit signs are a separate gap still to price (layout pack, point 10).', 'Emergency lights and exit signs are CBS''s, agreed verbally (point 8 in the 12 October re-issue): get it in writing.'), updated_at = NOW() WHERE title = 'Arundel fire alarm (total)' AND notes LIKE '%a separate gap still to price (layout pack, point 10)%' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
  // 4. The WCs, at £0, once, in the phase that holds CBS's lines.
  const build = live.find(t => t.title === "Arundel fire alarm (total)") ?? live.find(t => /^Ref 14 - Decoration/i.test(t.title));
  if (build && !all.some(t => t.title === V49_WCS.title)) {
    const sortOrder = all.filter(t => t.phaseId === build.phaseId).reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;
    await db.insert(schema.tasksTable).values({ phaseId: build.phaseId, title: V49_WCS.title, notes: V49_WCS.notes, owner: "David", supplier: "CBS", status: "not_started", riskLevel: "low", costTier: "low", selectedCost: 0, costVatStatus: "inc_vat", supplyScope: "to_confirm", procurementStatus: "to_specify", priority: "medium", budgetStatus: "not_set", includeInLaunchBudget: true, includeInRiskView: true, sortOrder } as any);
  }
  // 5. The paint lines: the pack's colours, and no feature blue inside.
  const seedNote = (title: string) => KIT_V38_PAINT.find(p => p.title === title)?.notes;
  const pin = live.find(t => t.title === V49_PAINT_IN.from && t.notes === seedNote(V49_PAINT_IN.from));
  if (pin) {
    await db.update(schema.tasksTable).set({ title: V49_PAINT_IN.to, notes: V49_PAINT_IN.notes, updatedAt: new Date() }).where(eq(schema.tasksTable.id, pin.id));
    await db.update(schema.kitLinesTable).set({ label: V49_PAINT_IN.label }).where(and(eq(schema.kitLinesTable.taskId, pin.id), eq(schema.kitLinesTable.label, "Inside: walls, the feature blue and woodwork")));
  }
  const pout = live.find(t => t.title === V49_PAINT_OUT.title && t.notes === seedNote(V49_PAINT_OUT.title));
  if (pout) await db.update(schema.tasksTable).set({ notes: V49_PAINT_OUT.notes, updatedAt: new Date() }).where(eq(schema.tasksTable.id, pout.id));
  // 6. Abi's board: the take-home shelf, and the Howdens units' note.
  const items = await db.select().from(schema.kitItemsTable).where(eq(schema.kitItemsTable.projectId, projectId));
  const room1 = live.find(t => /^Treatment Room Furniture/i.test(t.title));
  if (room1 && !items.some(x => x.name === V49_SHELF.name)) await db.insert(schema.kitItemsTable).values({ projectId, areaKey: "treatment", taskId: room1.id, name: V49_SHELF.name, amountGbp: 0, status: "planned", note: V49_SHELF.note } as any);
  const howdens = items.find(x => x.name === V49_HOWDENS.name && x.note === V49_HOWDENS.from);
  if (howdens) await db.update(schema.kitItemsTable).set({ note: V49_HOWDENS.to, updatedAt: new Date() }).where(eq(schema.kitItemsTable.id, howdens.id));
  // 7. The finishes: each chosen option once, chosen only where nothing is chosen yet.
  const surfaces = await db.select().from(schema.finishSurfacesTable).where(eq(schema.finishSurfacesTable.projectId, projectId));
  const options = await db.select().from(schema.finishOptionsTable).where(eq(schema.finishOptionsTable.projectId, projectId));
  for (const f of V49_FINISHES) {
    const s = surfaces.find(x => x.role === f.role);
    if (!s) continue;
    if (f.brief && s.brief === f.brief.from) await db.update(schema.finishSurfacesTable).set({ brief: f.brief.to, updatedAt: new Date() }).where(eq(schema.finishSurfacesTable.id, s.id));
    if (!f.option || options.some(o => o.surfaceId === s.id && o.name === f.option!.name)) continue;
    const order = options.filter(o => o.surfaceId === s.id).reduce((m, o) => Math.max(m, o.sortOrder), 0) + 1;
    const [opt] = await db.insert(schema.finishOptionsTable).values({ projectId, surfaceId: s.id, ...f.option, status: "idea", sortOrder: order } as any).returning();
    if (opt && s.chosenOptionId == null) await db.update(schema.finishSurfacesTable).set({ chosenOptionId: opt.id, updatedAt: new Date() }).where(eq(schema.finishSurfacesTable.id, s.id));
  }
}
async function migrateKitV38(projectId: number) {
  const areas = await db.select().from(schema.kitAreasTable).where(eq(schema.kitAreasTable.projectId, projectId));
  if (areas.some(a => a.areaKey === "paint")) return false;
  const lines = await db.select().from(schema.kitLinesTable).where(eq(schema.kitLinesTable.projectId, projectId));
  if (!lines.length) return false;
  const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
  if (!phases.length) return false;
  const tasks = await db.select().from(schema.tasksTable).where(inArray(schema.tasksTable.phaseId, phases.map(p => p.id)));
  const live = tasks.filter(t => !t.archived);
  const titleOf = new Map(tasks.map(t => [t.id, t.title]));
  const lineFor = (re: RegExp) => lines.find(l => re.test(titleOf.get(l.taskId) ?? ""));

  // 1. The decision line leaves the board; anything on it moves to the installation line.
  const decision = lineFor(/^Joinery.*Cabinetry.*Decision/i), install = lineFor(/^Joinery.*Cabinetry.*Installation/i);
  if (decision) {
    if (install) await db.update(schema.kitItemsTable).set({ taskId: install.taskId, areaKey: install.areaKey, updatedAt: new Date() }).where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.taskId, decision.taskId)));
    await db.delete(schema.kitLinesTable).where(eq(schema.kitLinesTable.id, decision.id));
  }

  // 2. The consultation room is treatment room 2.
  await db.update(schema.kitLinesTable).set({ areaKey: "treatment" }).where(and(eq(schema.kitLinesTable.projectId, projectId), eq(schema.kitLinesTable.areaKey, "consult")));
  await db.update(schema.kitItemsTable).set({ areaKey: "treatment", updatedAt: new Date() }).where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.areaKey, "consult")));

  // 3. The paint pot: two plan lines at £0, at the end of the phase that holds CBS's decoration line.
  const anchor = live.find(t => /^Ref 14 - Decoration/i.test(t.title)) ?? live.find(t => /^Wall Panelling/i.test(t.title)) ?? live.find(t => lines.some(l => l.taskId === t.id));
  if (!anchor) return false;
  let sortOrder = tasks.filter(t => t.phaseId === anchor.phaseId).reduce((m, t) => Math.max(m, t.sortOrder), 0);
  for (const p of KIT_V38_PAINT) {
    let task = live.find(t => t.title === p.title);
    if (!task) [task] = await db.insert(schema.tasksTable).values({ phaseId: anchor.phaseId, title: p.title, notes: p.notes, owner: "Abi + David", status: "not_started", riskLevel: "low", costTier: "low", selectedCost: 0, costVatStatus: "inc_vat", supplyScope: "to_confirm", procurementStatus: "to_specify", priority: "medium", budgetStatus: "not_set", includeInLaunchBudget: true, includeInRiskView: true, sortOrder: ++sortOrder }).returning();
    if (!task) continue;
    titleOf.set(task.id, task.title);
    await db.insert(schema.kitLinesTable).values({ projectId, taskId: task.id, areaKey: "paint", sortOrder: 0 }).onConflictDoNothing();
  }

  // 4. Board labels and the room order. A line the order does not name keeps its place after the rest.
  const now = await db.select().from(schema.kitLinesTable).where(eq(schema.kitLinesTable.projectId, projectId));
  const placed = new Set<number>();
  let n = 0;
  for (const spec of KIT_V38_ORDER) {
    const l = now.find(x => !placed.has(x.id) && spec.match.test(titleOf.get(x.taskId) ?? ""));
    if (!l) continue;
    placed.add(l.id);
    await db.update(schema.kitLinesTable).set({ sortOrder: ++n, label: l.label ?? spec.label }).where(eq(schema.kitLinesTable.id, l.id));
  }
  for (const l of now.filter(x => !placed.has(x.id)).sort((a, b) => a.sortOrder - b.sortOrder)) await db.update(schema.kitLinesTable).set({ sortOrder: ++n }).where(eq(schema.kitLinesTable.id, l.id));

  // 5. Area names, texts and order. The consultation room and the old shop front areas
  // have no lines now, so the page leaves them out; they sort last.
  for (const a of areas) {
    const seeded = KIT_AREAS.find(x => x.areaKey === a.areaKey);
    const order = KIT_V38_AREA_ORDER[a.areaKey];
    if (!seeded && order == null) continue;
    await db.update(schema.kitAreasTable).set({ ...(seeded ? { name: seeded.name, covers: seeded.covers } : {}), ...(order != null ? { sortOrder: order } : {}), updatedAt: new Date() }).where(eq(schema.kitAreasTable.id, a.id));
  }

  // 6. Surface texts.
  for (const f of FINISH_V38) {
    const conds = [eq(schema.finishSurfacesTable.projectId, projectId), eq(schema.finishSurfacesTable.role, f.role)];
    if (f.from.name) conds.push(eq(schema.finishSurfacesTable.name, f.from.name));
    if (f.from.brief) conds.push(eq(schema.finishSurfacesTable.brief, f.from.brief));
    await db.update(schema.finishSurfacesTable).set({ ...f.to, updatedAt: new Date() }).where(and(...conds));
  }

  // 7. The marker, last.
  await db.insert(schema.kitAreasTable).values({ projectId, areaKey: "paint", name: KIT_V38_PAINT_AREA.name, covers: KIT_V38_PAINT_AREA.covers, sortOrder: KIT_V38_AREA_ORDER.paint, budgetGbp: 0 });
  return true;
}
async function seedKit(projectId: number) {
  const existing = await db.select().from(schema.kitAreasTable).where(eq(schema.kitAreasTable.projectId, projectId));
  const have = new Set(existing.map(a => a.areaKey));
  const missing = KIT_AREAS.filter(a => !have.has(a.areaKey));
  if (missing.length) await db.insert(schema.kitAreasTable).values(missing.map(a => ({ projectId, ...a, budgetGbp: 0 })));
  return missing.length > 0;
}
async function seedKitLines(projectId: number) {
  const existing = await db.select().from(schema.kitLinesTable).where(eq(schema.kitLinesTable.projectId, projectId));
  if (existing.length > 0) return 0;
  const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));
  if (!phases.length) return 0;
  const tasks = (await db.select().from(schema.tasksTable).where(inArray(schema.tasksTable.phaseId, phases.map(p => p.id)))).filter(t => !t.archived);
  const rows: { projectId: number; taskId: number; areaKey: string; sortOrder: number }[] = [];
  KIT_LINES.forEach((l, i) => { const t = tasks.find(x => l.match.test(x.title)); if (t) rows.push({ projectId, taskId: t.id, areaKey: l.areaKey, sortOrder: i + 1 }); });
  if (rows.length) await db.insert(schema.kitLinesTable).values(rows);
  // The first version seeded items of its own; they are not attached to plan lines,
  // so clear them if untouched. Anything Abi added stays.
  const seededNames = ["Treatment couch (one in the plan; the second room has none yet)", "Stool, trolley, bins, mirrors, storage, styling", "Reception desk and clinical cabinetry (joinery allowance)", "Reception furniture and styling", "Chairs and table", "External sign, balance (deposit paid)", "Feature wall or panelling (was 500 before savings)", "Retail shelving and LED (was 750 before savings)", "Wall art, certificates, picture lighting (was 500)", "Internal signage and branding (was 500)"];
  const items = await db.select().from(schema.kitItemsTable).where(eq(schema.kitItemsTable.projectId, projectId));
  for (const it of items) if (it.taskId == null && seededNames.includes(it.name)) await db.delete(schema.kitItemsTable).where(eq(schema.kitItemsTable.id, it.id));
  return rows.length;
}

async function seedRisks(projectId: number) {
  const SEED_RISKS = [
    { riskId: "R001", title: "VAT threshold breach within 1–2 months of opening", description: "The business is already close to the £90k VAT registration threshold. Winchester revenue could push it over within weeks of opening, requiring immediate VAT registration. This would add 20% to all cosmetic treatment prices or absorb cost directly, materially affecting the financial model.", category: "Financial", likelihood: 5, impact: 4, pipelineStage: "Pre-Lease", linkedModelSection: "Financials — VAT", linkedRiskIds: ["R008", "R014"] },
    { riskId: "R002", title: "No break clause secured in lease", description: "If heads of terms are agreed without a break clause, Abi is locked into a full lease term with no exit option. If Winchester underperforms or personal circumstances change, the only exits are assignment, subletting, or surrender — all complex and costly. A break at year 3 is non-negotiable.", category: "Legal & Lease", likelihood: 3, impact: 5, pipelineStage: "Pre-Lease", linkedModelSection: "Properties — Lease Terms", linkedRiskIds: ["R003"] },
    { riskId: "R003", title: "Service charge uncapped and undisclosed", description: "Commercial leases often include variable service charges that can increase significantly year on year. If the charge is uncapped in the lease, Abi has no protection against escalation. The financial model uses a fixed monthly cost assumption that may prove materially wrong.", category: "Legal & Lease", likelihood: 3, impact: 3, pipelineStage: "Pre-Lease", linkedModelSection: "Properties — Lease Terms", linkedRiskIds: ["R002"] },
    { riskId: "R004", title: "Rateable value at £31,250 producing rates bill of £1,332/month vs £996 modelled", description: "The confirmed rateable value of 9A Jewry Street is £31,250 — above the small business rates relief threshold. The actual monthly rates bill is approximately £1,332, which is £336 higher than the £996 modelled. This difference flows directly to the bottom line and could push Winchester into loss in early months.", category: "Financial", likelihood: 4, impact: 3, pipelineStage: "Pre-Lease", linkedModelSection: "Financials — Fixed Costs", linkedRiskIds: ["R008"] },
    { riskId: "R005", title: "Listed building consent required for signage", description: "9A Jewry Street sits in Winchester City Centre Conservation Area and is adjacent to Grade II listed buildings. Any external signage is likely to require Advertisement Consent. If Listed Building Consent is also needed, the approval timeline extends significantly and the permitted design options are constrained.", category: "Legal & Lease", likelihood: 3, impact: 4, pipelineStage: "Pre-Lease", linkedModelSection: "Project Plan — Phase 1", linkedRiskIds: [] },
    { riskId: "R006", title: "Competing offers accepted before heads of terms agreed", description: "9A Jewry Street is an attractive Winchester High Street unit. Delay in instructing solicitors or stalling during due diligence could allow another party to secure the space. Once another party reaches heads of terms, re-entry to negotiate is very difficult.", category: "Strategic", likelihood: 3, impact: 5, pipelineStage: "Pre-Lease", linkedModelSection: "Decisions", linkedRiskIds: [] },
    { riskId: "R007", title: "Bedhampton soft patch during Winchester ramp removes financial bridge", description: "The model assumes Bedhampton continues generating ~£8,800/month to bridge Winchester through its ramp-up phase. A seasonal dip, client loss, or practitioner absence at Bedhampton during the critical months Oct–Dec 2026 would erode the bridge and accelerate cash depletion.", category: "Financial", likelihood: 3, impact: 4, pipelineStage: "Month 1-3", linkedModelSection: "Financials — Bedhampton", linkedRiskIds: ["R008", "R009"] },
    { riskId: "R008", title: "Winchester cold start — zero client transfer from Bedhampton", description: "The model assumes some client migration from Bedhampton to Winchester. If no existing clients are willing or able to travel, Winchester opens with zero baseline revenue and must acquire every client from cold. The ramp profile would extend by 2–4 months, significantly increasing cash burn.", category: "Market & Competition", likelihood: 5, impact: 3, pipelineStage: "Month 1-3", linkedModelSection: "Financials — Revenue Ramp", linkedRiskIds: ["R001", "R007", "R014"] },
    { riskId: "R009", title: "October 2026 cash low point — fit-out costs peak with zero Winchester revenue", description: "October 2026 is the projected cash low point: fit-out spend is at its peak while Winchester has not yet opened and generates no revenue. Bedhampton revenue alone must cover all costs. Any cost overrun or Bedhampton shortfall in this window could exhaust the runway buffer.", category: "Financial", likelihood: 5, impact: 3, pipelineStage: "Pre-Opening", linkedModelSection: "Financials — Cashflow", linkedRiskIds: ["R007"] },
    { riskId: "R010", title: "VAT treatment of aesthetics treatments not confirmed by accountant", description: "The VAT status of aesthetic treatments is complex — some qualify as exempt medical services, others are standard-rated cosmetic treatments. Without a written opinion from a healthcare-specialist accountant, there is a risk of under-collecting VAT or incorrectly exempting supplies. HMRC penalties can be retrospective.", category: "Financial", likelihood: 3, impact: 4, pipelineStage: "Pre-Lease", linkedModelSection: "Financials — VAT", linkedRiskIds: ["R001"] },
    { riskId: "R011", title: "ACV of £255 not achieved at Winchester launch", description: "The financial model uses an average client value of £255. Winchester is a new, unproven location with no existing client base. Early clients may book lower-value introductory treatments, suppressing ACV during ramp. If actual ACV comes in at £180–200, break-even recedes by 2–3 months.", category: "Financial", likelihood: 3, impact: 3, pipelineStage: "Month 1-3", linkedModelSection: "Financials — Revenue Model", linkedRiskIds: ["R008"] },
    { riskId: "R012", title: "Fit-out contractor (Abi's dad) unavailable or delayed", description: "The fit-out plan relies on Abi's father as the primary contractor for labour, saving an estimated £15,000–25,000. If he becomes unavailable due to health, competing commitments, or other reasons, a commercial contractor would need to be engaged at short notice, materially increasing costs and potentially delaying the opening date.", category: "Operational", likelihood: 2, impact: 4, pipelineStage: "Fit-Out", linkedModelSection: "Project Plan — Phase 3", linkedRiskIds: ["R009"] },
    { riskId: "R013", title: "Adverse event at Winchester with no documented SOP", description: "An adverse clinical event (e.g. vascular occlusion, anaphylaxis) at a new clinic with no documented Standard Operating Procedure, no crash kit confirmed on site, and no pre-established escalation protocol would be clinically dangerous and could result in CQC investigation, indemnity claim, or NMC referral.", category: "Clinical & Compliance", likelihood: 2, impact: 5, pipelineStage: "Pre-Opening", linkedModelSection: "Compliance", linkedRiskIds: [] },
    { riskId: "R014", title: "Abi unable to work — illness, injury, no locum plan", description: "Abi is the sole revenue-generating practitioner across both clinics. Extended absence due to illness, injury, or family emergency with no locum arrangement would immediately halt Winchester revenue and potentially Bedhampton revenue simultaneously. The model carries no locum cost assumption.", category: "Operational", likelihood: 2, impact: 5, pipelineStage: "Ongoing", linkedModelSection: "Life Design", linkedRiskIds: ["R007", "R008"] },
    { riskId: "R015", title: "School run coverage breakdown on clinic day", description: "The Life Design plan requires school run coverage on Winchester clinic days. If the agreed arrangement fails (e.g. David unavailable, childminder change), Abi may need to cancel clients at short notice. Repeat occurrences damage client retention and reputation in a cold-start location.", category: "Life Design", likelihood: 2, impact: 3, pipelineStage: "Month 1-3", linkedModelSection: "Life Design", linkedRiskIds: [] },
    { riskId: "R016", title: "Nursing exit delayed beyond October 2026", description: "The plan assumes Abi exits nursing employment by October 2026. Delayed exit extends the dual-income overlap but also delays full clinical availability at Winchester. If notice period is longer than modelled, Winchester opening days per week may be constrained during the most critical ramp months.", category: "Life Design", likelihood: 2, impact: 3, pipelineStage: "Pre-Opening", linkedModelSection: "Life Design — Nursing Exit", linkedRiskIds: ["R009"] },
    { riskId: "R017", title: "CQC registration required sooner than anticipated", description: "If Winchester's treatment scope expands to include services that trigger CQC registration (e.g. regulated medical activities), or if regulatory guidance changes, Abi may need CQC registration before opening. CQC applications typically take 3–6 months and cannot be rushed.", category: "Clinical & Compliance", likelihood: 3, impact: 4, pipelineStage: "Pre-Opening", linkedModelSection: "Compliance — CQC", linkedRiskIds: [] },
    { riskId: "R018", title: "Indemnity insurance not updated to cover Winchester before opening", description: "Abi's current Hamilton Fraser indemnity covers Bedhampton only. If Winchester opens without the policy being updated to include 9A Jewry Street as a second premises, any clinical incident at Winchester will not be covered. This must be actioned on lease completion day.", category: "Clinical & Compliance", likelihood: 2, impact: 5, pipelineStage: "Lease Signing", linkedModelSection: "Compliance — Insurance", linkedRiskIds: [] },
    { riskId: "R019", title: "Prescription record-keeping not configured before first client", description: "Human Medicines Regulations 2012 require all prescriptions to be recorded with specific fields and retained for a minimum of 2 years. If the ANS prescription module or equivalent is not configured and tested before the first client at Winchester, Abi is in technical breach from day one.", category: "Clinical & Compliance", likelihood: 2, impact: 5, pipelineStage: "Pre-Opening", linkedModelSection: "Compliance — Prescriptions", linkedRiskIds: [] },
    { riskId: "R020", title: "JCCP not registered before opening", description: "JCCP registration is a professional credibility requirement and increasingly expected by clients booking injectable treatments. Failure to register before Winchester opens means Abi cannot be listed on the JCCP register, which affects client trust and may affect insurer expectations.", category: "Clinical & Compliance", likelihood: 2, impact: 4, pipelineStage: "Pre-Opening", linkedModelSection: "Compliance — JCCP", linkedRiskIds: [] },
    { riskId: "R021", title: "Premium pricing above market median suppresses cold-start conversion", description: "Winchester's target ACV of £255 is above the median for the local aesthetics market. At cold start, with no local reputation or word of mouth, price-sensitive clients may choose established competitors offering similar treatments at lower prices. The ramp profile may be slower than modelled.", category: "Market & Competition", likelihood: 3, impact: 3, pipelineStage: "Month 1-3", linkedModelSection: "Competition Intel", linkedRiskIds: ["R008", "R011"] },
    { riskId: "R022", title: "Competitor aggressive promotion targeting same demographic at launch", description: "A competitor clinic in Winchester could respond to Abi's launch with aggressive promotional activity — discounting, launch offers, or targeted social media spend — to retain clients who might otherwise transfer. This is particularly likely if a local competitor perceives Winchester as a direct threat.", category: "Market & Competition", likelihood: 2, impact: 3, pipelineStage: "Month 1-3", linkedModelSection: "Competition Intel", linkedRiskIds: ["R008"] },
  ];

  await db.insert(schema.risksTable).values(
    SEED_RISKS.map(r => ({ ...r, projectId, source: "Seed", status: "Not Started" }))
  );
}

async function seedBacklinks(projectId: number) {
  await db.insert(schema.backlinkOpportunitiesTable).values(
    BACKLINK_OPPORTUNITIES.map(o => ({
      projectId,
      rank: o.rank,
      priority: o.priority,
      category: o.category,
      website: o.website,
      domain: o.domain,
      why: o.why,
      competitors: o.competitors,
      groups: [...o.groups],
      cost: o.cost,
      applyUrl: o.applyUrl,
      infoNeeded: o.infoNeeded,
      template: o.template,
      // The workbook already carried a status for some rows (Winchester BID
      // awaiting a reply, Obagi in progress). Keep them rather than resetting.
      status: o.status,
      owner: o.owner,
      notes: o.notes,
    }))
  );

  await db.insert(schema.backlinkListingPackTable).values(
    BACKLINK_LISTING_PACK.map(p => ({
      projectId,
      section: p.section,
      field: p.field,
      value: p.value,
      remaining: p.remaining,
      status: p.status,
      sortOrder: p.sortOrder,
    }))
  );

  await db.insert(schema.backlinkTemplatesTable).values(
    BACKLINK_TEMPLATES.map(t => ({
      projectId,
      templateId: t.templateId,
      use: t.use,
      wording: t.wording,
    }))
  );
}

const PHASES = [
  {
    name: "Phase 1 — Pre-lease due diligence",
    description: "Legal, planning, and financial checks before signing anything",
    sortOrder: 1,
    tasks: [
      { title: "Confirm Use Class E(e) — pre-app enquiry to Winchester City Council", owner: "David", riskLevel: "medium", costLow: 0, costMid: 100, costHigh: 250, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "E(e) covers medical/health services. Pre-app enquiry to WCC planning dept costs £100-250. If Use Class is wrong, lease is worthless. Ring WCC planning before any other action." },
      { title: "Search WCC Public Access — s.106, conditions, Article 4 Directions", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Free. Check for s.106 obligations, planning conditions on the building, any Article 4 Directions removing permitted development rights. WCC Public Access portal." },
      { title: "Check rateable value — gov.uk/find-business-rates (RV £31,250 confirmed)", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "RV £31,250 confirmed = rates bill £15,437/yr before any relief. Winchester small business rates relief does NOT apply above £15k RV. Rates cannot be negotiated — baked into business case." },
      { title: "Commercial property solicitor — lease negotiation and exchange", owner: "Solicitor", riskLevel: "high", costLow: 1200, costMid: 2200, costHigh: 3500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 28, notes: "Hampshire-based commercial property solicitor with healthcare/FRI lease experience. Goadsby are the agents — do NOT use their recommended solicitor. Get 3 quotes. Budget £2,200 mid." },
      { title: "RICS Schedule of Condition — must be annexed before signing (FRI lease)", owner: "RICS Surveyor", riskLevel: "high", costLow: 600, costMid: 950, costHigh: 1500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "FRI lease = Abi responsible for ALL repairs including pre-existing defects. Schedule of Condition annexe limits liability to condition at lease start. Without it, dilapidations bill at exit could be enormous." },
      { title: "Fit-out drawings for Licence for Alterations", owner: "David", riskLevel: "medium", costLow: 0, costMid: 200, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "Landlord needs drawings showing proposed partition, basin positions, drainage route, signage fixings before granting Licence for Alterations. David can draw in SketchUp — £0 if self-drawn, £200-800 if CAD technician needed." },
      { title: "Advertisement Consent — conservation area shopfront sign", owner: "David", riskLevel: "high", costLow: 174, costMid: 400, costHigh: 700, isNonNegotiable: true, isCriticalRisk: true, durationDays: 56, notes: "9A Jewry Street is in Winchester City Centre Conservation Area. Advertisement Consent required for most external signage. WCC fee £174 for most ad consent applications. 8-week determination period. Apply simultaneously with lease heads of terms." },
      { title: "Listed Building Consent check — 28a Jewry Street Grade II listed", owner: "David", riskLevel: "high", costLow: 0, costMid: 100, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "28a Jewry Street is Grade II listed. Confirm whether 9A shares any fabric with it. If yes, any works affecting the listed structure need Listed Building Consent — a separate application from planning and advertisement consent." },
      { title: "Book BAFE SP205 fire risk assessor", owner: "David", riskLevel: "medium", costLow: 350, costMid: 475, costHigh: 600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Book now — assessor needs to return post fit-out for the formal assessment. Getting on their books early avoids delay before opening. BAFE SP205 accredited only — required by Hamilton Fraser. Bundle Phase 1 booking + Phase 5 assessment for best price." },
      { title: "Negotiate Heads of Terms with Goadsby", owner: "Abi + David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 14, notes: "Key terms to nail: rent-free period (target 3-6 months for fit-out), break clause at year 3, cap on service charge, landlord contribution to fit-out, right to sublease/assign, Licence for Alterations pre-agreed. Do NOT sign heads of terms until solicitor has reviewed." },
      { title: "DBS check — enhanced disclosure for Abi", owner: "Abi", riskLevel: "low", costLow: 38, costMid: 38, costHigh: 38, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "£38 enhanced DBS. Required for JCCP, Save Face and Hamilton Fraser. Takes 1-3 weeks. Start immediately — do not let this hold up registration." },
      { title: "Check local authority licensing — Health and Care Act 2022", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Confirm Winchester City Council licensing requirements for non-surgical cosmetic procedures. DHSC national licensing scheme launches 2027 but some LAs have interim requirements. Call WCC licensing dept." },
      { title: "Measured building survey", owner: "Dad / RICS Surveyor", riskLevel: "low", costLow: 0, costMid: 350, costHigh: 900, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Dad can manually measure initially — free and sufficient for fit-out drawings and Licence for Alterations. Upgrade to RICS measured survey only if build complexity increases (e.g. structural changes, landlord requires certified drawings). RICS measured survey £350-900 depending on scope." },
      { title: "Accessibility / DDA review", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2, notes: "Potential hidden compliance risk — Equality Act 2010 applies to all service providers. Pre-lease: walk the unit and consider step access, corridor widths (minimum 900mm), door widths (850mm clear), toilet access. A minor DDA issue can become expensive if raised post-lease by a complaint or CQC inspection. Commission a brief access consultant review at £150 or use RIBA-registered architect. Discuss with solicitor." },
      { title: "Exit strategy and break clause review", owner: "David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "The safest operators plan exits before signing. Before exchanging: confirm break clause date and notice period (typically month 18 or 24, 6-12 months notice), assignment rights (can the lease be sold?), subletting rights (can space be sublet to a room-rental practitioner?), minimum viable survival date (revenue at which you can sustain without Bedhampton). Survival plan: if Winchester fails after 12 months, what is the exit cost? Insist solicitor summarises these in plain English." },
    ],
  },
  {
    name: "Phase 2 — Lease signing & immediate actions",
    description: "Actions to complete on the day of or within 48 hours of lease exchange",
    sortOrder: 2,
    tasks: [
      { title: "Exchange and complete lease — Schedule of Condition annexed, VAT on rent confirmed nil", owner: "Solicitor + Abi", riskLevel: "high", costLow: 2708, costMid: 5854, costHigh: 9000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Cost = first month rent £2,708 + legal fees £2,200 + SDLT if applicable. CONFIRM VAT on rent is zero-rated or exempt BEFORE signing — if landlord charges VAT, adds £541/month. Deposit typically 3 months rent = £8,124 negotiable." },
      { title: "Submit Building Regulations Building Notice to Winchester Building Control", owner: "David", riskLevel: "high", costLow: 300, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "Required before any structural or drainage works begin. Building Notice route (not Full Plans) — faster, no drawings approval wait. Fee £300-500 depending on works value. Do NOT start fit-out before Building Notice is submitted." },
      { title: "Pay ICO data protection fee — register as Data Controller", owner: "David", riskLevel: "high", costLow: 47, costMid: 47, costHigh: 52, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "£47/year tier 1 (under 10 staff, under £632k turnover). Tier 2 = £97. Legal requirement on Day 1 of processing patient data. ICO can fine up to £17.5m for unregistered processing. ico.org.uk — 5 minutes online." },
      { title: "Open business bank account for Winchester", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 120, isNonNegotiable: false, isCriticalRisk: false, durationDays: 5, notes: "Separate account for Winchester revenue makes accounts and tax cleaner. Tide or Starling free. Lloyds/Barclays business = £6-10/month. Consider whether Bedhampton account can just track Winchester as a cost centre instead." },
      { title: "Notify utilities — electricity, water, broadband at 9A Jewry Street", owner: "David", riskLevel: "medium", costLow: 0, costMid: 100, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Take meter readings on key handover day. Notify electricity supplier of business occupancy. Check water supply capacity for two clinical basins. Business broadband: £40-70/month — order 2-3 weeks before fit-out completes." },
      { title: "Hamilton Fraser — update indemnity and add premises insurance", owner: "Abi", riskLevel: "high", costLow: 1500, costMid: 2000, costHigh: 2500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Call Hamilton Fraser on lease completion day. Add 9A Jewry Street as second premises. Update treatment list for Winchester. Hamilton Fraser is Hamilton Fraser — they understand aesthetics. £167/month ongoing (included in financial model)." },
      { title: "Instruct healthcare specialist accountant", owner: "David", riskLevel: "medium", costLow: 1800, costMid: 2400, costHigh: 3600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "Healthcare specialist — NOT a general high street accountant. Understands VAT exemption on medical vs cosmetic treatments, PAYE for Abi as director, MTD. Budget £150-200/month ongoing. Worth every penny at VAT registration threshold." },
      { title: "Apply for Licence for Alterations — partition, clinical basins, signage fixings", owner: "Solicitor + David", riskLevel: "high", costLow: 400, costMid: 600, costHigh: 800, isNonNegotiable: true, isCriticalRisk: true, durationDays: 42, notes: "Submit immediately — landlord approval can take 4-6 weeks and FIT-OUT CANNOT START until Licence for Alterations is granted. Include Dad's fit-out drawings. Solicitor drafts licence — £400-800 in fees." },
      { title: "Register for business rates — WCC move-in notification", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Notify WCC Revenues within 7 days of occupation — legal requirement. RV £31,250 = £15,437/year rates (£995/month after 2025 relief). No small business relief. Business rates are a Day 1 liability." },
      { title: "Companies House — update registered office if needed", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Free. Update registered office to Winchester or keep accountant address. Must be updated within 14 days of any change." },
      { title: "Set up medical device inventory log — MHRA 2026 requirement", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Free — spreadsheet or ANS module. MHRA Medical Device Regulations 2026 will require device tracking. Log: device name, manufacturer, model, serial, purchase date, service history, location. Start now — easier than retrofitting." },
      { title: "Prescription record-keeping system — Human Medicines Regulations 2012", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Every prescription issued at Winchester must be: dated, patient name/address, medication, strength, dose, quantity, Abi's name/address/signature, NMC PIN. Records kept minimum 2 years. ANS has prescription pad module — configure on Day 1." },
      { title: "Legionella risk assessment", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 350, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Sensible for any clinic with sinks and a hot water system. L8 ACOP requires assessment where there is a risk of Legionella exposure. Two clinical basins plus kitchenette bring this into scope. Book a UKAS-accredited assessor — written risk assessment plus control scheme. Review annually." },
      { title: "Air conditioning inspection/service", owner: "David", riskLevel: "medium", costLow: 0, costMid: 250, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Important hidden-risk item under FRI lease. Under an FRI lease, Abi is responsible for maintaining any existing air conditioning units. Check whether units are present, obtain service history from landlord, and arrange F-Gas inspection and service before taking occupation. Neglected AC units can be expensive to repair or replace." },
      { title: "PAT testing setup", owner: "David", riskLevel: "low", costLow: 0, costMid: 80, costHigh: 200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Minimal equipment initially — defer PAT testing until clinic is operational and equipment is in place. Once treatment couches, lighting and equipment are installed, arrange PAT testing of all portable appliances. Low risk at outset but required before clinic opens to patients. £80-200 depending on number of items." },
      { title: "Alarm / CCTV / security setup", owner: "David", riskLevel: "high", costLow: 300, costMid: 1200, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5, notes: "Winchester town centre — missing from most clinic launches. Required: intruder alarm (NSI/SSAIB-certified, likely required by insurer), CCTV covering entrance and waiting area (ICO registration £40/year, must display signage under GDPR), smart lock or keyfob system for access control, fire alarm links if not landlord-provided. Check FRI lease: security may be your responsibility. Budget MID £1,200 for alarm + 2 cameras + installation. Get quotes before lease exchange." },
    ],
  },
  {
    name: "Phase 3 — Fit-out works",
    description: "Dad does the labour — costs shown are materials only throughout",
    sortOrder: 3,
    tasks: [
      { title: "Day 1 site meeting — measure all dimensions, confirm soil pipe location", owner: "Dad + David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Measure every room. Locate existing soil pipe and drainage outlet — basin drainage runs to this. Identify electrical consumer unit, existing socket positions, floor condition under any existing coverings. Photograph everything before starting." },
      { title: "Pre-notify Southern Water — Water Fittings Regulations 1999", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Notify Southern Water at least 5 working days before any new water fitting installation. Free. Required by Water Fittings Regulations 1999 for any new connection. Southern Water will inspect on request." },
      { title: "Party Wall notices to neighbours if drilling into shared wall", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "If any fixings penetrate or affect a shared wall with neighbouring properties: Party Wall Act 1996 notice required. 14-day response period. If neighbours appoint a surveyor, costs escalate to £500-2000. Check during Day 1 site visit." },
      { title: "STEP 1 — Strip-out: clear treatment zone, mark cable runs and pipe routes", owner: "Dad", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Labour: Dad (free). Materials: nil. Clear existing fitments per Schedule of Condition. Mark positions of all proposed cable runs and pipe routes in permanent marker on walls before first-fix starts." },
      { title: "STEP 2 — Metal stud framing: partition walls and right-side corridor", owner: "Dad", riskLevel: "medium", costLow: 280, costMid: 415, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: steel studs, track, noggins, fixings. Both treatment room partitions + corridor wall. Allow for FD30 door frames in partition positions. Materials cost only." },
      { title: "STEP 3 — First-fix electrical: 20A circuits, emergency lighting, sockets", owner: "Qualified electrician", riskLevel: "high", costLow: 1100, costMid: 1550, costHigh: 2000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "MUST be Part P qualified — Dad cannot do notifiable electrical work. Separate 20A circuit each treatment room (couch, equipment). Emergency lighting circuits. Extra double sockets. EIC issued on completion." },
      { title: "STEP 4 — First-fix plumbing: supply runs to both clinical basins", owner: "Dad", riskLevel: "high", costLow: 450, costMid: 700, costHigh: 850, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Labour: Dad (free). Materials: copper/pushfit pipe, fittings, isolation valves. Hot and cold supply to both treatment room positions. Waste run to soil pipe. TMV3 thermostatic mixing valve required — clinical standard max 41°C." },
      { title: "STEP 5 — Plasterboard, tape, joint, skim coat", owner: "Dad", riskLevel: "low", costLow: 240, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: 12.5mm moisture-resistant plasterboard, joint tape, joint compound, finish plaster. Smooth finish required for clinical vinyl coving. Allow 48hrs drying before painting." },
      { title: "STEP 6 — FD30 fire doors and linings × 2 treatment rooms", owner: "Dad", riskLevel: "high", costLow: 600, costMid: 850, costHigh: 1000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Labour: Dad (free). Materials: 2 × FD30 fire door sets with frame, intumescent strips, smoke seals, closers, ironmongery. FD30 required under Building Regs for clinical rooms off escape corridor. MUST have cold smoke seals + intumescent strips fitted correctly." },
      { title: "STEP 7 — Second-fix electrical: accessories, commissioning, EIC", owner: "Qualified electrician", riskLevel: "high", costLow: 300, costMid: 400, costHigh: 500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Part P qualified. Install socket plates, switches, luminaires. Commission emergency lighting. Test and issue Electrical Installation Certificate. EIC must be given to WCC Building Control for Completion Certificate." },
      { title: "STEP 8 — Second-fix plumbing: basins, TMV3 commissioning, waste connections", owner: "Dad", riskLevel: "high", costLow: 200, costMid: 250, costHigh: 300, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Labour: Dad (free). Materials: 2 × clinical wash basins with shrouded pedestals, TMV3 thermostatic valves, lever taps, clinical soap dispensers, paper towel dispensers. TMV3 must be commissioned and flow-tested to confirm max 41°C." },
      { title: "STEP 9 — Clinical vinyl flooring: both treatment rooms (welded seams, 100mm coving)", owner: "Specialist vinyl fitter", riskLevel: "high", costLow: 1200, costMid: 1500, costHigh: 1800, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "Tarkett iQ Granit or Polyflor Expona. Must be specialist fitter — welded seams and 100mm integral coving are not DIY. Coved skirting eliminates floor-wall junction where pathogens accumulate. IPC requirement. Cannot be laid until plasterboard is finished and dry." },
      { title: "STEP 10 — Bespoke reception desk (Dad builds)", owner: "Dad", riskLevel: "low", costLow: 500, costMid: 750, costHigh: 1000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Labour: Dad (free). Materials: MDF carcass, hardwood edging, laminate top, drawer runners, fixings. Dad to build off-site and deliver as finished unit. Saves approx £1,500-3,000 vs commercial reception desk suppliers." },
      { title: "STEP 11 — Treatment room cabinetry × 2, lockable POM cupboard (Dad builds)", owner: "Dad", riskLevel: "low", costLow: 600, costMid: 1000, costHigh: 1200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 4, notes: "Labour: Dad (free). Materials: MDF, hinges, handles, laminate, lockable hasp for POM cupboard. POM (prescription-only medicines) storage must be lockable — regulatory requirement. Dad builds both treatment room wall units and POM cupboard." },
      { title: "STEP 12 — Antimicrobial paint: treatment rooms and corridor (Dad paints)", owner: "Dad", riskLevel: "low", costLow: 180, costMid: 300, costHigh: 400, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Labour: Dad (free). Materials: Dulux Sterishield or similar antimicrobial emulsion. Treatment rooms and corridor only. Antimicrobial paint required by IPC Policy. Standard emulsion in reception. 2 coats. Allow 4hrs between coats." },
      { title: "STEP 13 — External shopfront signage (ONLY after Advertisement Consent)", owner: "Sign company", riskLevel: "high", costLow: 600, costMid: 1350, costHigh: 2500, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "DO NOT ORDER until Advertisement Consent is granted. Conservation area — consent required for most signs. Brief sign company simultaneously with ad consent application so they are ready to fabricate and fit the day consent lands. Budget mid £1,350." },
      { title: "STEP 14 — Deep clean to clinical standard before equipment arrives", owner: "Clinical cleaning company", riskLevel: "high", costLow: 0, costMid: 175, costHigh: 300, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Professional clinical clean after all construction dust settles and before any equipment is moved in. Surface sampling available if needed for CQC/Save Face inspection preparation." },
      { title: "STEP 15 — Professional photography of completed clinic", owner: "David", riskLevel: "low", costLow: 350, costMid: 575, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Book photographer for the morning after deep clean — before any equipment or stock is moved in for cleanest shots. Use for website, Google Business Profile, Instagram launch content. Budget £575 for 2-3 hours." },
      { title: "Building Regulations Completion Certificate — final inspection", owner: "Winchester Building Control", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "WBC inspect and issue Completion Certificate. Required before clinic opens — no legal occupation of altered space without it. Book inspection immediately after STEP 14 (deep clean). EIC from electrician must be submitted with inspection request." },
      { title: "Treatment couches × 2 — order early, deliver after flooring", owner: "Abi", riskLevel: "medium", costLow: 2438, costMid: 2900, costHigh: 4000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 21, notes: "Order at Phase 2 — 3-6 week lead time. Delivery timed after vinyl flooring is complete. Beauty Express Diva at £1,219 each = £2,438. Electric preferred for Profhilo and skin treatments. Couch dimensions must be confirmed before Dad builds cabinetry." },
      { title: "Baseline photography protocol — standardised pre-treatment photos for every patient", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 30, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Standard lighting, distance, angles for every treatment area. Ring light + phone mount = £30. Consistent baseline photos are required by Save Face, JCCP and Hamilton Fraser. Protects Abi from complaints about pre-existing conditions." },
      { title: "Skip hire / waste removal", owner: "Dad + David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 700, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Very commonly forgotten fit-out cost. Strip-out rubble, plasterboard offcuts, old fitments and packaging all need removing. Order a skip before strip-out begins — 6-yard skip typically £250-400 in Winchester. Check with landlord that a skip can be placed outside. Budget MID £250." },
      { title: "Contingency for hidden building issues", owner: "David", riskLevel: "high", costLow: 0, costMid: 1000, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "You should absolutely carry a contingency buffer on an older commercial unit. Common hidden issues in period Jewry Street buildings: asbestos in ceiling tiles or floor adhesive (survey required if pre-2000 build), substandard previous electrics, inadequate drainage falls, damp behind existing linings. Budget MID £1,000 minimum — do not spend this unless needed." },
      { title: "Additional AC unit if required — HVAC contingency", owner: "David", riskLevel: "high", costLow: 0, costMid: 2500, costHigh: 6000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "One of the biggest hidden commercial-unit costs. The AC inspection (Phase 2) will determine if existing HVAC is adequate. If not: injectables rooms must stay below 20°C (toxins degrade faster in heat), Winchester clients expect premium comfort, FRI lease likely makes AC your responsibility. A multi-split system for a 2-room clinic: £2,500-4,500 supply and install. Do not commit to this budget until post-inspection. Budget LOW (£0) until inspection confirms gap." },
    ],
  },
  {
    name: "Phase 4 — Regulatory & professional registrations",
    description: "All professional registrations and compliance steps before opening",
    sortOrder: 4,
    tasks: [
      { title: "JCCP Practitioner Register — apply online", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 14, notes: "FREE since 2025 — fees abolished. Upload: NMC PIN, qualifications, indemnity, BLS certificate, premises declaration. 2-4 weeks. DHSC licensing will require JCCP from 2027." },
      { title: "Save Face registration — online application, Zoom clinic assessment", owner: "Abi", riskLevel: "medium", costLow: 500, costMid: 700, costHigh: 900, isNonNegotiable: true, isCriticalRisk: false, durationDays: 42, notes: "PSA-accredited, NHS-signposted. 45-min Zoom clinic assessment. 4-8 weeks end to end. 200+ policy templates included. Winchester clients search Save Face before booking." },
      { title: "Allergan Direct — register 9A Jewry Street delivery address", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Botox/Juvéderm cannot be delivered until Winchester address registered. 1-2 weeks credentialing. Notify Allergan Practitioner Pathway team at same time." },
      { title: "Galderma/Azzalure — register Jewry Street delivery address", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Same process as Allergan. 1-2 weeks. Bundle with Allergan admin — same week." },
      { title: "Derma Focus (Polynucleotides) — register Jewry Street", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Update delivery address from Bedhampton." },
      { title: "NMC face-to-face prescribing SOP — written procedure for Winchester", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "NMC rule from 1 June 2025: every prescribing episode must follow face-to-face at Winchester premises. Use Save Face SOP templates on registration." },
      { title: "Clinic management software — check ANS plan first then Pabau", owner: "David", riskLevel: "medium", costLow: 0, costMid: 660, costHigh: 1800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "CHECK ANS PLAN FIRST — many plans allow multiple locations free. Defer Pabau to Month 3 if ANS works. Pabau recommended if ANS cannot handle batch tracking." },
      { title: "ACE membership — confirm it covers Winchester location", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 200, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Call ACE before paying anything. Most professional body memberships cover practitioner at any premises." },
      { title: "Allergan Practitioner Pathway — notify of Winchester commercial premises", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Update records. Ask about BDM support and training for Winchester launch. Key differentiator — Abi was scouted." },
      { title: "VAT registration — when rolling 12-month taxable turnover approaches £85k", owner: "Accountant + David", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Combined Bedhampton + Winchester approaches threshold months 6-9. No VAT on rent confirmed. Cosmetic treatments standard-rated 20% once registered." },
      { title: "CPD documentation log — set up and start immediately", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Required for DHSC licensing 2027. Log all training, Level 7 progress, BLS renewals. Insurers and JCCP will request." },
      { title: "Complaints and incident log — set up before opening", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Date, patient, treatment, what happened, action, outcome, learning. Review quarterly. Use Save Face template provided on registration." },
      { title: "Batch number and traceability log — every injectable", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Product, batch number, expiry, volume, site per treatment. Required for MHRA product recall tracing. Make batch number mandatory in ANS — 10 mins to configure." },
      { title: "Save Face corrective actions contingency", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 300, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 14, notes: "Occasionally Save Face requests minor clinic changes after the Zoom inspection before granting accreditation — e.g. additional signage, a missing policy document, a physical change to the clinic layout. Budget LOW (£0) initially but hold £300 in reserve. Most clinics pass first time; corrective actions are minor when they occur." },
      { title: "Policy printing/binding/compliance folders", owner: "David", riskLevel: "low", costLow: 50, costMid: 150, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Small but realistic operational cost often forgotten. IPC policy, adverse event protocol, COSHH assessments, sharps policy, fire risk assessment, complaints log and consent SOPs all need to be printed, bound and accessible in the clinic. Budget LOW £50 for basic folders and printing — upgrade to professional binding at £150 if Save Face inspection is imminent." },
      { title: "Fridge temperature monitoring system", owner: "David", riskLevel: "medium", costLow: 30, costMid: 120, costHigh: 350, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Worth doing properly for injectables compliance and insurer expectations. Botox, Azzalure and Profhilo must be stored at 2-8°C. A basic min/max thermometer at £30 meets the minimum requirement. A Bluetooth data logger with app alerts (e.g. Govee or Inkbird) at £60-120 is far better — provides continuous audit trail Hamilton Fraser and JCCP will expect to see. Do not rely on a domestic fridge without a verified thermometer." },
      { title: "Cold chain compliance SOP — backup thermometer and power failure procedure", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 50, costHigh: 200, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Temperature logging alone is not enough — you need a written SOP. Contents: daily fridge check log (min/max temp), backup digital thermometer (calibrated, in drawer), power outage procedure (if fridge loses power for >4 hours, quarantine stock and contact manufacturer), what to do with stock if temperature exceeds 8°C. Hamilton Fraser and Save Face both expect to see cold chain controls documented. Free to write, £30-50 for a calibrated backup thermometer." },
    ],
  },
  {
    name: "Phase 5 — Clinical governance & health and safety",
    description: "Written policies, emergency kit, and clinical safety systems",
    sortOrder: 5,
    tasks: [
      { title: "IPC Policy — written document for 9A Jewry Street", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "WHO 5 Moments hand hygiene, PPE, surface decontamination, single-use injectables, spillage, sharps, waste. Adapt Save Face template for two treatment rooms, kitchenette, no on-site sterilisation." },
      { title: "Adverse Event Protocol — VO, anaphylaxis, vasovagal — written before Day 1", owner: "Abi", riskLevel: "high", costLow: 80, costMid: 100, costHigh: 120, isNonNegotiable: true, isCriticalRisk: true, durationDays: 2, notes: "MUST be in writing before first patient. VO: hyalase, massage, A&E escalation. Anaphylaxis: adrenaline 0.5mg IM, 999. Hyalase × 2 + WFI. Cost = hyalase stock." },
      { title: "Emergency drugs and equipment kit", owner: "Abi", riskLevel: "high", costLow: 150, costMid: 200, costHigh: 250, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Basic kit: hyalase × 2, adrenaline × 2, chlorphenamine, hydrocortisone, saline × 2. Check expiry monthly and document. Required by Hamilton Fraser and JCCP." },
      { title: "COSHH risk assessments for all substances used", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Chlorhexidine, IPA, sodium hypochlorite, peels. Hazard, exposure, controls, PPE per product. Use HSE COSHH online tools. Get SDS from each supplier." },
      { title: "Sharps Safety Policy", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "No recapping. Immediate disposal at point of use. RIDDOR reporting if injury. Use HSE sharps policy template." },
      { title: "Fire Risk Assessment — full written document post fit-out", owner: "Fire assessor + Abi", riskLevel: "high", costLow: 350, costMid: 475, costHigh: 600, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "RRFSO 2005 + Building Safety Act 2022. Must reflect as-built layout. Bundle with Phase 1 booking for best price. Review annually." },
      { title: "Clinical waste contract — set up with licensed carrier", owner: "Abi + David", riskLevel: "high", costLow: 420, costMid: 570, costHigh: 720, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Initial Medical 0800 093 5892. Yellow: medicinal sharps. Orange: non-medicinal. Start monthly — upgrade when volume grows." },
      { title: "Consent forms and questionnaires — configured for Winchester", owner: "Abi", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 2, notes: "Use existing ANS templates. Update address to 9A Jewry Street. Each treatment: medical history, informed consent, aftercare, SEPARATE photo consent." },
      { title: "Business Continuity Plan — income protection and locum plan", owner: "David", riskLevel: "medium", costLow: 480, costMid: 540, costHigh: 600, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "If Abi cannot work: zero revenue plus £3,703/month in fixed costs. £40-45/month income protection. Document locum nurse-prescriber contact (commission-only)." },
      { title: "Opening injectable stock — Botox, Azzalure, fillers, Profhilo", owner: "Abi", riskLevel: "high", costLow: 3500, costMid: 4250, costHigh: 5000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 7, notes: "Order once Winchester address credentialed. Fridge 2-8°C. Document temperature daily. Lean: 8-10 toxin vials, 15 filler syringes, 3 Profhilo boxes. Every Botox vial at £173 trade generates £215+ revenue." },
      { title: "Delegation and supervision policy", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Required even as solo practitioner. Include escalation pathway and cover-during-absence plan. Save Face template covers this." },
      { title: "BLS certification — confirm current within 12 months", owner: "Abi", riskLevel: "high", costLow: 0, costMid: 80, costHigh: 150, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "Check existing BLS cert first — if current: £0. Red Cross half-day at £80. Hamilton Fraser, Save Face and JCCP all require BLS current within 12 months." },
      { title: "Medical fridge with min/max logging", owner: "Abi", riskLevel: "high", costLow: 150, costMid: 350, costHigh: 800, isNonNegotiable: true, isCriticalRisk: false, durationDays: 7, notes: "Worth doing properly for injectables and compliance. A dedicated medical-grade fridge (not domestic) is best practice — consistent 2-8°C, lockable, no freezer compartment. Lec or Shoreline medical fridges £350-600. Pair with the Bluetooth temperature data logger (Phase 4) for a complete audit trail. Do not store food or non-clinical items in the same fridge." },
      { title: "Sharps bins / clinical consumables startup", owner: "Abi", riskLevel: "high", costLow: 100, costMid: 250, costHigh: 600, isNonNegotiable: true, isCriticalRisk: true, durationDays: 3, notes: "Often forgotten operational startup cost. Yellow-lidded UN3291 sharps containers, orange clinical waste bags, clinical waste bin liners, sharps bin wall brackets. Order before first patient day — cannot operate without compliant sharps disposal. Initial stock for 3 months. Ties into clinical waste contract set up in this phase." },
      { title: "Initial PPE / cleaning consumables", owner: "Abi", riskLevel: "medium", costLow: 80, costMid: 180, costHigh: 450, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Realistic first-month consumables setup. Nitrile gloves (boxes), aprons, face shields, IPA wipes, chlorhexidine, surface disinfectant spray, clinical paper roll, hand sanitiser dispensers × 2, paper towels. Order 4-6 weeks before opening — some clinical suppliers have minimum order values. Budget MID £180 for first stock." },
      { title: "Staff/locum onboarding contingency", owner: "David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 1000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Only relevant if bringing in a second practitioner or locum nurse-prescriber early. Costs: DBS check £38, induction time, uniform if applicable, ANS/system access setup. If Abi is solo at launch (most likely), this is £0. Keep £250 in reserve in case a locum is needed to cover illness in the first 3 months." },
      { title: "Staffing and scaling model — second injector and room rental plan", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Document now even if deferred. Scaling options: (1) Self-employed nurse-prescriber room rental at £150-300/day — lowest risk, adds income without payroll; (2) Second employed injector — adds £30,000+ cost but allows growth; (3) Receptionist/clinic coordinator — add when revenue consistently exceeds £8,000/month. Model: at what monthly revenue does each hire become viable? Document locum nurse-prescriber contacts for illness cover. Review at 6 months post-launch." },
    ],
  },
  {
    name: "Phase 6 — Finance & business admin",
    description: "Accounting, payments, and business administration setup",
    sortOrder: 6,
    tasks: [
      { title: "Accounting software — Xero or QuickBooks", owner: "David", riskLevel: "medium", costLow: 180, costMid: 300, costHigh: 420, isNonNegotiable: true, isCriticalRisk: false, durationDays: 3, notes: "Xero Starter £15/month × 12. MTD from 2026/27 requires digital records. Start on Starter at £15/month — upgrade only when VAT registration kicks in." },
      { title: "Card payment terminal for Winchester", owner: "David", riskLevel: "low", costLow: 29, costMid: 89, costHigh: 149, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "SumUp Air at £29 — 1.69% per transaction, no monthly fee. Separate terminal from Bedhampton. Configure for 20% VAT once registered." },
      { title: "Klarna — set up Winchester as additional location", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Already using at Bedhampton. Add Winchester location. Valuable for Profhilo courses (£515), filler courses, Skinvive." },
      { title: "Receipt printer / POS accessories", owner: "David", riskLevel: "low", costLow: 0, costMid: 120, costHigh: 400, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Not needed at launch if digital receipts are sufficient — most patients are happy with an emailed receipt from ANS or SumUp. If physical receipts are preferred: Star Micronics mPOP at £250 or basic thermal printer at £60-120. Defer until operational and patient feedback confirms it is needed." },
      { title: "iPad/tablet for clinic operations", owner: "David", riskLevel: "medium", costLow: 0, costMid: 450, costHigh: 1200, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "A dedicated clinic iPad becomes very useful operationally — ANS booking system, consent forms, patient photos, temperature logging app, card payments. iPad 10th gen at £349-449 refurbished. Do not use a personal device for patient data — GDPR and Hamilton Fraser both require data to be stored securely on clinic-controlled equipment." },
      { title: "Backup internet / mobile hotspot", owner: "David", riskLevel: "low", costLow: 0, costMid: 60, costHigh: 250, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Can use phone hotspot at launch — sufficient for card payments and ANS if broadband drops. Dedicated 4G/5G router with SIM (e.g. Vodafone Business Connect at £20-30/month) is a cleaner solution once established. Budget LOW (£0) at launch; upgrade if broadband reliability proves to be an issue in the first month." },
      { title: "Cyber/data security contingency", owner: "David", riskLevel: "low", costLow: 0, costMid: 150, costHigh: 600, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Existing systems likely sufficient early-stage — ANS and GHL both have their own security. Key actions at zero cost: enable 2FA on all clinic accounts, use strong unique passwords (1Password free tier), ensure laptop has full-disk encryption. Budget LOW (£0) initially; upgrade to Cyber Essentials certification (£300-600) only when patient volume justifies it." },
      { title: "Operating cashflow reserve buffer", owner: "David", riskLevel: "high", costLow: 10000, costMid: 20000, costHigh: 40000, isNonNegotiable: true, isCriticalRisk: true, durationDays: 1, notes: "This is the most important missing strategic line item. The REAL risk is not the fit-out budget — it is cashflow pressure after opening. Abi stops nursing income, rent and rates are fixed from day 1, Winchester ramp takes 3-6 months, seasonality (August and January are slow). Minimum survivable buffer: £10,000. Realistic: £20,000. Stress test: £40,000. This is not fit-out money — it is operating survivability. Without this buffer, the business is technically viable but personally unsustainable. Priority: fund before any discretionary marketing spend." },
    ],
  },
  {
    name: "Phase 7 — Marketing & launch",
    description: "Pre-launch marketing, opening event, and ongoing digital presence",
    sortOrder: 7,
    tasks: [
      { title: "Google Business Profile — create Winchester location at 9A Jewry Street", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: true, isCriticalRisk: false, durationDays: 1, notes: "Most important local SEO action. Category: Medical Aesthetics Clinic. Verification postcard 1-2 weeks. Respond to every review within 24hrs. Do same day as taking occupation." },
      { title: "Instagram pre-launch campaign — 4-6 weeks teaser content", owner: "David + Abi", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 42, notes: "Week 1: announcement. Weeks 2-3: fit-out progress. Week 4: treatment menu. Week 5: opening date. ASA: no Botox brand name in paid ads. No before/after in paid ads." },
      { title: "Website — Winchester page, photos, updated privacy notice", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 500, isNonNegotiable: true, isCriticalRisk: false, durationDays: 5, notes: "David can update himself — 2-3 hours. New clinic page, parking info (Tower Street multi-storey, 5 min walk), booking link, updated ICO number." },
      { title: "Google Tag Manager — conversion tracking for Winchester bookings", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 2, notes: "Free. Already in progress. Set booking confirmation as conversion event. Link to GA4 and Google Ads." },
      { title: "Email campaign to 600 existing Bedhampton clients", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Existing GHL — no additional cost. Highest-ROI marketing action at zero marginal cost. Segment within 30 miles of Winchester. Priority booking first 2 weeks." },
      { title: "META ads — Winchester-targeted launch campaigns (3 months)", owner: "David", riskLevel: "medium", costLow: 1200, costMid: 2400, costHigh: 3000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 90, notes: "Defer to month 2 — no Winchester reviews in month 1 = low-quality leads. Start month 2 with 10+ Google reviews. No Botox brand name, no before/after in paid ads." },
      { title: "Google Ads — Winchester search campaigns (3 months)", owner: "David", riskLevel: "medium", costLow: 900, costMid: 1200, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 90, notes: "Also defer to month 2. Google Business Profile handles local search free from Day 1. Botox Winchester, lip filler Winchester, anti-wrinkle Winchester." },
      { title: "Soft launch event — top 50 Bedhampton clients + 20 Winchester contacts", owner: "David + Abi", riskLevel: "low", costLow: 400, costMid: 575, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Evening 6-9pm. Clinic tour, Abi for consultations, Instagram content. Self-cater at £400 — the clinic and Abi are the draw, not the food." },
      { title: "Winchester BID registration", owner: "David", riskLevel: "low", costLow: 0, costMid: 0, costHigh: 500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Call BID first — small businesses may be exempt from levy. winchesterbid.co.uk. Footfall data, local marketing networks, events programme." },
      { title: "Winchester SEO — treatment landing pages (build 3-6 months ahead)", owner: "David", riskLevel: "low", costLow: 0, costMid: 375, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 30, notes: "David writes pages himself for launch. Most common clinic launch mistake: website not live early enough. Pages for: botox Winchester, lip filler Winchester, Profhilo Winchester." },
      { title: "Google review generation campaign", owner: "David", riskLevel: "medium", costLow: 0, costMid: 150, costHigh: 600, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Far more valuable than Meta ads at this stage — a Winchester Google Business Profile with 20+ reviews within 3 months will drive consistent organic bookings. Tactics: post-appointment WhatsApp message with direct review link, QR code card at reception. Tools: NiceJob at £75/month or manual outreach (free). Budget MID £150 for QR cards, printed inserts, and 3 months of a review tool if used." },
      { title: "Launch videography / reels content day", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 500, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "Can be self-produced initially using iPhone 15 — ring light, clean background, good audio. Reels content: treatment process clips, before/after reveal, clinic tour, meet Abi intro. A professional videographer at £500-800/day adds polish but is not necessary to start. Defer spend until brand is established and content ROI is proven. Budget LOW (£0) for launch." },
      { title: "Printed launch materials / signage", owner: "David", riskLevel: "low", costLow: 50, costMid: 250, costHigh: 800, isNonNegotiable: false, isCriticalRisk: false, durationDays: 3, notes: "Minimal premium print collateral is sufficient initially. Essential: A5 double-sided appointment cards (Moo or Canva print), A4 treatment menu, window vinyl with logo. Nice to have: branded bags, tissue paper, stickers. Moo business cards 50-pack at £25, window vinyl at £80-150. Budget LOW (£50) for launch basics; upgrade signage once trading." },
      { title: "Local influencer / creator outreach", owner: "Abi", riskLevel: "low", costLow: 0, costMid: 300, costHigh: 2000, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Not necessary at launch — prioritise Google reviews and organic social first. When ready: target Hampshire-based lifestyle creators with 5k-50k followers (micro-influencers outperform on conversion). Offer complimentary treatment in exchange for an honest reel and 3 static posts. Cost = treatment materials only. Budget LOW (£0) initially." },
      { title: "PR / Hampshire lifestyle magazine outreach", owner: "David", riskLevel: "low", costLow: 0, costMid: 250, costHigh: 1500, isNonNegotiable: false, isCriticalRisk: false, durationDays: 7, notes: "Organic PR outreach can be done manually first — no agency needed at launch. Targets: Hampshire Life, Winchester Magazine, The Winchester Edit. Angles: new premium clinic opening in Jewry Street, Abi's clinical background, safe non-surgical aesthetics. Send press release + hi-res images to editorial email. Budget LOW (£0) — cost only if a PR agency is engaged later." },
      { title: "Winchester brand positioning decision", owner: "David", riskLevel: "medium", costLow: 0, costMid: 0, costHigh: 0, isNonNegotiable: false, isCriticalRisk: false, durationDays: 1, notes: "One of the biggest strategic decisions — must be made before marketing spend. Winchester supports a fundamentally different strategy to Waterlooville/Bedhampton. Winchester likely supports: higher spend per client (target £300-500 AOV vs £180-220 at Bedhampton), stronger skin treatment focus (Profhilo, skin boosters, polynucleotides), premium injectables only (no heavy discounting, no group deal platforms), luxury positioning (Harley Street feel, not high street aesthetics). Decision affects: fit-out investment level, branding, pricing, treatment menu, marketing channels, social media tone. Make this decision explicitly before committing to marketing budget." },
    ],
  },
];

async function seedCompliance(projectId: number): Promise<void> {
  await db.insert(schema.complianceItemsTable).values([
    { projectId, section: "CQC Registration", title: "Create CQC provider account on the CQC portal", description: "Register as a provider on the CQC online portal. Required before submitting any application.", status: "not_started", sortOrder: 1 },
    { projectId, section: "CQC Registration", title: "Submit CQC registration application", description: "Complete and submit the full provider registration application including all required declarations.", status: "not_started", sortOrder: 2 },
    { projectId, section: "CQC Registration", title: "Nominate Nominated Individual (NI)", description: "Identify and register a Nominated Individual — the person legally responsible for CQC registration compliance.", status: "not_started", sortOrder: 3 },
    { projectId, section: "CQC Registration", title: "Submit Statement of Purpose", description: "Detailed document describing the regulated activities, service user band, and aims of the service.", status: "not_started", sortOrder: 4 },
    { projectId, section: "CQC Registration", title: "Submit required policies to CQC", description: "All mandatory clinical governance policies must be in place before CQC registration is granted.", status: "not_started", sortOrder: 5 },
    { projectId, section: "CQC Registration", title: "CQC inspection booked and completed", description: "CQC will arrange an inspection of the premises before granting registration.", status: "not_started", sortOrder: 6 },
    { projectId, section: "CQC Registration", title: "CQC registration certificate received", description: "Final step — CQC issues certificate of registration. Clinic CANNOT open to patients without this.", status: "not_started", sortOrder: 7 },
    { projectId, section: "Clinical Governance", title: "Clinical governance framework documented", description: "Formal framework covering accountability, risk management, audit, and patient safety.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Clinical Governance", title: "Adverse incident reporting procedure in place", description: "Clear process for reporting, investigating, and learning from adverse clinical incidents.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Clinical Governance", title: "Patient complaints procedure documented and visible", description: "Written complaints procedure available to patients. Response timeline must meet CQC expectations.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Clinical Governance", title: "Clinical audit schedule established", description: "Plan for regular audits of clinical outcomes, record-keeping, and patient experience.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Clinical Governance", title: "Patient consent process and forms documented", description: "Informed consent process for all treatments, including specific consent for prescription procedures.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Clinical Governance", title: "Chaperone policy in place", description: "Policy covering the use of chaperones during clinical procedures, including patient communication.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Infection Control", title: "Infection Prevention & Control (IPC) policy signed off", description: "Comprehensive IPC policy covering hand hygiene, PPE, decontamination, waste disposal, and spillage procedures.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Infection Control", title: "Clinical waste contract in place (registered carrier)", description: "Signed contract with a registered clinical waste carrier for sharps, contaminated waste, and pharmaceutical waste.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Infection Control", title: "Decontamination/sterilisation procedure documented", description: "Written procedure for cleaning and decontaminating reusable equipment, including ultrasound probes.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Infection Control", title: "Hand hygiene audit completed", description: "Baseline hand hygiene compliance audit completed before opening.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Infection Control", title: "Sharps safety procedure in place (EPA/BBE policy)", description: "Needle-stick and sharps injury policy covering prevention, first aid response, and incident reporting.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Prescriber Arrangements", title: "Prescribing governance framework documented", description: "Framework covering how prescribing decisions are made, documented, and reviewed.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Prescriber Arrangements", title: "Independent prescriber or supervision arrangement confirmed", description: "Either Abi is a qualified IP or a written clinical supervision arrangement is in place with a named prescriber.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Prescriber Arrangements", title: "POM storage — locked, temperature-controlled cupboard", description: "Prescription-only medicines stored in a compliant locked cupboard with temperature monitoring.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Prescriber Arrangements", title: "Prescription record-keeping system operational", description: "Every prescription recorded per Human Medicines Regulations 2012. ANS or equivalent system configured.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Prescriber Arrangements", title: "Medicines management policy in place", description: "Policy covering procurement, storage, administration, disposal, and audit trail of all medicines.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Staff Training", title: "Basic Life Support (BLS) training current", description: "All clinical staff must hold current BLS certification. Minimum annual renewal.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Staff Training", title: "Anaphylaxis management training completed", description: "Adrenaline auto-injector use, recognition, and emergency response. Mandatory for all prescribing staff.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Staff Training", title: "Safeguarding Level 2 training completed", description: "Adults and children safeguarding training. Required by CQC and most professional registers.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Staff Training", title: "IPC training completed for all staff", description: "All clinical and non-clinical staff complete infection prevention and control training.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Staff Training", title: "Mental Capacity Act awareness training", description: "Understanding of capacity assessment in relation to consent for cosmetic procedures.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Staff Training", title: "GDPR / data protection training for all staff", description: "All staff handling patient data must receive GDPR training before clinic opens.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Insurance & Indemnity", title: "Professional indemnity insurance confirmed for Winchester", description: "Hamilton Fraser or equivalent — policy must include all treatments offered at Winchester and the new address.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Insurance & Indemnity", title: "Public liability insurance in place", description: "Minimum £2m public liability. Check FRI lease requirements — may need higher cover.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Insurance & Indemnity", title: "Employers liability insurance (if staff employed)", description: "Legal requirement if any staff are employed. £5m minimum statutory cover.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Insurance & Indemnity", title: "Treatment liability covers prescription procedures", description: "Confirm indemnity explicitly covers toxin, filler, PRP, IV drips and all other prescription treatments.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Opening Requirements", title: "BAFE SP205 fire risk assessment completed (post fit-out)", description: "Post-fit-out fire risk assessment by BAFE SP205 accredited assessor. Required by Hamilton Fraser.", status: "not_started", sortOrder: 1 },
    { projectId, section: "Opening Requirements", title: "Building Regulations Completion Certificate received", description: "WCC Building Control must issue Completion Certificate before clinic opens to patients.", status: "not_started", sortOrder: 2 },
    { projectId, section: "Opening Requirements", title: "Electrical Installation Certificate (EIC) obtained", description: "Issued by Part P qualified electrician on completion of all electrical works.", status: "not_started", sortOrder: 3 },
    { projectId, section: "Opening Requirements", title: "Emergency equipment stocked and accessible", description: "Anaphylaxis kit (adrenaline 1:1000, antihistamine), oxygen if applicable, and basic resuscitation equipment.", status: "not_started", sortOrder: 4 },
    { projectId, section: "Opening Requirements", title: "ICO data controller registration active", description: "ICO registration must be active before processing any patient data. £47/year.", status: "not_started", sortOrder: 5 },
    { projectId, section: "Opening Requirements", title: "Save Face / JCCP accreditation application submitted", description: "Professional accreditation for aesthetics. Required for most insurer panels and patient trust.", status: "not_started", sortOrder: 6 },
    { projectId, section: "Policy Library", title: "Infection Control Policy", description: "Comprehensive IPC policy covering hand hygiene, decontamination, PPE, waste and spillage.", status: "not_started", policyStatus: "draft", sortOrder: 1 },
    { projectId, section: "Policy Library", title: "Medicines Management Policy", description: "Covers procurement, storage, prescribing, administration, disposal and audit of all medicines.", status: "not_started", policyStatus: "draft", sortOrder: 2 },
    { projectId, section: "Policy Library", title: "Safeguarding Policy", description: "Safeguarding adults and children at risk — referral pathways, designated lead, training requirements.", status: "not_started", policyStatus: "draft", sortOrder: 3 },
    { projectId, section: "Policy Library", title: "Complaints Policy", description: "Patient complaints procedure, response timelines, investigation process and learning outcomes.", status: "not_started", policyStatus: "draft", sortOrder: 4 },
    { projectId, section: "Policy Library", title: "Consent Policy", description: "Informed consent procedure for all treatments. Covers capacity, documentation and withdrawal.", status: "not_started", policyStatus: "draft", sortOrder: 5 },
    { projectId, section: "Policy Library", title: "Chaperone Policy", description: "Use of chaperones during clinical procedures including patient communication and documentation.", status: "not_started", policyStatus: "draft", sortOrder: 6 },
    { projectId, section: "Policy Library", title: "Prescribing Governance Policy", description: "Prescribing decision framework, oversight, prescriber competency, and prescription audit.", status: "not_started", policyStatus: "draft", sortOrder: 7 },
    { projectId, section: "Policy Library", title: "Adverse Incidents Policy", description: "Reporting, investigation, root cause analysis and learning from adverse clinical incidents.", status: "not_started", policyStatus: "draft", sortOrder: 8 },
  ]);
  console.log("  ✅ Compliance items seeded (40 items across 7 sections + Policy Library)");
}

async function seedCqcMilestones(projectId: number): Promise<void> {
  await db.insert(schema.cqcMilestonesTable).values([
    { projectId, step: 1, title: "Register with CQC portal", description: "Create provider account and complete pre-registration on the CQC online portal.", leadTimeWeeks: 1, status: "not_started", sortOrder: 1 },
    { projectId, step: 2, title: "Submit application", description: "Complete and submit full provider registration application with all required information.", leadTimeWeeks: 2, status: "not_started", sortOrder: 2 },
    { projectId, step: 3, title: "Nominated Individual approved", description: "CQC confirms the Nominated Individual meets the fit and proper person requirements.", leadTimeWeeks: 4, status: "not_started", sortOrder: 3 },
    { projectId, step: 4, title: "Statement of Purpose accepted", description: "CQC reviews and accepts the Statement of Purpose describing regulated activities.", leadTimeWeeks: 2, status: "not_started", sortOrder: 4 },
    { projectId, step: 5, title: "Policies submitted and reviewed", description: "All required clinical governance policies submitted and reviewed by CQC.", leadTimeWeeks: 2, status: "not_started", sortOrder: 5 },
    { projectId, step: 6, title: "Inspection booked", description: "CQC books and conducts a premises inspection. Typically 4–8 weeks after application.", leadTimeWeeks: 6, status: "not_started", sortOrder: 6 },
    { projectId, step: 7, title: "Registration granted", description: "CQC issues certificate of registration. Clinic is legally permitted to operate as a regulated activity.", leadTimeWeeks: 2, status: "not_started", sortOrder: 7 },
  ]);
  console.log("  ✅ CQC milestones seeded (7 steps, ~19 weeks total)");
}

async function runV6Migration(projectId: number): Promise<void> {
  // Guard: skip if Phase 8 already exists (active or archived — V8 migration archives it)
  const existingPhase8 = await db.select().from(schema.phasesTable)
    .where(and(
      eq(schema.phasesTable.projectId, projectId),
      sql`(${schema.phasesTable.name} = 'Phase 8 — FF&E & Clinic Styling' OR ${schema.phasesTable.name} = 'ARCHIVED: Phase 8 — FF&E & Clinic Styling')`
    ));
  if (existingPhase8.length > 0) {
    return; // already migrated
  }

  console.log("🔧 Running V6 migration: adding Managed Contractor + FF&E phases…");

  // --- Phase 3A: Managed Contractor Works Programme ---
  const [phase3a] = await db.insert(schema.phasesTable).values({
    projectId,
    name: "Phase 3A — Managed Contractor Works Programme",
    description: "Full managed contractor fit-out from design through to snagging and handover.",
    sortOrder: 35,
    status: "not_started",
  }).returning();

  type TaskInsert = typeof schema.tasksTable.$inferInsert;
  const contractorTasks: TaskInsert[] = [
    { phaseId: phase3a.id, title: "Appoint Design / Building Regulations Lead", description: "Appoint architectural or building regulations lead for fit-out drawings and approvals.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 800, costMid: 1800, costHigh: 4000, selectedCost: 1800, startDate: "2026-06-03", dueDate: "2026-06-14", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 0 },
    { phaseId: phase3a.id, title: "Confirm Planning / Conservation / Advertisement Consent Position", description: "Check whether internal alterations or external signage require planning or conservation area consent.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 0, costMid: 500, costHigh: 2500, selectedCost: 500, startDate: "2026-06-03", dueDate: "2026-06-21", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 1 },
    { phaseId: phase3a.id, title: "Produce Employer's Requirements / Contractor Fit-Out Brief", description: "Write the contractor brief covering clinical layout, finish spec, M&E requirements and programme constraints.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 500, costMid: 1200, costHigh: 2500, selectedCost: 1200, startDate: "2026-06-10", dueDate: "2026-06-24", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 2 },
    { phaseId: phase3a.id, title: "Contractor Site Survey and Buildability Review", description: "Shortlisted contractors visit site to assess buildability, service routes and programme.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, selectedCost: 0, startDate: "2026-06-17", dueDate: "2026-07-01", costVatStatus: "vat_na", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 3 },
    { phaseId: phase3a.id, title: "Tender / Quote Managed Fit-Out Package", description: "Obtain minimum two fixed-price contractor quotes for the full fit-out scope.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 35000, costMid: 50000, costHigh: 70000, selectedCost: 50000, startDate: "2026-06-24", dueDate: "2026-07-15", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 4 },
    { phaseId: phase3a.id, title: "Final Scope Lock and Fixed Cost Agreement", description: "Award contract, sign JCT Minor Works or equivalent, agree payment schedule and programme.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 500, costMid: 1000, costHigh: 2000, selectedCost: 1000, startDate: "2026-07-15", dueDate: "2026-07-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 5 },
    { phaseId: phase3a.id, title: "Joinery / Reception Desk / Clinical Cabinetry — Decision", description: "Specify and confirm design of reception desk, vanity units, clinical cabinetry and storage joinery.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 12000, selectedCost: 5000, startDate: "2026-07-01", dueDate: "2026-07-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 6 },
    { phaseId: phase3a.id, title: "Licence for Alterations — Contractor Drawings and Method Support", description: "Prepare licence for alterations package with landlord-compliant contractor drawings and method statement.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 3000, selectedCost: 1500, startDate: "2026-07-15", dueDate: "2026-08-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 7 },
    { phaseId: phase3a.id, title: "Building Control Submission / Initial Notice", description: "Submit building regulations application or initial notice for material alteration works.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 500, costMid: 1200, costHigh: 2500, selectedCost: 1200, startDate: "2026-08-01", dueDate: "2026-08-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 8 },
    { phaseId: phase3a.id, title: "Contractor Pre-Start Meeting and Programme Confirmation", description: "Hold pre-start meeting; confirm programme, access arrangements, deliveries and site management.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, selectedCost: 0, startDate: "2026-09-01", dueDate: "2026-09-07", costVatStatus: "vat_na", supplyScope: "contractor_supplied", procurementStatus: "approved", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 9 },
    { phaseId: phase3a.id, title: "Main Contractor Fit-Out Package — Internal Works", description: "Full internal fit-out: partition walls, ceilings, first fix, second fix, finishes.", owner: "Contractor", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 20000, costMid: 35000, costHigh: 55000, selectedCost: 35000, startDate: "2026-09-14", dueDate: "2026-10-23", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 10 },
    { phaseId: phase3a.id, title: "Electrical Works — Within Main Contractor Package", description: "First and second fix electrical: sockets, lighting circuits, consumer unit, EV charger prep.", owner: "Contractor", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 3000, costMid: 6000, costHigh: 10000, selectedCost: 6000, startDate: "2026-09-14", dueDate: "2026-10-16", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "included_in_contractor", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 11 },
    { phaseId: phase3a.id, title: "Plumbing / Clinical Basin Works — Within Main Contractor Package", description: "Clinical handwash basins, water supply, waste, hot water point and drain connections.", owner: "Contractor", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 1500, costMid: 3500, costHigh: 6000, selectedCost: 3500, startDate: "2026-09-14", dueDate: "2026-10-16", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "included_in_contractor", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 12 },
    { phaseId: phase3a.id, title: "Clinical Flooring Package", description: "Supply and install clinical-grade vinyl or LVT flooring in treatment and clinical areas.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 4500, costHigh: 8000, selectedCost: 4500, startDate: "2026-10-12", dueDate: "2026-10-23", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 13 },
    { phaseId: phase3a.id, title: "Internal Decoration and Finishing", description: "Full internal decoration: walls, ceilings, skirting, architraves, feature finishes.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 4000, costHigh: 7000, selectedCost: 4000, startDate: "2026-10-12", dueDate: "2026-10-30", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "included_in_contractor", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 14 },
    { phaseId: phase3a.id, title: "Joinery / Reception Desk / Clinical Cabinetry — Installation", description: "Install bespoke joinery: reception desk, vanity cabinetry, treatment room storage.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 12000, selectedCost: 5000, startDate: "2026-10-12", dueDate: "2026-10-30", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 15 },
    { phaseId: phase3a.id, title: "Shopfront Repaint — External Decorator or Contractor Managed", description: "Repaint shopfront, window frames and front door in agreed brand colour palette.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 3500, selectedCost: 1500, startDate: "2026-10-12", dueDate: "2026-10-24", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 16 },
    { phaseId: phase3a.id, title: "External Signage Package", description: "Design, manufacture and install external fascia sign, window vinyl and door graphics.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 6000, selectedCost: 3000, startDate: "2026-10-19", dueDate: "2026-10-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 17 },
    { phaseId: phase3a.id, title: "Internal Signage and Branding Package", description: "Room labels, directional signage, framed brand artwork and front-of-house branded elements.", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 750, costMid: 2500, costHigh: 6000, selectedCost: 2500, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "ex_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 18 },
    { phaseId: phase3a.id, title: "Reception Furniture and Styling Package", description: "Source and install reception seating, side tables, plants, mirrors and front-of-house styling.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1500, costMid: 4000, costHigh: 8000, selectedCost: 4000, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "inc_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 19 },
    { phaseId: phase3a.id, title: "Consultation Room Furniture and Styling Package", description: "Consultation desk, client chair, practitioner chair, storage and clinical décor.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 6000, selectedCost: 3000, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "inc_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 20 },
    { phaseId: phase3a.id, title: "Treatment Room Furniture, Equipment and Styling Package", description: "Electric treatment couch, trolley, lamps, waste unit, clinical consumable storage and room styling.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 4000, costMid: 8000, costHigh: 15000, selectedCost: 8000, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 21 },
    { phaseId: phase3a.id, title: "Product Display, Retail Shelving and LED Lighting Setup", description: "Retail shelving, LED display lighting, product stands and retail point-of-sale setup.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3500, costHigh: 8000, selectedCost: 3500, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 22 },
    { phaseId: phase3a.id, title: "Contractor Handover Pack", description: "Receive O&M manuals, warranties, as-built drawings, compliance certificates and keys.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, selectedCost: 0, startDate: "2026-10-24", dueDate: "2026-11-07", costVatStatus: "vat_na", supplyScope: "contractor_supplied", procurementStatus: "to_confirm", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 23 },
    { phaseId: phase3a.id, title: "Snagging Inspection and Final Defects Close-Out", description: "Walk site with contractor; record and resolve all defects before acceptance.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 0, costMid: 500, costHigh: 2000, selectedCost: 500, startDate: "2026-10-31", dueDate: "2026-11-14", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_confirm", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 24 },
    { phaseId: phase3a.id, title: "Building Regulations Completion Certificate", description: "Obtain final building regulations completion certificate from approved inspector.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 200, costMid: 600, costHigh: 1200, selectedCost: 600, startDate: "2026-10-31", dueDate: "2026-11-14", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_confirm", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 25 },
    { phaseId: phase3a.id, title: "Professional Deep Clean Before Clinical Setup", description: "Specialist clinical deep clean of the entire clinic before equipment is brought in.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 300, costMid: 800, costHigh: 1500, selectedCost: 800, startDate: "2026-11-09", dueDate: "2026-11-16", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 26 },
    { phaseId: phase3a.id, title: "Furniture, Treatment Couch and Loose Equipment Installation", description: "Install all loose furniture, treatment couches, clinical equipment and loose smallwares.", owner: "Abi Peters", status: "not_started", riskLevel: "high", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 3000, selectedCost: 1500, startDate: "2026-11-09", dueDate: "2026-11-21", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: true, isCriticalRisk: false, sortOrder: 27 },
    { phaseId: phase3a.id, title: "Final Clinical Readiness Check", description: "Confirm all systems, equipment, compliance documentation and clinical protocols are ready.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, selectedCost: 0, startDate: "2026-11-16", dueDate: "2026-11-23", costVatStatus: "vat_na", supplyScope: "to_confirm", procurementStatus: "not_required", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 28 },
    { phaseId: phase3a.id, title: "Soft Launch Readiness", description: "Final sign-off across all workstreams: clinical, legal, brand, booking system and staff.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 0, costMid: 0, costHigh: 0, selectedCost: 0, startDate: "2026-11-23", dueDate: "2026-11-30", costVatStatus: "vat_na", supplyScope: "to_confirm", procurementStatus: "not_required", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 29 },
  ];
  for (const t of contractorTasks) {
    await db.insert(schema.tasksTable).values(t);
  }
  console.log(`  ✅ Phase 3A: Managed Contractor Works Programme (${contractorTasks.length} tasks)`);

  // --- Phase 8: FF&E & Clinic Styling ---
  const [phase8] = await db.insert(schema.phasesTable).values({
    projectId,
    name: "Phase 8 — FF&E & Clinic Styling",
    description: "Furniture, fixtures, equipment and full clinic styling for opening day.",
    sortOrder: 80,
    status: "not_started",
  }).returning();

  const ffeTasksData: TaskInsert[] = [
    { phaseId: phase8.id, title: "A — Reception Furniture and Styling Package", description: "Reception area seating, side tables, mirror, plants and front-of-house styling. Curated for premium clinical aesthetic.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1500, costMid: 4000, costHigh: 8000, selectedCost: 4000, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "inc_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 0 },
    { phaseId: phase8.id, title: "B — Consultation Room Furniture and Styling Package", description: "Consultation desk, client and practitioner chairs, pin board, storage and branded desk accessories.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 6000, selectedCost: 3000, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "inc_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 1 },
    { phaseId: phase8.id, title: "C — Treatment Room Furniture, Equipment and Styling Package", description: "Electric treatment couch (this line covers the electric treatment couch only — it does not include the full treatment room setup), procedure trolley, clinical lighting, waste unit, consumable storage, room styling. NB: The electric couch is the single highest-value item and should be sourced and ordered early. Allow 6–8 weeks for delivery of a quality electric couch.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 4000, costMid: 8000, costHigh: 15000, selectedCost: 8000, startDate: "2026-09-01", dueDate: "2026-11-07", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 2 },
    { phaseId: phase8.id, title: "D — Product Display, Retail Shelving and LED Lighting Setup", description: "Retail shelving unit, LED strip or spot display lighting, product stands and POS area setup.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 1000, costMid: 3500, costHigh: 8000, selectedCost: 3500, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 3 },
    { phaseId: phase8.id, title: "E — Internal Signage and Branding Package", description: "Room identification signs, directional arrows, framed brand manifesto, regulatory notices and branded certificate frames.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 750, costMid: 2500, costHigh: 6000, selectedCost: 2500, startDate: "2026-10-01", dueDate: "2026-11-07", costVatStatus: "ex_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 4 },
    { phaseId: phase8.id, title: "F — Wall Panelling / Decorative Moulding Feature Finish", description: "MDF or pre-primed wall panelling, decorative cornicing or moulding feature wall in reception or treatment room.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 10000, selectedCost: 5000, startDate: "2026-10-01", dueDate: "2026-10-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 5 },
    { phaseId: phase8.id, title: "G — Wall Art, Certificates and Picture Lighting", description: "Curated wall art, framed qualifications, before/after boards and LED picture lighting above key pieces.", owner: "Abi Peters", status: "not_started", riskLevel: "low", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 4000, selectedCost: 1500, startDate: "2026-10-15", dueDate: "2026-11-07", costVatStatus: "inc_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 6 },
    { phaseId: phase8.id, title: "H — Door Furniture, Room Labels and Black Ironmongery Finish", description: "Upgrade door handles, hooks, room number plates and ironmongery throughout to consistent black finish.", owner: "Contractor", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 500, costMid: 1500, costHigh: 3000, selectedCost: 1500, startDate: "2026-10-12", dueDate: "2026-10-31", costVatStatus: "ex_vat", supplyScope: "contractor_supplied", procurementStatus: "to_quote", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 7 },
    { phaseId: phase8.id, title: "I — Clinical Smallwares and Consumables Setup", description: "Sourcing and stocking all clinical consumables, sharps bins, clinical waste bags, PPE, sterilisation pouches and procedure trays for opening stock.", owner: "Abi Peters", status: "not_started", riskLevel: "critical", costTier: "mid", costLow: 1000, costMid: 3000, costHigh: 6000, selectedCost: 3000, startDate: "2026-10-15", dueDate: "2026-11-14", costVatStatus: "mixed", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: true, isCriticalRisk: true, sortOrder: 8 },
    { phaseId: phase8.id, title: "J — Retail / Skincare Opening Stock", description: "Opening skincare retail stock: SPF, serums, moisturisers, cleansers and branded homecare product bundles.", owner: "Abi Peters", status: "not_started", riskLevel: "medium", costTier: "mid", costLow: 2000, costMid: 5000, costHigh: 12000, selectedCost: 5000, startDate: "2026-10-15", dueDate: "2026-11-14", costVatStatus: "ex_vat", supplyScope: "client_supplied", procurementStatus: "to_specify", isNonNegotiable: false, isCriticalRisk: false, sortOrder: 9 },
  ];
  for (const t of ffeTasksData) {
    await db.insert(schema.tasksTable).values(t);
  }
  console.log(`  ✅ Phase 8: FF&E & Clinic Styling (${ffeTasksData.length} tasks)`);

  // --- Update treatment couch notes on any existing task matching the title ---
  const couchSuffix = "\n\nNOTE: This line covers the electric treatment couch only. It does not include the full treatment room setup — trolley, clinical lighting, waste unit, consumable storage and styling are separate items. The electric couch is the single highest-value item and should be sourced and ordered early to avoid programme delays. Allow 6–8 weeks for delivery of a quality electric couch. See Phase 8 Task C for the full treatment room package.";
  const couchTasks = await db.select().from(schema.tasksTable)
    .where(sql`lower(title) LIKE '%treatment couch%' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
  for (const ct of couchTasks) {
    if (!ct.notes?.includes("This line covers the electric treatment couch only")) {
      await db.update(schema.tasksTable)
        .set({ notes: (ct.notes ?? "") + couchSuffix })
        .where(eq(schema.tasksTable.id, ct.id));
    }
  }

  console.log("✅ V6 migration complete");
}

export async function runStartupSeed(): Promise<void> {
  console.log("🌱 Running startup seed check...");

  try {
    // V31 migration: backlink tracker tables.
    //
    // Deliberately ahead of the fresh-install / existing-install branch rather
    // than with the other numbered migrations, because both paths go on to
    // SELECT from these tables. On a database that has not got them yet, that
    // select throws, the outer catch swallows it, and the whole startup seed
    // stops. Creating them first is what makes deploying enough.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlink_opportunities (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        priority TEXT NOT NULL DEFAULT 'P2 Next',
        category TEXT NOT NULL,
        website TEXT NOT NULL,
        domain TEXT NOT NULL,
        why TEXT,
        competitors TEXT,
        groups JSONB DEFAULT '[]'::jsonb,
        cost TEXT,
        apply_url TEXT,
        info_needed TEXT,
        template TEXT,
        status TEXT NOT NULL DEFAULT 'Not started',
        owner TEXT,
        target_date DATE,
        notes TEXT,
        date_contacted DATE,
        follow_up_date DATE,
        live_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlink_listing_pack (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        section TEXT NOT NULL,
        field TEXT NOT NULL,
        value TEXT,
        remaining TEXT,
        status TEXT NOT NULL DEFAULT 'Missing',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // V34: rooms and kit tables, created ahead of the branch for the same reason.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kit_areas (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        area_key TEXT NOT NULL,
        name TEXT NOT NULL,
        budget_gbp REAL NOT NULL DEFAULT 0,
        covers TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, area_key)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kit_items (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        area_key TEXT NOT NULL,
        name TEXT NOT NULL,
        amount_gbp REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // V35: the lines Abi plans against are plan tasks; items attach to a line.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kit_lines (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        area_key TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, task_id)
      )
    `);
    await db.execute(sql`ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS task_id INTEGER`);
    // V36: a link per item, with the picture and title fetched from it.
    await db.execute(sql`ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS url TEXT`);
    await db.execute(sql`ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
    await db.execute(sql`ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS link_title TEXT`);
    // V37: colours and finishes, Abi's paint and flooring shortlist per surface, and
    // which option each surface has chosen.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS finish_surfaces (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        zone TEXT NOT NULL,
        role TEXT,
        name TEXT NOT NULL,
        brief TEXT,
        chosen_option_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS finish_options (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        surface_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        code TEXT,
        finish TEXT,
        hex TEXT,
        url TEXT,
        image_url TEXT,
        link_title TEXT,
        status TEXT NOT NULL DEFAULT 'idea',
        note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // V38: a board label per kit line, and the shortlisted colour a paint item is.
    await db.execute(sql`ALTER TABLE kit_lines ADD COLUMN IF NOT EXISTS label TEXT`);
    await db.execute(sql`ALTER TABLE kit_items ADD COLUMN IF NOT EXISTS finish_option_id INTEGER`);
    // V39: the credit cards register and what is on each card.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_cards (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        holder TEXT,
        account TEXT NOT NULL DEFAULT 'business',
        last4 TEXT,
        credit_limit_gbp REAL NOT NULL DEFAULT 0,
        apr_pct REAL,
        offers_json TEXT NOT NULL DEFAULT '[]',
        min_payment_pct REAL,
        min_payment_floor_gbp REAL,
        statement_day INTEGER,
        due_day INTEGER,
        direct_debit TEXT NOT NULL DEFAULT 'none',
        direct_debit_gbp REAL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_entries (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        card_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'purchase',
        description TEXT NOT NULL,
        amount_gbp REAL NOT NULL DEFAULT 0,
        task_id INTEGER,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // V60: what the company owes a director for what they paid personally. For each entry on a
    // personal account: the VAT on it, the proof in hand, whether it is in the company's books,
    // and the day the company paid it back.
    await db.execute(sql`ALTER TABLE card_entries ADD COLUMN IF NOT EXISTS vat_gbp REAL`);
    await db.execute(sql`ALTER TABLE card_entries ADD COLUMN IF NOT EXISTS receipt TEXT NOT NULL DEFAULT 'none'`);
    await db.execute(sql`ALTER TABLE card_entries ADD COLUMN IF NOT EXISTS booked BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE card_entries ADD COLUMN IF NOT EXISTS repaid_date TEXT`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backlink_templates (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        template_id TEXT NOT NULL,
        use TEXT NOT NULL,
        wording TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    let projectId: number;

    const existing = await db.select().from(schema.projectsTable).where(eq(schema.projectsTable.id, 1));
    if (existing.length > 0) {
      projectId = existing[0].id;

      // If any phases exist, preserve all user data — never wipe on redeploy.
      // Exact task counts must NOT be used as a version signal; counts change
      // whenever the user edits tasks or a new feature merge adjusts the seed.
      const phases = await db.select().from(schema.phasesTable).where(eq(schema.phasesTable.projectId, projectId));

      if (phases.length > 0) {
        console.log(`✅ V5 data already present (${phases.length} phases) — skipping seed. User data preserved.`);
        // Still seed compliance / CQC milestones if they haven't been added yet
        const existingCompliance2 = await db.select().from(schema.complianceItemsTable).where(eq(schema.complianceItemsTable.projectId, projectId));
        if (existingCompliance2.length === 0) {
          await seedCompliance(projectId);
        }
        const existingMilestones2 = await db.select().from(schema.cqcMilestonesTable).where(eq(schema.cqcMilestonesTable.projectId, projectId));
        if (existingMilestones2.length === 0) {
          await seedCqcMilestones(projectId);
        }
        const existingRisks2 = await db.select().from(schema.risksTable).where(eq(schema.risksTable.projectId, projectId));
        if (existingRisks2.length === 0) {
          await seedRisks(projectId);
          console.log("🛡️ Risk register seeded (22 risks)");
        }
        // V6 migration retired 2026-07-07: already applied to the production data.
        // Its name-based guard broke once archived phases were cleaned out of the
        // DB, causing it to re-insert old phases on every boot. Do not re-enable.
        // V7 migration: add additional_clinicians_json column (idempotent DDL)
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS additional_clinicians_json TEXT DEFAULT '[]'`);
        // V7 data repair: fix rows where the column was initialised to '0' instead of '[]'
        await db.execute(sql`UPDATE financial_models SET additional_clinicians_json = '[]' WHERE additional_clinicians_json IS NULL OR additional_clinicians_json = '0' OR additional_clinicians_json = ''`);
        // V8 migration retired 2026-07-07: already applied to the production data
        // (the 12 active phases exist). Same archived-data guard risk as V6.
        // V9 migration: add date fields to investments table
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS deposit_date TEXT`);
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS agreement_start_date TEXT`);
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS first_payment_date TEXT`);
        // V10 migration: add vat_registration_date to financial_models
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS vat_registration_date TEXT`);
        // V11 migration: add vat_input_cost_ratio_percent to financial_models
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS vat_input_cost_ratio_percent INTEGER DEFAULT 60`);
        // V12 migration: project controls — actuals tracking on tasks + David's approved cap
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS actual_cost REAL`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS committed_cost REAL`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS paid_status TEXT`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS payment_date TEXT`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS invoice_ref TEXT`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS invoice_date TEXT`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS variance_note TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS actual_cost REAL`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS committed_cost REAL`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS paid_status TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS payment_date TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS invoice_ref TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS invoice_date TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS variance_note TEXT`);
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS david_approved_cap_gbp REAL DEFAULT 60000`);
        // V13 migration: invoice file upload URL + VAT status on actuals
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS invoice_file_url TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS invoice_file_url TEXT`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS invoice_vat_status TEXT`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS invoice_vat_status TEXT`);
        // V14 migration: update David's approved cap to £80,000
        await db.execute(sql`UPDATE financial_models SET david_approved_cap_gbp = 80000 WHERE project_id = ${projectId} AND david_approved_cap_gbp = 60000`);
        // V15 migration: part-paid support — track how much has been paid so far
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS amount_paid_gbp REAL`);
        await db.execute(sql`ALTER TABLE property_task_overrides ADD COLUMN IF NOT EXISTS amount_paid_gbp REAL`);
        // V16 migration: task line items — sub-items for FF&E / package breakdowns
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS task_line_items (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            property_id INTEGER,
            name TEXT NOT NULL,
            url TEXT,
            cost_gbp REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        // V17 migration: tender packs + responses (principal-contractor ITT)
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS tender_packs (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            reference TEXT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            deadline TEXT,
            sections_json TEXT NOT NULL DEFAULT '[]',
            documents_json TEXT,
            evaluation_json TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.execute(sql`ALTER TABLE tender_packs ADD COLUMN IF NOT EXISTS files_json TEXT NOT NULL DEFAULT '[]'`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS tender_responses (
            id SERIAL PRIMARY KEY,
            tender_pack_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            contractor_name TEXT NOT NULL,
            file_url TEXT,
            file_name TEXT,
            notes TEXT DEFAULT '',
            extracted_json TEXT,
            score_json TEXT,
            received_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS notes_log_json TEXT NOT NULL DEFAULT '[]'`);
        // Tender progress tracking: withdrawn bidders + site visits
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS site_visit_booked BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS site_visit_date DATE`);
        await db.execute(sql`ALTER TABLE tender_responses ADD COLUMN IF NOT EXISTS site_visited BOOLEAN NOT NULL DEFAULT FALSE`);
        // V18 migration: workforce & capacity planning (People module)
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS staff_roles (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            role_type TEXT NOT NULL DEFAULT 'clinician',
            status TEXT NOT NULL DEFAULT 'planned',
            start_date TEXT,
            lead_time_weeks INTEGER NOT NULL DEFAULT 12,
            trigger_json TEXT NOT NULL DEFAULT '{}',
            allocations_json TEXT NOT NULL DEFAULT '[]',
            annual_cost_gbp REAL NOT NULL DEFAULT 0,
            is_owner BOOLEAN NOT NULL DEFAULT false,
            notes TEXT DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await db.execute(sql`ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS pay_model TEXT NOT NULL DEFAULT 'employed'`);
        await db.execute(sql`ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS pay_json TEXT NOT NULL DEFAULT '{}'`);
        await db.execute(sql`ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS intake_json TEXT NOT NULL DEFAULT '{}'`);
        await db.execute(sql`ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS readiness_plan TEXT`);
        await db.execute(sql`ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS package_plan TEXT`);
        await db.execute(sql`ALTER TABLE workforce_settings ADD COLUMN IF NOT EXISTS pay_benchmark TEXT`);
        // Suppliers / tender tracking + saved AI credentials review
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS responded BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tender_accepted BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS visit_booked BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS visited BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS visit_date DATE`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credentials_review TEXT`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credentials_score INTEGER`);
        await db.execute(sql`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credentials_reviewed_at TIMESTAMP`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS workforce_settings (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            chichester_move_month TEXT,
            winchester_rooms INTEGER NOT NULL DEFAULT 2,
            bedhampton_days_needed REAL NOT NULL DEFAULT 5,
            full_site_days_per_week REAL NOT NULL DEFAULT 5,
            plan_narrative TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        // V19 migration: tender award flow — archivable estimate lines + award record
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS archived_reason TEXT`);
        // V32 schema: refundable outlays (the rent deposit), kept beside archived so it runs early.
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS refundable BOOLEAN NOT NULL DEFAULT FALSE`);
        // V33 schema: Money page cash model (owner spec of 30 September 2026).
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS payment_plan_json TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS cash_model_json TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS holiday_months INTEGER NOT NULL DEFAULT 0`);
        await db.execute(sql`ALTER TABLE investments ADD COLUMN IF NOT EXISTS equity_kicker_percent REAL NOT NULL DEFAULT 0`);
        await db.execute(sql`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS effective_from TEXT`);
        await db.execute(sql`ALTER TABLE shareholders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'current'`);
        await db.execute(sql`ALTER TABLE fixed_cost_items ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
        // V20 migration: downselect / saving review — owner flag + free-text note on tasks
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_flag BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_note TEXT`);
        // V21 migration: downselect can master-overwrite the line cost — keep the original as a baseline
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_baseline REAL`);
        // V22 migration: global savings switch — store the downselect target + a per-project on/off flag
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_target REAL`);
        await db.execute(sql`ALTER TABLE financial_models ADD COLUMN IF NOT EXISTS savings_applied BOOLEAN NOT NULL DEFAULT TRUE`);
        // V23 migration: per-line savings control — arm/apply each saving independently + priority order
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_applied BOOLEAN NOT NULL DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE launch_tasks ADD COLUMN IF NOT EXISTS saving_order INTEGER NOT NULL DEFAULT 0`);
        // V24 migration: marketing tab remodel — 3-channel, week-by-week, owner-tagged plan
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS week_start TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS detail TEXT NOT NULL DEFAULT ''`);
        // V25 migration: marketing plan goes fully day-by-day
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS day_date TEXT NOT NULL DEFAULT ''`);
        // V26 migration: deep per-task detail (strategy/creative/copy/how) as JSON blocks
        await db.execute(sql`ALTER TABLE marketing_items ADD COLUMN IF NOT EXISTS deep TEXT NOT NULL DEFAULT '[]'`);
        // V27 migration: market module — richer competitor fields + treatments, competitor prices,
        // membership programmes (theirs and ours), referrals, enrolments and a VAT-split sales journal
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS trading_name TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS town TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS lead_clinician TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS credential TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS cqc_registered BOOLEAN DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS cqc_number TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS bacn BOOLEAN DEFAULT FALSE`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS publishes_prices TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS booking_platform TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS skincare_brands TEXT DEFAULT '[]'`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS devices TEXT DEFAULT '[]'`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS price_page_url TEXT DEFAULT ''`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS distance_km_winchester REAL`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS distance_km_bedhampton REAL`);
        await db.execute(sql`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS threat_level TEXT DEFAULT ''`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS treatments (
            id SERIAL PRIMARY KEY, key TEXT NOT NULL, display_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'skin', is_pom BOOLEAN NOT NULL DEFAULT FALSE,
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            price_winchester REAL, price_bedhampton REAL,
            actual_price_winchester REAL, actual_price_bedhampton REAL,
            course_size INTEGER, course_price_winchester REAL, course_price_bedhampton REAL,
            is_new BOOLEAN NOT NULL DEFAULT FALSE, product_cost_estimate_gbp REAL,
            description TEXT DEFAULT '', aftercare_url TEXT DEFAULT '',
            variance_reason_winchester TEXT DEFAULT '', variance_reason_bedhampton TEXT DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        // V30 migration: manual actual price per site (Market and Pricing green dot).
        // Kept directly after the treatments CREATE TABLE so the table always exists
        // first, and ahead of the later data-repair statements so nothing can skip it.
        await db.execute(sql`ALTER TABLE treatments ADD COLUMN IF NOT EXISTS actual_price_winchester REAL`);
        await db.execute(sql`ALTER TABLE treatments ADD COLUMN IF NOT EXISTS actual_price_bedhampton REAL`);
        // Stock cost per treatment, net of VAT. The column is in the CREATE TABLE
        // above but was never used, so this guarantees it on older databases.
        await db.execute(sql`ALTER TABLE treatments ADD COLUMN IF NOT EXISTS product_cost_estimate_gbp REAL`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS competitor_prices (
            id SERIAL PRIMARY KEY, competitor_id INTEGER NOT NULL, treatment_key TEXT NOT NULL,
            price_gbp REAL, price_qualifier TEXT NOT NULL DEFAULT 'exact',
            course_size INTEGER, course_price_gbp REAL,
            source_url TEXT DEFAULT '', captured_date TEXT DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS competitor_memberships (
            id SERIAL PRIMARY KEY, competitor_id INTEGER NOT NULL, programme_name TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'discount_only',
            price_monthly_gbp REAL, founder_price_gbp REAL, annual_price_gbp REAL,
            min_commitment_months INTEGER, notice_period_days INTEGER,
            included_treatments TEXT DEFAULT '[]',
            discount_retail_pct REAL, discount_treatments_pct REAL,
            rollover_allowed BOOLEAN, pause_allowed BOOLEAN,
            includes_pom BOOLEAN NOT NULL DEFAULT FALSE,
            stated_saving_gbp REAL, delivered_by TEXT DEFAULT '',
            features_json TEXT DEFAULT '{}',
            source_url TEXT DEFAULT '', captured_date TEXT DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS memberships (
            id SERIAL PRIMARY KEY, name TEXT NOT NULL, tier_rank INTEGER NOT NULL DEFAULT 0,
            site TEXT NOT NULL DEFAULT 'both', price_monthly_gbp REAL,
            founder_price_gbp REAL, founder_places INTEGER,
            min_commitment_months INTEGER NOT NULL DEFAULT 0, notice_period_days INTEGER NOT NULL DEFAULT 30,
            inclusions TEXT NOT NULL DEFAULT '[]', is_public BOOLEAN NOT NULL DEFAULT TRUE,
            live_from_date TEXT DEFAULT '', delivered_by TEXT DEFAULT '',
            included_minutes_per_month INTEGER NOT NULL DEFAULT 0,
            features_json TEXT DEFAULT '{}', notes TEXT DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS referrals (
            id SERIAL PRIMARY KEY, referrer_contact_id TEXT NOT NULL, referee_contact_id TEXT,
            referral_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent',
            credit_referrer_gbp REAL NOT NULL DEFAULT 25, credit_referee_gbp REAL NOT NULL DEFAULT 25,
            ghl_tag TEXT DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(), attended_at TIMESTAMP, credited_at TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS membership_enrolments (
            id SERIAL PRIMARY KEY, contact_id TEXT NOT NULL, membership_id INTEGER,
            plan_type TEXT NOT NULL DEFAULT 'tier', site TEXT NOT NULL DEFAULT 'winchester',
            price_monthly_gbp REAL NOT NULL DEFAULT 0, next_billing_date TEXT DEFAULT '',
            failed_payment_count INTEGER NOT NULL DEFAULT 0, pause_status BOOLEAN NOT NULL DEFAULT FALSE,
            min_term_months_remaining INTEGER NOT NULL DEFAULT 0,
            enrolment_date TEXT DEFAULT '', prescriber TEXT DEFAULT '', schedule_json TEXT DEFAULT '[]',
            payments_made_gbp REAL NOT NULL DEFAULT 0, treatments_taken INTEGER NOT NULL DEFAULT 0,
            balance_gbp REAL NOT NULL DEFAULT 0, ghl_subscription_id TEXT DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS sales_transactions (
            id SERIAL PRIMARY KEY, site TEXT NOT NULL DEFAULT 'winchester', treatment_key TEXT NOT NULL,
            treatment_date TEXT NOT NULL, gross_gbp REAL NOT NULL, vat_gbp REAL NOT NULL,
            payment_method TEXT NOT NULL DEFAULT 'card', contact_id TEXT DEFAULT '',
            source TEXT NOT NULL DEFAULT 'ans',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS tender_awards (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            tender_pack_id INTEGER NOT NULL,
            tender_response_id INTEGER NOT NULL,
            contractor_name TEXT,
            contract_sum_gbp REAL,
            vat_treatment TEXT,
            programme_weeks INTEGER,
            awarded_task_id INTEGER,
            archived_task_ids_json TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        // V28 migration: risk-register corrections from the full-product audit.
        // R005 is mistitled — 9A Jewry Street is NOT a listed building; the real
        // requirement is Advertisement Consent in the conservation area. Guarded on
        // the old title so it fires once and is idempotent.
        await db.execute(sql`
          UPDATE risks SET
            title = 'Advertisement Consent required for signage (conservation area)',
            description = 'The unit sits in the Winchester City Centre Conservation Area and is adjacent to Grade II listed buildings, but is not itself listed. External signage is likely to require Advertisement Consent, which constrains the permitted design and adds lead time. Listed Building Consent does not apply to this unit.'
          WHERE project_id = ${projectId} AND risk_id = 'R005' AND title = 'Listed building consent required for signage'
        `);
        // R023: the direct nurse-led rival (Winchester Medical Aesthetics, 81 High
        // Street, 0.2km) is tracked in Competition but was missing from the register.
        // Opens ~1 month before us pre-selling a founder membership. Score is a
        // sensible starting point for the owner to confirm.
        await db.execute(sql`
          INSERT INTO risks (project_id, risk_id, title, description, category, likelihood, impact, pipeline_stage, linked_model_section, linked_risk_ids, is_watch_list, source, status)
          SELECT ${projectId}, 'R023', 'Direct nurse-led rival opens on the High Street before us', 'Winchester Medical Aesthetics (81 High Street, 0.2km, nurse prescriber) is pre-selling a founder membership and opening about a month before us with the same positioning. It collides directly with our own founder mechanic and could capture the recurring-revenue client first. Counter with a membership offer live from the first scan (the Skin Plan is being reworked) and the quarterly device rescan as the differentiator their facials-only model cannot match.', 'Market & Competition', 4, 4, 'Pre-Opening', 'Competition Intel', '["R008","R021","R022"]'::jsonb, TRUE, 'Audit', 'Not Started'
          WHERE NOT EXISTS (SELECT 1 FROM risks WHERE project_id = ${projectId} AND risk_id = 'R023')
        `);
        // V29 migration: seed three known risks the audit found missing. All are
        // real, documented exposures; scores are a starting point for the owner.
        await db.execute(sql`
          INSERT INTO risks (project_id, risk_id, title, description, category, likelihood, impact, pipeline_stage, linked_model_section, linked_risk_ids, is_watch_list, source, status)
          SELECT ${projectId}, 'R024', 'Advertising a prescription-only medicine to the public', 'Botulinum toxin is a POM; naming it, or an anti-wrinkle offer that resolves to it, in any public ad, membership or funnel breaches CAP Code 12.12 and MHRA guidance. The risk is our own marketing copy, not a competitor. Mitigation lives in the market module write-gate and the copy-compliance checks, but every human-written post, ad and landing page needs the same discipline.', 'Legal & Lease', 3, 4, 'Pre-Opening', 'Marketing', '[]'::jsonb, TRUE, 'Audit', 'Not Started'
          WHERE NOT EXISTS (SELECT 1 FROM risks WHERE project_id = ${projectId} AND risk_id = 'R024')
        `);
        await db.execute(sql`
          INSERT INTO risks (project_id, risk_id, title, description, category, likelihood, impact, pipeline_stage, linked_model_section, linked_risk_ids, is_watch_list, source, status)
          SELECT ${projectId}, 'R025', 'Single-nurse, single-room revenue ceiling caps growth', 'The model runs on one practitioner in one room. R014 covers absence, but not the structural ceiling: once the diary is full, courses and members crowd out new-client slots and revenue cannot grow without an associate or a second room. Protect a fixed weekly new-client quota and treat sustained high utilisation as the trigger to add capacity or move to mature prices.', 'Financial', 4, 3, 'Month 1-3', 'Financials - Revenue Ramp', '["R014"]'::jsonb, TRUE, 'Audit', 'Not Started'
          WHERE NOT EXISTS (SELECT 1 FROM risks WHERE project_id = ${projectId} AND risk_id = 'R025')
        `);
        await db.execute(sql`
          INSERT INTO risks (project_id, risk_id, title, description, category, likelihood, impact, pipeline_stage, linked_model_section, linked_risk_ids, is_watch_list, source, status)
          SELECT ${projectId}, 'R026', 'Meta pixel dead since December 2025 blinds the paid-media plan', 'The Meta pixel has fired no events since December 2025. The launch cold-start mitigation (R008) leans on Meta ads, but without a working pixel there is no conversion tracking, no optimisation and no retargeting audience. Confirm the pixel state, then reinstall and verify before any spend goes live.', 'Market & Competition', 4, 3, 'Pre-Opening', 'Marketing', '["R008"]'::jsonb, TRUE, 'Audit', 'Not Started'
          WHERE NOT EXISTS (SELECT 1 FROM risks WHERE project_id = ${projectId} AND risk_id = 'R026')
        `);

        // Backlink tracker: added after the original build, so an existing
        // install reaches this branch and would otherwise never get it.
        const existingBacklinks2 = await db.select().from(schema.backlinkOpportunitiesTable).where(eq(schema.backlinkOpportunitiesTable.projectId, projectId));
        if (existingBacklinks2.length === 0) {
          await seedBacklinks(projectId);
          console.log("  ✅ Backlink tracker seeded (42 opportunities)");
        }

        // Rooms and kit: added 30 September 2026, so an existing install gets it here.
        if (await seedKit(projectId)) console.log("  ✅ Rooms and kit areas seeded");
        const kitLines = await seedKitLines(projectId);
        if (kitLines) console.log(`  ✅ Rooms and kit lines matched to the plan (${kitLines} of ${KIT_LINES.length})`);

        if (await seedFinishes(projectId)) console.log("  ✅ Colours and finishes seeded");
        // V38, 1 October 2026: the owner's tidy of Abi's board (see migrateKitV38).
        if (await migrateKitV38(projectId)) console.log("  ✅ Rooms and kit tidied: paint pot, treatment room 2, board labels");

        // V32 migration: business record of 26 September 2026, group B (approved by the owner).
        // B4: the approved June budget is 81,786, not the 80,000 placeholder. Guarded on the
        // old value so a later edit is never overwritten.
        await db.execute(sql`UPDATE financial_models SET david_approved_cap_gbp = 81786 WHERE project_id = ${projectId} AND david_approved_cap_gbp = 80000`);
        // B5: the lease rent deposit is refundable, so it is netted off the real project cost.
        await db.execute(sql`UPDATE launch_tasks SET refundable = TRUE WHERE refundable = FALSE AND title ILIKE 'Rent Deposit%' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);

        // V33 migration: Money page cash model, owner's spec and answers of 30 September 2026.
        // Every statement is guarded so a re-run changes nothing.
        // (a) Croma fire alarm works: new plan line, 1,800 ex VAT, paid by bank in October.
        await db.execute(sql`
          INSERT INTO launch_tasks (phase_id, title, notes, owner, supplier, status, risk_level, cost_tier, selected_cost, cost_mid, cost_vat_status, supply_scope, procurement_status, priority, budget_status, include_in_launch_budget, include_in_risk_view, is_non_negotiable, is_critical_risk, sort_order, payment_plan_json)
          SELECT p.id, 'Instruct Croma for fire alarm works, obtain quote, add to budget',
            'Fire alarm works by Croma Security Solutions. Not yet instructed. Budgeted at 1,800 ex VAT (2,160 inc VAT), paid by bank in October 2026. Annual maintenance of about 220 falls in October 2027.',
            'David', 'Croma Security Solutions', 'not_started', 'high', 'quoted', 2160, 2160, 'inc_vat', 'contractor_supplied', 'to_quote', 'high', 'Included in approved launch budget', TRUE, TRUE, TRUE, TRUE, 300, '[{"month":"2026-10","share":1,"method":"bank"}]'
          FROM launch_phases p
          WHERE p.project_id = ${projectId} AND p.name = 'Managed Building Works'
            AND NOT EXISTS (SELECT 1 FROM launch_tasks WHERE title ILIKE 'Instruct Croma%')
        `);
        // (b) Payment months and methods (section 2 of the spec). CBS: 20/60/17/3.
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":0.2,"method":"bank"},{"month":"2026-11","share":0.6,"method":"bank"},{"month":"2026-12","share":0.17,"method":"bank"},{"month":"2027-05","share":0.03,"method":"bank"}]' WHERE payment_plan_json = '' AND supplier = 'CBS' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"bank"}]' WHERE payment_plan_json = '' AND title ILIKE 'Rent Deposit%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"bank"}]' WHERE payment_plan_json = '' AND title ILIKE 'Commercial Property Solicitor%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"bank"}]' WHERE payment_plan_json = '' AND title ILIKE 'External Signage Package%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Joinery / Reception Desk / Clinical Cabinetry%Installation' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Treatment Couch x1%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Reception furniture and styling%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Consultation Room Furniture%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Treatment Room Furniture, Equipment%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Opening Injectable Stock%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Clinical Smallwares%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Hamilton Fraser%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Fire Risk Assessment%Post Fit-Out%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Legionella Risk Assessment%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'PAT Testing Setup%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Clinical Waste Contract%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Emergency Drugs and Equipment Kit%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Broadband Availability%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Clinical deep clean%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'FIGS scrubs%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-11","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Meta Ads%Winchester Launch%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-12","share":1,"method":"card"}]' WHERE payment_plan_json = '' AND title ILIKE 'Google Ads%Winchester Launch%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // (c) Already paid: advertisement consent 174, ACE 72, brand identity balance, signage deposit 350.
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'paid', actual_cost = 174, amount_paid_gbp = 174 WHERE title ILIKE 'Advertisement Consent%' AND coalesce(paid_status, '') <> 'paid' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'paid', actual_cost = 174, amount_paid_gbp = 174 WHERE task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'Advertisement Consent%' AND coalesce(paid_status, '') <> 'paid' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'paid', actual_cost = 72, amount_paid_gbp = 72 WHERE title ILIKE 'ACE Group World membership%' AND coalesce(paid_status, '') <> 'paid' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'paid', actual_cost = 72, amount_paid_gbp = 72 WHERE task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'ACE Group World membership%' AND coalesce(paid_status, '') <> 'paid' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET amount_paid_gbp = 490 WHERE title ILIKE 'Brand Identity%' AND coalesce(amount_paid_gbp, 0) < 490 AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE property_task_overrides SET amount_paid_gbp = 490 WHERE task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'Brand Identity%' AND coalesce(amount_paid_gbp, 0) < 490 AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        // V40, 5 October 2026: finish V33 (c) on the active property's copy of each line.
        // V33 marked these paid on the plan line first, so its property updates, which looked
        // for lines not yet paid, matched nothing, and the Plan page (which reads the property
        // copy) showed them unpaid. Each statement changes a line only while it is still in
        // that state, so a later edit by the owner is never undone.
        await db.execute(sql`UPDATE property_task_overrides o SET paid_status = 'paid', actual_cost = t.actual_cost, amount_paid_gbp = t.amount_paid_gbp, updated_at = NOW() FROM launch_tasks t WHERE o.task_id = t.id AND o.paid_status IS NULL AND t.paid_status = 'paid' AND t.archived = FALSE AND (t.title ILIKE 'Advertisement Consent%' OR t.title ILIKE 'ACE Group World membership%') AND t.phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}) AND o.property_id IN (SELECT id FROM clinic_properties WHERE project_id = ${projectId} AND is_active_for_project)`);
        // The signage deposit of 350 is paid: part paid on the property copy too.
        await db.execute(sql`UPDATE property_task_overrides o SET paid_status = 'part-paid', amount_paid_gbp = t.amount_paid_gbp, updated_at = NOW() FROM launch_tasks t WHERE o.task_id = t.id AND o.paid_status = 'committed' AND o.amount_paid_gbp IS NULL AND t.paid_status = 'part-paid' AND t.amount_paid_gbp > 0 AND t.archived = FALSE AND t.title ILIKE 'External Signage Package%' AND t.phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}) AND o.property_id IN (SELECT id FROM clinic_properties WHERE project_id = ${projectId} AND is_active_for_project)`);
        // V41, 5 October 2026 (owner): Variation 1, the firestopping works, is no longer a CBS
        // variation; Arundel will do the work. Arundel fire alarm (total) 1,368, taken as inc VAT.
        // The line keeps its id, place and payment plan. Guarded on the old title, so it runs
        // once; the property copy changes first, where there is one (V33's lesson).
        const V41_NOTE = "Arundel fire alarm (total): 1,368, taken as inc VAT (1,140 plus VAT); confirm against Arundel's quote. This line was Variation 1, Firestopping works (T&J), on the CBS contract at 1,579 ex VAT (1,894.80 inc VAT). It is no longer a variation and not CBS's work: Arundel will do it. Changed 5 October 2026.";
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1368, committed_cost = 1368, supplier = 'Arundel', updated_at = NOW() WHERE task_id IN (SELECT id FROM launch_tasks WHERE title = 'Variation 1 - Firestopping works (T&J)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})) AND property_id IN (SELECT id FROM clinic_properties WHERE project_id = ${projectId} AND is_active_for_project)`);
        await db.execute(sql`UPDATE launch_tasks SET title = 'Arundel fire alarm (total)', supplier = 'Arundel', selected_cost = 1368, committed_cost = 1368, supply_scope = 'contractor_supplied', notes = ${V41_NOTE}, updated_at = NOW() WHERE title = 'Variation 1 - Firestopping works (T&J)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V42, 5 October 2026 (owner): not using Croma, so the Croma fire alarm line comes out
        // of the plan (archived with its reason, never deleted); Arundel's terms are 30% deposit
        // on booking (October) and 70% when the works are complete (November), by bank. Each
        // statement is guarded on the state it changes, so it runs once.
        await db.execute(sql`UPDATE launch_tasks SET archived = TRUE, archived_reason = 'Not using Croma: Arundel does the fire alarm (owner, 5 October 2026).', updated_at = NOW() WHERE title ILIKE 'Instruct Croma for fire alarm works%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        const V42_NOTE = "Arundel fire alarm (total): 1,368, taken as inc VAT (1,140 plus VAT); confirm against Arundel's quote. Payment terms: 30% deposit on booking, 70% when the works are complete. This line was Variation 1, Firestopping works (T&J), on the CBS contract at 1,579 ex VAT (1,894.80 inc VAT). It is no longer a variation and not CBS's work: Arundel will do it, and the Croma fire alarm line has come out of the plan. Changed 5 October 2026.";
        await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = '[{"month":"2026-10","share":0.3,"method":"bank"},{"month":"2026-11","share":0.7,"method":"bank"}]', notes = ${V42_NOTE}, updated_at = NOW() WHERE title = 'Arundel fire alarm (total)' AND payment_plan_json LIKE '%"2027-05"%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V43, 5 October 2026 (owner): the bank today is 27,000; James's 37,000 and Bill's 10,000
        // are not in it yet. Set once (bankSeeded marks it), so a balance the owner later enters,
        // changes or clears on the Money page is never overwritten.
        {
          const [fm] = await db.select().from(schema.financialsTable).where(eq(schema.financialsTable.projectId, projectId));
          if (fm) {
            let stored: Record<string, unknown> | null = {};
            try { stored = JSON.parse((fm as any).cashModelJson || "{}") || {}; } catch { stored = null; }
            if (stored && !stored.bankSeeded && !stored.bank) {
              stored.bank = { balanceGbp: 27000, asAt: "2026-10-05", inBalance: [], savedAt: "2026-10-05T20:30:00.000Z" };
              stored.bankSeeded = true;
              await db.update(schema.financialsTable).set({ cashModelJson: JSON.stringify(stored) } as any).where(eq(schema.financialsTable.projectId, projectId));
            }
          }
        }
        // V44, 11 October 2026 (owner): the 9A layout pack (10 October) prices reception and
        // treatment room 1 item by item. Abi's items take the chosen products and prices, the
        // items the pack adds join their plan lines, and those two plan lines move to the sum
        // of their items. Each item changes only while it still has its old name, so an edit
        // made since is kept; the new items go in once (the Lucia chair, added last, marks it).
        // Only on the install that has Abi's items (the sofa, item 12).
        {
          const [sofa] = await db.select().from(schema.kitItemsTable).where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.id, 12)));
          const [done] = await db.select().from(schema.kitItemsTable).where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.name, "Lucia cane swivel desk chair, Daals")));
          if (sofa && !done) {
            const PACK = "From the 9A layout pack, 10 October 2026.";
            const upd: [number, string, string, number | null, string][] = [
              [12, "Sofa", "Amboise curved 3-seater sofa, Daals", 699.99, "Ecru boucle, black legs. " + PACK],
              [17, "Side table", "Ingrid round side table, Cult Furniture", 179, "Natural travertine effect, pre-order. " + PACK],
              [29, "Rug", "Rocco round rug, benuta", 129, "1.5 m, cream wool, sale price; non-slip pad under. " + PACK],
              [23, "Pendant lighting", "Tala triple pendant, oak (over the desk)", 345, "3 Sphere IV bulbs. " + PACK],
              [30, "Arm Chair", "Jeanne cane chair (lobby, by the coffee station)", 149.99, "Moved from reception to the lobby. " + PACK],
              [13, "Desk", "Maru 1-drawer writing desk, greige oak, Daals", 319.99, PACK],
              [14, "Desk chairs x2", "Fulbourn boucle chairs x2, Daals", null, "Taupe boucle. Price to confirm. " + PACK],
              [15, "Trolley", "Adexa 3-tier trolley, 2 drawers", 165.6, PACK],
              [16, "Treatment light", "Daylight Omega 7 magnifier lamp", 244.99, "Plus a floor stand, price to add. " + PACK],
            ];
            for (const [id, was, name, amount, note] of upd) {
              await db.update(schema.kitItemsTable).set({ name, ...(amount != null ? { amountGbp: amount } : {}), note, updatedAt: new Date() } as any)
                .where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.id, id), eq(schema.kitItemsTable.name, was)));
            }
            await db.update(schema.kitItemsTable).set({ note: "The layout pack has the Artisan Deco curved fluted desk at 1,035, made to order. Kept at 0 here because David is paying for it.", updatedAt: new Date() } as any)
              .where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.id, 21), eq(schema.kitItemsTable.name, "Reception Desk (Paid by David)")));
            const add: [string, number, string, number, string][] = [
              ["reception", 337, "Tala linear triple pendant, brass (over the sofa)", 367.5, "490 list, 367.50 true cost. " + PACK],
              ["reception", 337, "Amboise storage pouffe, Daals", 129.99, "Ecru boucle, spare seat. " + PACK],
              ["treatment", 339, "Tork soap and towel dispensers, black", 121, "S4 foam soap about 68, H2 towels 53. " + PACK],
              ["treatment", 339, "Arezzo basins and Alberta taps, both rooms", 319.8, "79.95 each, two basins and two taps; we supply, CBS fit. Ask CBS for the credit on 10.1 (3,005). " + PACK],
              ["reception", 337, "Lucia cane swivel desk chair, Daals", 209.99, "Black frame. " + PACK],
            ];
            for (const [areaKey, taskId, name, amountGbp, note] of add) {
              await db.insert(schema.kitItemsTable).values({ projectId, areaKey, taskId, name, amountGbp, status: "planned", note } as any);
            }
            // The two plan lines take the sum of their items: reception furniture 2,210.46
            // (was 1,320) and treatment room furniture 1,571.38 (was 1,000, its saving target).
            // The property's copy first (V33's lesson), each only while it holds the old figure.
            await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2210.46, updated_at = NOW() WHERE task_id = 337 AND selected_cost = 1320`);
            await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1571.38, updated_at = NOW() WHERE task_id = 339 AND selected_cost = 1000`);
            await db.execute(sql`UPDATE launch_tasks SET saving_target = 1571.38, updated_at = NOW() WHERE id = 339 AND saving_target = 1000`);
          }
        }
        // V45, 11 October 2026 (owner): David is paying for the reception desk from his own money
        // as a gift to the business. It stays at 0 in the kit and the plan, as no business money
        // pays for it; the name and note say so. Only while it still has its old name.
        await db.update(schema.kitItemsTable).set({ name: "Reception desk, Artisan Deco: David's gift (£1,035)", note: "David's gift: he pays for it from his own money, so it costs the business nothing and is kept at 0 here. Curved fluted desk, 1,035, made to order, from the 9A layout pack (10 October 2026). For the accountant: an asset given to the company.", updatedAt: new Date() } as any)
          .where(and(eq(schema.kitItemsTable.projectId, projectId), eq(schema.kitItemsTable.id, 21), eq(schema.kitItemsTable.name, "Reception Desk (Paid by David)")));
        // V45 (owner, same day): Arundel commission the fire alarm; they are not doing the
        // fire-stopping, which stays with CBS inside their revised price. The line's figure and
        // payment plan are right; its note said otherwise. Only while the old wording is there.
        const V45_ARUNDEL = "Arundel fire alarm (total): commissioning the fire alarm, 1,368, taken as inc VAT (1,140 plus VAT); confirm against Arundel's quote. Arundel are not doing the fire-stopping: that is CBS's work, inside their revised price (Q2002C, 69,362 ex VAT, 6 October 2026). Emergency lights and exit signs are a separate gap still to price (layout pack, point 10). Payment terms: 30% deposit on booking, 70% when the works are complete. Corrected 11 October 2026.";
        await db.execute(sql`UPDATE property_task_overrides SET notes = ${V45_ARUNDEL}, updated_at = NOW() WHERE notes LIKE '%Firestopping works (T&J), on the CBS contract%' AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Arundel fire alarm (total)' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET notes = ${V45_ARUNDEL}, updated_at = NOW() WHERE title = 'Arundel fire alarm (total)' AND notes LIKE '%Firestopping works (T&J), on the CBS contract%' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V46, 11 October 2026 (owner): the CBS contract is 69,362 ex VAT, their revised
        // Q2002C of 6 October (fire-stopping in, the glass ramp panel out), not 69,598. Without
        // CBS's breakdown by ref, the 236 ex VAT (283.20 with VAT) comes off Ref 3, partitions
        // and walls, where the glass panel was; the 14 refs then add to 83,234.40 with VAT.
        // The property's copy first where there is one; each only while it holds the old figure.
        const V46_NOTE = "CBS revised price Q2002C (6 October 2026): 69,362 ex VAT in all, including the fire-stopping, with the 1,100 glass ramp panel omitted (3.2). CBS's breakdown by ref is still to come, so the 236 ex VAT reduction (283.20 with VAT) is taken on this ref, where the glass panel was: 10,165 ex VAT becomes 9,929. Move it to the right refs when the breakdown arrives. Changed 11 October 2026.";
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 11914.8, committed_cost = 11914.8, updated_at = NOW() WHERE committed_cost = 12198 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Ref 3 - Partitions and walls' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 11914.8, committed_cost = 11914.8, notes = ${V46_NOTE}, updated_at = NOW() WHERE title = 'Ref 3 - Partitions and walls' AND committed_cost = 12198 AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE tender_awards SET contract_sum_gbp = 69362 WHERE project_id = ${projectId} AND contractor_name LIKE 'CBS%' AND contract_sum_gbp = 69598`);
        // Each one-off step below runs once, and is recorded in seed_steps when it has. Before this,
        // the steps put back anything they found missing, so a line the owner deleted came back on
        // the next deploy (found 20 October 2026: thirteen deleted lines would have returned). A
        // database that already has V61's last insert ran every step to V61 before the table existed.
        await db.execute(sql`CREATE TABLE IF NOT EXISTS seed_steps (step text PRIMARY KEY, done_at timestamptz NOT NULL DEFAULT now())`);
        const done = new Set(((await db.execute(sql`SELECT step FROM seed_steps`)) as any).rows.map((r: any) => r.step as string));
        // V61 joined the list on 20 October 2026: its value-guarded updates re-ran on every boot and put back its estimates whenever a later step returned an item to 0.
        const STEPS_TO_V61 = ["V47", "V49", "V50 AC task", "V55 trainers line", "V55 trainers kit line", "V55 trainers item", "V59 desk line", "V59 desk kit line", "V61 coffee sink", "V61"];
        if (STEPS_TO_V61.some(k => !done.has(k)) && ((await db.execute(sql`SELECT 1 FROM kit_items WHERE project_id = ${projectId} AND name = 'Compact sink and tap for the coffee station'`)) as any).rows.length) {
          for (const k of STEPS_TO_V61) { await db.execute(sql`INSERT INTO seed_steps (step) VALUES (${k}) ON CONFLICT DO NOTHING`); done.add(k); }
        }
        const r2sql = (x: number) => Math.round(x * 100) / 100;
        const step = async (key: string, run: () => Promise<unknown>) => {
          if (done.has(key)) return;
          await run();
          await db.execute(sql`INSERT INTO seed_steps (step) VALUES (${key}) ON CONFLICT DO NOTHING`);
          done.add(key);
        };
        await step("V47", () => migratePackGapsV47(projectId));
        // V48, 11 October 2026 (owner): the 30% deposit on Arundel's fire alarm commissioning is
        // being paid: 410.40 of the 1,368 committed (with VAT). The line is part paid, and its
        // payment plan keeps only the 70% balance, in November, so the deposit is not counted
        // twice. The property's copy first; each only while the line is still unpaid.
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'part-paid', actual_cost = 410.4, amount_paid_gbp = 410.4, payment_date = '2026-10-11', updated_at = NOW() WHERE coalesce(paid_status, 'committed') = 'committed' AND amount_paid_gbp IS NULL AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Arundel fire alarm (total)' AND coalesce(paid_status, 'committed') = 'committed' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 410.4, amount_paid_gbp = 410.4, payment_date = '2026-10-11', payment_plan_json = '[{"month":"2026-11","share":1,"method":"bank"}]', updated_at = NOW() WHERE title = 'Arundel fire alarm (total)' AND coalesce(paid_status, 'committed') = 'committed' AND amount_paid_gbp IS NULL AND committed_cost = 1368 AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await step("V49", () => migratePackReissueV49(projectId));
        // V50, 12 October 2026 (owner, from Steve Crippen by phone): the AC kit for the two new
        // treatment room units is unlikely before the last week of November. CBS fit the
        // mechanical ventilation and the AC lines now and cap them; the two existing ceiling
        // units carry on; the new units go in on a return visit after practical completion and
        // Building Control sign-off. Opening stays 27 November. A note on the HVAC line and a
        // task for the return visit, each once.
        const V50_HVAC = " AC kit (Steve Crippen, 12 October 2026): the two new treatment room units are unlikely before the last week of November. CBS fit the mechanical ventilation and the AC lines now and cap them; the two existing ceiling units carry on; the new units go in on a return visit after practical completion and Building Control sign-off. List them as outstanding on the practical completion certificate and hold their value until fitted and commissioned (F-gas certificate).";
        await db.execute(sql`UPDATE launch_tasks SET notes = coalesce(notes, '') || ${V50_HVAC}, updated_at = NOW() WHERE title = 'Ref 11 - HVAC' AND archived = FALSE AND coalesce(notes, '') NOT LIKE '%Steve Crippen, 12 October 2026%' AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        const V50_TASK = "AC: fit the two treatment room units after practical completion (CBS return visit)";
        await step("V50 AC task", () => db.execute(sql`INSERT INTO launch_tasks (phase_id, title, notes, owner, contractor, status, risk_level, cost_tier, selected_cost, cost_vat_status, supply_scope, procurement_status, priority, budget_status, include_in_launch_budget, include_in_risk_view, start_date, due_date, sort_order)
          SELECT p.id, ${V50_TASK}, 'Inside CBS Ref 11 (HVAC), no extra cost. The kit is due the last week of November; the lines and the mechanical ventilation are in and capped before practical completion. Fit, commission, F-gas certificate, then release the value held back on the practical completion certificate. Until then, check the treatment rooms stay warm enough for patients. Steve Crippen by phone, 12 October 2026.', 'CBS + David', 'CBS', 'not_started', 'medium', 'low', 0, 'N/A: inside CBS Ref 11', 'to_confirm', 'to_specify', 'high', '£0 admin task', TRUE, TRUE, '2026-11-30', '2026-12-04', coalesce((SELECT max(sort_order) FROM launch_tasks WHERE phase_id = p.id), 0) + 1
          FROM launch_phases p WHERE p.project_id = ${projectId} AND p.status = 'active' AND p.name ILIKE 'Handover%' AND NOT EXISTS (SELECT 1 FROM launch_tasks t WHERE t.title = ${V50_TASK}) LIMIT 1`));
        // V51, 12 October 2026 (owner): the reception wall art (plaster relief face, 800 by
        // 1,000) is bought, 189.16 on David's Virgin Money card. Abi's item takes the price and
        // is marked paid; the reception line rises by the same to 2,399.62, the sum of its
        // items. The line stays unpaid with its October card plan on purpose: a line marked
        // paid counts as already out of the bank, and this went on the card, so the card
        // register records the payment instead. The property's copy first; each only while it
        // holds the old figure.
        await db.execute(sql`UPDATE kit_items SET amount_gbp = 189.16, status = 'paid', note = 'Bought 12 October 2026, 189.16 on David''s Virgin Money card (ending 6965). 800 wide by 1,000 high, centred on the cabinet, 2 fixings into masonry.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Wall art: plaster relief face, black frame (Etsy, made to order)' AND amount_gbp = 0`);
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2399.62, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2210.46 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2399.62, updated_at = NOW() WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND round(selected_cost::numeric, 2) IN (1200, 2210.46) AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V52, 12 October 2026 (owner): both Tala pendants bought in one order on David's Virgin
        // Money card, 751.50 (835 list less the 10% first order code). The discount is shared
        // across the two: oak 310.50, brass linear 441.00 (the pack had 367.50 for the brass,
        // a 25% code that was not there). The reception line rises by 39 to 2,438.62, the sum of
        // its items, and stays on its October card plan, as V51 explains.
        const V52_NOTE = "Bought 12 October 2026 in one Tala order of 751.50 (835 list less the 10% first order code) on David's Virgin Money card (ending 6965). Ask Tala for a VAT invoice to Abi Peters Aesthetics Ltd (GB 523 3501 30): 125.25 VAT.";
        await db.execute(sql`UPDATE kit_items SET amount_gbp = 310.5, status = 'paid', note = ${"Oak, 3 Sphere IV bulbs, over the desk; ships from 18 November. " + V52_NOTE}, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Tala triple pendant, oak (over the desk)' AND round(amount_gbp::numeric, 2) = 345 AND status = 'planned'`);
        await db.execute(sql`UPDATE kit_items SET amount_gbp = 441, status = 'paid', note = ${"Brass, 3 Sphere IV bulbs, over the sofa. " + V52_NOTE}, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Tala linear triple pendant, brass (over the sofa)' AND round(amount_gbp::numeric, 2) = 367.5 AND status = 'planned'`);
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2438.62, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2399.62 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2438.62, updated_at = NOW() WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND round(selected_cost::numeric, 2) = 2399.62 AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V53, 12 October 2026 (owner): the rest of reception bought. Cult Furniture, the Ingrid
        // side table, 193.95 with 14.95 delivery (tax invoice 377725, to the company, VAT 32.32,
        // Virgin card ending 6965). Daals, one order of 1,039.97 with free delivery: the Amboise
        // sofa, the Amboise pouffe and the Lucia desk chair, each at its listed price. All marked
        // paid; the reception line rises by the side table's delivery, 14.95, to 2,453.57, and
        // stays on its October card plan (see V51).
        const V53_DAALS = "Bought 12 October 2026 in one Daals order of 1,039.97, free economy delivery to 4 Masons Avenue, paid by David. Ask Daals for a VAT invoice to Abi Peters Aesthetics Ltd (GB 523 3501 30): 173.34 VAT on the order.";
        const V53_ITEMS: [string, number, number, string][] = [
          ["Ingrid round side table, Cult Furniture", 179, 193.95, "Bought 12 October 2026 from Cult Furniture: 179 plus 14.95 delivery, 193.95 on David's Virgin Money card (ending 6965). Tax invoice 377725 to Abi Peters Aesthetics Ltd, VAT 32.32. Pre-order, dispatch from 17 November."],
          ["Amboise curved 3-seater sofa, Daals", 699.99, 699.99, "Ecru boucle, ball cushions. " + V53_DAALS],
          ["Amboise storage pouffe, Daals", 129.99, 129.99, "Ecru boucle. " + V53_DAALS],
          ["Lucia cane swivel desk chair, Daals", 209.99, 209.99, "Black frame. " + V53_DAALS],
        ];
        for (const [name, was, now, note] of V53_ITEMS) await db.execute(sql`UPDATE kit_items SET amount_gbp = ${now}, status = 'paid', note = ${note}, updated_at = NOW() WHERE project_id = ${projectId} AND name = ${name} AND round(amount_gbp::numeric, 2) = ${was} AND status = 'planned'`);
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2453.57, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2438.62 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2453.57, updated_at = NOW() WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND round(selected_cost::numeric, 2) = 2438.62 AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V54, 12 October 2026 (owner): the Rocco rug bought from benuta, 109.65 (159 list, 30
        // sale and a 19.35 code off, free delivery). Abi's item takes the price and is marked
        // paid; the reception line falls by 19.35 to 2,434.22 and stays on its October card plan.
        await db.execute(sql`UPDATE kit_items SET amount_gbp = 109.65, status = 'paid', note = 'Bought 12 October 2026 from benuta, 150 cm round: 159 list, 30 sale and 19.35 code off, free delivery. 109.65 with 18.28 VAT, on David''s card. Ask benuta for a VAT invoice to Abi Peters Aesthetics Ltd (GB 523 3501 30). Non-slip pad under.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Rocco round rug, benuta' AND round(amount_gbp::numeric, 2) = 129 AND status = 'planned'`);
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2434.22, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2453.57 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2434.22, updated_at = NOW() WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND round(selected_cost::numeric, 2) = 2453.57 AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V55, 12 October 2026 (owner): the scrubs and trainers line splits. The FIGS scrubs are
        // bought, six pieces at 259.20 after the 20% NHS code, free delivery; the trainers are
        // not, and take the rest of the 350, 90.80, on their own line beside it. Both go to the
        // card in October, inside the Virgin card's 0% window (buy by 29 October). The scrubs
        // line stays unpaid on its card plan, as V51 explains; the card register holds the
        // payment. The title keeps its "FIGS scrubs" start, which the board's area seed matches.
        const V55_FROM = "FIGS scrubs and trainers - Abi and David", V55_SCRUBS = "FIGS scrubs - Abi and David", V55_TRAINERS = "Trainers - Abi and David";
        const V55_OCT_CARD = '[{"month":"2026-10","share":1,"method":"card"}]';
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 259.2, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 350 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V55_FROM} AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET title = ${V55_SCRUBS}, selected_cost = 259.2, cost_vat_status = 'inc_vat', payment_plan_json = ${V55_OCT_CARD}, notes = 'Bought 12 October 2026 from FIGS: 2 Catarina tops and the Isabel and Zamora trousers for Abi, the Leon top and Tansen tall joggers for David, all black. 324 list less the 20% NHS code, 259.20, free delivery, on David''s Virgin Money card. Ask FIGS for a VAT invoice to Abi Peters Aesthetics Ltd (GB 523 3501 30). The trainers are their own line.', updated_at = NOW() WHERE title = ${V55_FROM} AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await step("V55 trainers line", () => db.execute(sql`INSERT INTO launch_tasks (phase_id, title, notes, owner, status, risk_level, cost_tier, selected_cost, cost_vat_status, supply_scope, procurement_status, priority, budget_status, include_in_launch_budget, include_in_risk_view, payment_plan_json, sort_order)
          SELECT t.phase_id, ${V55_TRAINERS}, 'Work trainers for Abi and David, not yet bought: the rest of the 350 the scrubs and trainers line held. Buy on the Virgin card by 29 October 2026 for the 0%. Get a VAT invoice to Abi Peters Aesthetics Ltd.', 'Abi', 'not_started', 'low', 'low', 90.8, 'inc_vat', 'to_confirm', 'to_specify', 'medium', 'not_set', TRUE, TRUE, ${V55_OCT_CARD}, t.sort_order
          FROM launch_tasks t WHERE t.title = ${V55_SCRUBS} AND t.archived = FALSE AND t.phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}) AND NOT EXISTS (SELECT 1 FROM launch_tasks x WHERE x.title = ${V55_TRAINERS}) LIMIT 1`));
        await db.execute(sql`UPDATE kit_lines SET label = 'FIGS scrubs for Abi and David' WHERE project_id = ${projectId} AND label = 'Scrubs and trainers for Abi and David'`);
        await step("V55 trainers kit line", () => db.execute(sql`INSERT INTO kit_lines (project_id, task_id, area_key, sort_order, label)
          SELECT ${projectId}, t.id, 'opening', coalesce((SELECT max(sort_order) FROM kit_lines WHERE project_id = ${projectId} AND area_key = 'opening'), 0) + 1, 'Trainers for Abi and David'
          FROM launch_tasks t WHERE t.title = ${V55_TRAINERS} AND t.archived = FALSE AND NOT EXISTS (SELECT 1 FROM kit_lines l WHERE l.task_id = t.id)`));
        await db.execute(sql`UPDATE kit_items SET amount_gbp = 259.2, status = 'paid', name = 'FIGS scrubs: 3 tops, 3 trousers', note = 'Bought 12 October 2026, 259.20 after the 20% NHS code, on David''s Virgin Money card. Abi: 2 Catarina tops, Isabel and Zamora trousers (XS). David: Leon top (L), Tansen tall joggers (M tall). All black.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Sets of Figs' AND round(amount_gbp::numeric, 2) = 350 AND status = 'planned'`);
        await step("V55 trainers item", () => db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
          SELECT ${projectId}, 'opening', t.id, 'Work trainers, Abi and David', 90.8, 'planned', 'Not yet bought. Buy on the Virgin card by 29 October 2026 for the 0%.'
          FROM launch_tasks t WHERE t.title = ${V55_TRAINERS} AND t.archived = FALSE AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Work trainers, Abi and David')`));
        // V56, 12 October 2026 (owner): show what is spent against its lines. Reception is part
        // paid, 2,284.23 of 2,434.22 (all but the lobby chair), and the FIGS scrubs are paid,
        // 259.20, both on David's Virgin card. The cash model counts money on the card register
        // as card spend still to repay, not as out of the bank, so marking them paid leaves the
        // bank and card figures as they were. The property's copy first; each only while unpaid.
        for (const [title, status, paid] of [["Reception furniture and styling (verified schedule)", "part-paid", 2284.23], ["FIGS scrubs - Abi and David", "paid", 259.2]] as const) {
          await db.execute(sql`UPDATE property_task_overrides SET paid_status = ${status}, actual_cost = ${paid}, amount_paid_gbp = ${paid}, payment_date = '2026-10-12', updated_at = NOW() WHERE coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${title} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
          await db.execute(sql`UPDATE launch_tasks SET paid_status = ${status}, actual_cost = ${paid}, amount_paid_gbp = ${paid}, payment_date = '2026-10-12', updated_at = NOW() WHERE title = ${title} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        }
        // V57, 12 October 2026 (owner): David does the fire risk assessment himself, so the line
        // is his, at £0, in the week before opening, after the fit-out. Only while it still
        // holds the assessor's figure (570 on the property's copy, 475 on the base).
        const V57_NOTE = "David does it himself (owner, 12 October 2026). Under the Regulatory Reform (Fire Safety) Order 2005 the responsible person can do the assessment if competent; since 1 October 2023 it must be recorded in full, in writing, with who did it. Do it once the fit-out is finished and before opening, using the HM Government guide for offices and shops; cover the escape route, the ramp, the fire alarm (Arundel), the emergency lights and signs (CBS), extinguishers and the clinical waste and oxygen storage if any. Review it when the treatment room AC units go in. Check Hamilton Fraser accepts a self-assessment.";
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 0, owner = 'David', start_date = '2026-11-23', due_date = '2026-11-26', notes = ${V57_NOTE}, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 570 AND task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'Fire Risk Assessment%Post Fit-Out' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET selected_cost = 0, owner = 'David', notes = ${V57_NOTE}, updated_at = NOW() WHERE title ILIKE 'Fire Risk Assessment%Post Fit-Out' AND archived = FALSE AND round(selected_cost::numeric, 2) IN (475, 570) AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V58, 12 October 2026 (owner): the Adexa trolley for room 1 is bought, 165.60 as planned
        // (138 plus 27.60 VAT, free delivery, order 1821728), on David's Virgin card. Abi's item
        // is marked paid and the room 1 line part paid by the same; the card register holds the
        // payment, so the cash figures do not move. Each only while still as it was.
        await db.execute(sql`UPDATE kit_items SET status = 'paid', note = 'Bought 12 October 2026 from Adexa, order 1821728: 138 plus 27.60 VAT, free delivery, on David''s Virgin Money card. Comes flat-packed.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Adexa 3-tier trolley, 2 drawers' AND round(amount_gbp::numeric, 2) = 165.6 AND status = 'planned'`);
        const V58_ROOM1 = "Treatment Room Furniture, Equipment and Styling Package";
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'part-paid', actual_cost = 165.6, amount_paid_gbp = 165.6, payment_date = '2026-10-12', updated_at = NOW() WHERE coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V58_ROOM1} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 165.6, amount_paid_gbp = 165.6, payment_date = '2026-10-12', updated_at = NOW() WHERE title = ${V58_ROOM1} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // V59, 14 October 2026 (owner): the reception desk is no longer David's gift. Artisan Deco
        // invoice 1-20261014: 1,000 (1,150 less a 150 direct order discount), no VAT (the
        // supplier is not VAT registered), 3 to 4 weeks to make. David paid a 345 deposit from
        // his personal bank account on 14 October and pays the 655 balance before delivery; the
        // company owes him both. It gets its own line (no VAT, unlike the joinery line it sat
        // under at 0): committed 1,000, part paid 345, repaid to David from the business bank,
        // 345 in October and 655 in November. Abi's item moves to it, marked ordered. Once only.
        const V59_DESK = "Reception desk, Artisan Deco (custom, Corian top)";
        const V59_NOTE = "Artisan Deco invoice 1-20261014, 14 October 2026: curved fluted desk, custom 1,000 wide by 580 deep by 950 high, solid surface Corian top, cable exit. 1,150 less a 150 direct order discount, 1,000. No VAT: the supplier is not VAT registered, so there is none to reclaim. David paid the 345 deposit from his personal bank account on 14 October (recorded on his personal account in Credit Cards) and pays the 655 balance before delivery, in 3 to 4 weeks. The company owes David both (his director's loan); the plan repays him from the business bank, 345 in October and 655 in November. No longer a gift: David's choice, 14 October 2026.";
        await step("V59 desk line", () => db.execute(sql`INSERT INTO launch_tasks (phase_id, title, notes, owner, supplier, status, risk_level, cost_tier, selected_cost, committed_cost, actual_cost, amount_paid_gbp, paid_status, payment_date, invoice_ref, invoice_date, invoice_vat_status, cost_vat_status, supply_scope, procurement_status, priority, budget_status, include_in_launch_budget, include_in_risk_view, payment_plan_json, sort_order)
          SELECT t.phase_id, ${V59_DESK}, ${V59_NOTE}, 'David', 'Artisan Deco', 'in_progress', 'low', 'mid', 1000, 1000, 345, 345, 'part-paid', '2026-10-14', '1-20261014', '2026-10-14', 'exempt', 'no VAT: supplier not VAT registered', 'to_confirm', 'quote_received', 'high', 'Included in approved launch budget', TRUE, TRUE, '[{"month":"2026-10","share":0.345,"method":"bank"},{"month":"2026-11","share":0.655,"method":"bank"}]', t.sort_order
          FROM launch_tasks t WHERE t.title = 'Reception furniture and styling (verified schedule)' AND t.archived = FALSE AND t.phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}) AND NOT EXISTS (SELECT 1 FROM launch_tasks x WHERE x.title = ${V59_DESK}) LIMIT 1`));
        await db.execute(sql`UPDATE kit_items SET task_id = (SELECT id FROM launch_tasks WHERE title = ${V59_DESK} AND archived = FALSE LIMIT 1), name = 'Reception desk, Artisan Deco: curved, fluted, Corian top', amount_gbp = 1000, status = 'ordered', note = 'Ordered 14 October 2026, invoice 1-20261014: 1,000, no VAT. 345 deposit paid by David personally; 655 balance before delivery, in 3 to 4 weeks. 1,000 wide by 580 deep by 950 high, cable exit. Owed back to David by the company.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Reception desk, Artisan Deco: David''s gift (£1,035)' AND EXISTS (SELECT 1 FROM launch_tasks WHERE title = ${V59_DESK} AND archived = FALSE)`);
        await step("V59 desk kit line", () => db.execute(sql`INSERT INTO kit_lines (project_id, task_id, area_key, sort_order, label)
          SELECT ${projectId}, t.id, 'reception', 4, 'Reception desk (Artisan Deco)' FROM launch_tasks t WHERE t.title = ${V59_DESK} AND t.archived = FALSE AND NOT EXISTS (SELECT 1 FROM kit_lines l WHERE l.task_id = t.id)`));
        await db.execute(sql`UPDATE kit_lines SET label = 'Clinical cabinetry and joinery' WHERE project_id = ${projectId} AND label = 'Reception desk and clinical cabinetry'`);
        // V61, 14 October 2026 (owner, line by line): every plan line made to add up to the items
        // under it, with the owner's answers. Cabinetry 1,800 is the allowance until the Howdens
        // quote. Shelving: the LEDs are CBS's line, so their 1,000 goes; the shelves are Bespoke
        // Nature's at 500 until the quote, the room 1 take-home shelf among them, October on the
        // card. Room 2 is deferred, so its line goes to 0. The Obagi opening stock goes in
        // October on the card. The couch item takes the line's 1,398.60. The Jeanne chair moves
        // to the lobby. Coffee station: machine and fridge owned, wine cooler dropped, units 600,
        // mirror 120, sink and tap 150. Utility storage deferred until after opening. Room 1:
        // the Lec fridge owned, the analyser trolley inside the paid platform, stool, sharps bin,
        // lamp stand and mirror arm at estimates. Reception styling at estimates. Each step only
        // while the line or item still holds what it held.
        const V61_PHASES = sql`(SELECT id FROM launch_phases WHERE project_id = ${projectId})`;
        const v61Ovr = (title: string, from: number, to: number) => db.execute(sql`UPDATE property_task_overrides SET selected_cost = ${to}, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = ${from} AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${title} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
        const v61Base = (title: string, from: number, to: number) => db.execute(sql`UPDATE launch_tasks SET selected_cost = ${to}, updated_at = NOW() WHERE title = ${title} AND archived = FALSE AND round(selected_cost::numeric, 2) = ${from} AND phase_id IN ${V61_PHASES}`);
        const v61Plan = (title: string, plan: string) => db.execute(sql`UPDATE launch_tasks SET payment_plan_json = ${plan}, updated_at = NOW() WHERE title = ${title} AND archived = FALSE AND coalesce(payment_plan_json, '') IN ('', '[]') AND phase_id IN ${V61_PHASES}`);
        const V61_OCT_CARD = '[{"month":"2026-10","share":1,"method":"card"}]';
        const V61_SHELF = "Product Display / Retail Shelving / LED Setup", V61_ROOM2 = "Consultation Room Furniture and Styling Package", V61_OBAGI = "Retail / Skincare Opening Stock";
        const V61_RECEP = "Reception furniture and styling (verified schedule)", V61_ROOM1 = "Treatment Room Furniture, Equipment and Styling Package";
        const V61_LOBBY = "Lobby coffee station: machine, fridge, wine cooler, cupboards", V61_UTIL = "Utility storage: clinical waste cupboard, lockers, COSHH cupboard";
        const V61_EST = "Estimate (owner, 14 October 2026); replace with the real price when bought.";
        await step("V61", async () => {
          await v61Ovr(V61_SHELF, 400, 500); await v61Plan(V61_SHELF, V61_OCT_CARD);
          await v61Ovr(V61_ROOM2, 300, 0);
          await v61Plan(V61_OBAGI, V61_OCT_CARD);
          await v61Ovr(V61_RECEP, 2434.22, 2464.23); await v61Base(V61_RECEP, 2434.22, 2464.23);
          await v61Ovr(V61_ROOM1, 1571.38, 1871.38);
          await v61Base(V61_LOBBY, 0, 1019.99); await v61Plan(V61_LOBBY, V61_OCT_CARD);
          await db.execute(sql`UPDATE launch_tasks SET status = 'deferred', notes = coalesce(notes, '') || ' Deferred by the owner, 14 October 2026: done in the months after opening, to keep cash in the bank.', updated_at = NOW() WHERE title = ${V61_UTIL} AND archived = FALSE AND status = 'not_started' AND phase_id IN ${V61_PHASES}`);
          // The items. [name now, amount now, new name or null, new amount, new status or null, note or null]
          const V61_ITEMS: [string, number, string | null, number, string | null, string | null][] = [
            ["Clinical Cabinetry", 1500, "Howdens cupboards and Calacatta worktops: both treatment rooms and the reception recess", 1800, null, "Allowance until the Howdens quote: Clerkenwell navy base, white wall units, Calacatta laminate tops, and the two white base units in the reception recess. Bill fits them, free."],
            ["Retail Shelving (Reception and Treatment Rooms)", 500, "Floating shelves, Bespoke Nature: 3 in reception, 1 take-home shelf in room 1 (primed)", 500, null, "Bespoke Nature, made to measure: 3 at 1,000 by 250 by 38 for the reception recess (LED groove), 1 at 800 by 200 for room 1. Primed, painted by us in the wall colour. Estimate until their quote; the LEDs are CBS's line."],
            ["Lapis Electric Clinic Bed", 1399, null, 1398.6, null, null],
            ["Floor plant, faux, about 1.2 m, stone pot", 0, null, 80, null, V61_EST],
            ["Coat hooks: a rail of 4, landing wall", 0, null, 40, null, V61_EST],
            ["Desk styling: vase of stems, tray, reed diffuser", 0, null, 60, null, V61_EST],
            ["Practitioner stool, room 1", 0, null, 120, null, V61_EST],
            ["Sharps bin, room 1", 0, null, 10, null, V61_EST],
            ["Floor stand for the Omega 7 lamp", 0, null, 70, null, V61_EST],
            ["Mirror and screen or tablet arm, over the room 1 desk", 0, null, 100, null, V61_EST],
            ["Lec Pharmacy Plus fridge, 47 L, glass door", 0, "Lec Pharmacy Plus fridge, 47 L, glass door (already owned)", 0, "paid", "Already owned: not a Winchester cost (owner, 14 October 2026)."],
            ["Skin analyser on its own trolley", 0, "Skin analyser trolley (with the platform)", 0, "paid", "Included in the skin analysis platform, 4,250, already paid (owner, 14 October 2026)."],
            ["Coffee machine, bean to cup", 0, "Coffee machine, bean to cup (already owned)", 0, "paid", "Already owned: not a Winchester cost (owner, 14 October 2026)."],
            ["Under-counter fridge, 600 wide (milk and staff)", 0, "Under-counter fridge, 600 wide (already owned)", 0, "paid", "Already owned: not a Winchester cost (owner, 14 October 2026)."],
            ["Howdens units and worktop: navy base, white wall, Calacatta top", 0, null, 600, null, V61_EST + " Ours, not CBS's (point 3)."],
            ["Full-length mirror, 500 by 1,500, safety backed", 0, null, 120, null, V61_EST],
            ["Clinical waste cupboard, lockable and vented", 0, null, 0, null, "Deferred until after opening, to keep cash (owner, 14 October 2026). 700 by 400, full height."],
            ["Staff lockers, 8 (4 by 2)", 0, null, 0, null, "Deferred until after opening, to keep cash (owner, 14 October 2026). 1,200 by 450 by 1,800."],
            ["COSHH and cleaning cupboard, lockable", 0, null, 0, null, "Deferred until after opening, to keep cash (owner, 14 October 2026)."],
          ];
          for (const [name, was, rename, amount, status, note] of V61_ITEMS) {
            await db.execute(sql`UPDATE kit_items SET name = coalesce(${rename}, name), amount_gbp = ${amount}, status = coalesce(${status}, status), note = coalesce(${note}, note), updated_at = NOW() WHERE project_id = ${projectId} AND name = ${name} AND round(amount_gbp::numeric, 2) = ${was} AND status = 'planned'`);
          }
          // Dropped by the owner: the LEDs (CBS's line), the wine cooler, and the take-home shelf now in the Bespoke Nature order.
          await db.execute(sql`DELETE FROM kit_items WHERE project_id = ${projectId} AND status = 'planned' AND ((name = 'LED Installs' AND round(amount_gbp::numeric, 2) = 1000) OR (name = 'Slimline wine cooler, 300 wide' AND amount_gbp = 0) OR (name = 'Take-home shelf over the room 1 desk, made by Bill' AND amount_gbp = 0))`);
          // The Jeanne chair to the lobby, and the coffee station's sink and tap.
          await db.execute(sql`UPDATE kit_items SET task_id = (SELECT id FROM launch_tasks WHERE title = ${V61_LOBBY} AND archived = FALSE LIMIT 1), area_key = 'lobby', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Jeanne cane chair (lobby, by the coffee station)' AND area_key = 'reception' AND EXISTS (SELECT 1 FROM launch_tasks WHERE title = ${V61_LOBBY} AND archived = FALSE)`);
        });
        await step("V61 coffee sink", () => db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
          SELECT ${projectId}, 'lobby', t.id, 'Compact sink and tap for the coffee station', 150, 'planned', ${V61_EST + " Ours; CBS connect it to the existing services."}
          FROM launch_tasks t WHERE t.title = ${V61_LOBBY} AND t.archived = FALSE AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Compact sink and tap for the coffee station') LIMIT 1`));
        // V62, 20 October 2026 (owner): the reception shelving unit costed. Bespoke Nature's four
        // shelves with the LEDs fitted, 813.29 with VAT, bought on David's Virgin card; the cabinet
        // under them from B&Q, 60.99, still to buy. The shelving line goes from its 500 estimate
        // to 874.28 and is part paid 813.29 (the card register holds the payment). The cabinet
        // leaves the Howdens cabinetry allowance, which now covers the treatment rooms only. The
        // reception LEDs come fitted, so CBS's LED line is now the power to them and the strips
        // under the treatment room cupboards. Each only while the line or item holds what it did.
        const V62_SHELF = "Product Display / Retail Shelving / LED Setup";
        await db.execute(sql`UPDATE kit_items SET name = 'Floating shelves, Bespoke Nature: 4 with LEDs fitted (3 reception, 1 room 1)', amount_gbp = 813.29, status = 'paid', note = 'Bought 20 October 2026 on David''s Virgin Money card, 813.29 with VAT (135.55, reclaimable): 3 at 1,000 by 250 by 38 for the reception recess and a take-home shelf for room 1, primed, LEDs fitted. Ask Bespoke Nature for a VAT invoice to the company.', updated_at = NOW() WHERE project_id = ${projectId} AND name LIKE 'Floating shelves, Bespoke Nature:%' AND round(amount_gbp::numeric, 2) = 500 AND status = 'planned'`);
        await step("V62 B&Q cabinet", () => db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
          SELECT ${projectId}, 'reception', t.id, 'Cabinet under the reception shelves, B&Q', 60.99, 'planned', 'B&Q, 60.99 with VAT (10.17). Still to buy (owner, 20 October 2026). Replaces the two Howdens base units the pack had in the recess.'
          FROM launch_tasks t WHERE t.title = ${V62_SHELF} AND t.archived = FALSE AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Cabinet under the reception shelves, B&Q') LIMIT 1`));
        await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 874.28, paid_status = 'part-paid', actual_cost = 813.29, amount_paid_gbp = 813.29, payment_date = '2026-10-20', updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 500 AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V62_SHELF} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 813.29, amount_paid_gbp = 813.29, payment_date = '2026-10-20', updated_at = NOW() WHERE title = ${V62_SHELF} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN ${V61_PHASES}`);
        await db.execute(sql`UPDATE kit_items SET name = 'Howdens cupboards and Calacatta worktops: both treatment rooms', note = 'Allowance until the Howdens quote: Clerkenwell navy base and white wall units with Calacatta laminate tops in both treatment rooms. Bill fits them, free. The reception recess cabinet is now a B&Q one on the shelving line (20 October 2026).', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Howdens cupboards and Calacatta worktops: both treatment rooms and the reception recess' AND status = 'planned'`);
        await db.execute(sql`UPDATE launch_tasks SET notes = coalesce(notes, '') || ' Since 20 October 2026 the reception shelves come from Bespoke Nature with their LEDs fitted: CBS power them (the spur and dimmer D3) and fit the strips under the wall cupboards in both treatment rooms.', updated_at = NOW() WHERE title = 'LED strips: reception shelves and treatment room cupboards (CBS variation)' AND archived = FALSE AND coalesce(notes, '') NOT LIKE '%Bespoke Nature with their LEDs fitted%' AND phase_id IN ${V61_PHASES}`);
        // V63, 20 October 2026 (owner): the B&Q cabinet under the reception shelves is bought, 60.99
        // on David's Virgin card. The item is paid, and the shelving line is paid in full, 874.28; the
        // card register holds both payments, so none of it comes out of the business bank. Each only
        // while the item or line holds what V62 left.
        await db.execute(sql`UPDATE kit_items SET status = 'paid', note = 'Bought by 20 October 2026, 60.99 on David''s Virgin Money card (VAT 10.17). Keep the B&Q receipt: it is the VAT receipt. Replaces the two Howdens base units the pack had in the recess.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Cabinet under the reception shelves, B&Q' AND status = 'planned'`);
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'paid', actual_cost = 874.28, amount_paid_gbp = 874.28, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 874.28 AND paid_status = 'part-paid' AND round(amount_paid_gbp::numeric, 2) = 813.29 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V62_SHELF} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'paid', actual_cost = 874.28, amount_paid_gbp = 874.28, updated_at = NOW() WHERE title = ${V62_SHELF} AND archived = FALSE AND paid_status = 'part-paid' AND round(amount_paid_gbp::numeric, 2) = 813.29 AND phase_id IN ${V61_PHASES}`);
        // V64, 20 October 2026 (owner): the reception coat stand. Two lines were added in the app at
        // 15:43 with only their names, figure and dates: the coat stand (81, quoted) and the CBS to-do
        // about the keypad, switches and socket behind it. This fills in the rest once: the notes and
        // Homary link, priorities, the October Virgin card plan, the to-do as the stand's dependency,
        // and Abi's board. The stand replaces the 40 coat hook rail, so that item goes and the
        // reception line falls by 40 to 2,424.23. Each only while it holds what the app left.
        {
          const V64_STAND = "Reception coat stand (Homary)", V64_CBS = "CBS: confirm moving keypad, switches and socket for the coat stand";
          const V64_LINK = "https://uk.homary.com/item/67-modern-chic-metal-freestanding-coat-rack-marble-base-in-black-18631.html";
          const V64_NOTE = "Homary free-standing coat stand: black poles, white marble base 400 by 300, 1,700 high. 81 with VAT, VAT reclaimable: ask Homary for a VAT invoice to the company. Goes left of the reception shelving on the ramp-side wall (the 70 proud section). It sits in front of the alarm keypad, switches and socket, so CBS are asked whether to move them towards the landing at first fix (the CBS line in Managed Building Works). Keep it clear of the fire kit to the right of the shelving. Replaces the coat hook rail on the landing wall. Buy on the Virgin card by 29 October 2026 for the 0%. " + V64_LINK;
          const V64_CBS_NOTE = "Ask CBS before first fix: can the alarm keypad, the switches and the socket on the ramp-side wall, left of the reception shelving (the 70 proud section), move towards the landing? The Homary coat stand stands in front of them. CBS's answer decides where the stand goes. Owner, 20 October 2026.";
          const V64_QUOTES = JSON.stringify([{ id: "homary-2026-10-20", company: "Homary", amount: 81, notes: V64_LINK, date: "2026-10-20", status: "accepted" }]);
          const V64_OCT_CARD = '[{"month":"2026-10","share":1,"method":"card"}]';
          await step("V64 coat stand", async () => {
            await db.execute(sql`UPDATE launch_tasks SET notes = ${V64_CBS_NOTE}, priority = 'high', contractor = 'CBS', due_date = '2026-10-23', budget_status = '£0 admin task', include_in_launch_budget = TRUE, updated_at = NOW() WHERE title = ${V64_CBS} AND archived = FALSE AND coalesce(notes, '') = '' AND phase_id IN ${V61_PHASES}`);
            await db.execute(sql`UPDATE property_task_overrides SET notes = ${V64_CBS_NOTE}, contractor = 'CBS', updated_at = NOW() WHERE coalesce(notes, '') = '' AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V64_CBS} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
            await db.execute(sql`UPDATE launch_tasks SET notes = ${V64_NOTE}, supplier = 'Homary', priority = 'low', cost_tier = 'quoted', cost_low = 81, cost_mid = 81, cost_high = 81, selected_cost = 81, cost_vat_status = 'inc_vat', procurement_status = 'quote_received', due_date = '2026-11-27', payment_plan_json = ${V64_OCT_CARD}, include_in_launch_budget = TRUE, quotes = ${V64_QUOTES}::jsonb, dependencies = (SELECT '[' || id || ']' FROM launch_tasks WHERE title = ${V64_CBS} AND archived = FALSE LIMIT 1), updated_at = NOW() WHERE title = ${V64_STAND} AND archived = FALSE AND coalesce(notes, '') = '' AND phase_id IN ${V61_PHASES}`);
            await db.execute(sql`UPDATE property_task_overrides SET notes = ${V64_NOTE}, supplier = 'Homary', cost_tier = 'quoted', cost_low = 81, cost_mid = 81, cost_high = 81, selected_cost = 81, cost_vat_status = 'inc_vat', procurement_status = 'quote_received', quotes = ${V64_QUOTES}::jsonb, updated_at = NOW() WHERE coalesce(notes, '') = '' AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${V64_STAND} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
            await db.execute(sql`INSERT INTO kit_lines (project_id, task_id, area_key, sort_order, label)
              SELECT ${projectId}, t.id, 'reception', coalesce((SELECT max(sort_order) FROM kit_lines WHERE project_id = ${projectId} AND area_key = 'reception'), 0) + 1, 'Coat stand (Homary)' FROM launch_tasks t WHERE t.title = ${V64_STAND} AND t.archived = FALSE AND t.phase_id IN ${V61_PHASES} AND NOT EXISTS (SELECT 1 FROM kit_lines l WHERE l.task_id = t.id) LIMIT 1`);
            await db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
              SELECT ${projectId}, 'reception', t.id, 'Coat stand, Homary: black poles, white marble base', 81, 'planned', ${"Not yet bought. 400 by 300 base, 1,700 high. Buy on the Virgin card by 29 October 2026. " + V64_LINK} FROM launch_tasks t WHERE t.title = ${V64_STAND} AND t.archived = FALSE AND t.phase_id IN ${V61_PHASES} AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Coat stand, Homary: black poles, white marble base') LIMIT 1`);
            await db.execute(sql`DELETE FROM kit_items WHERE project_id = ${projectId} AND name = 'Coat hooks: a rail of 4, landing wall' AND round(amount_gbp::numeric, 2) = 40 AND status = 'planned'`);
            await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2424.23, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2464.23 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
            await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2424.23, updated_at = NOW() WHERE title = 'Reception furniture and styling (verified schedule)' AND archived = FALSE AND round(selected_cost::numeric, 2) = 2464.23 AND phase_id IN ${V61_PHASES}`);
          });
        }
        // V65, 20 October 2026 (owner): the hand-wash dispensers and the first soap bought, all on
        // David's Virgin card (the card register holds the payments). Cleaning Supplies Shop, 120.79:
        // two Tork S4 soap dispensers, one per treatment room, and two Tork Extra Mild foam soaps for
        // the consumables line. Viking, 35.99: one Tork H2 towel dispenser for room 1, with a free pack
        // of H2 towels; room 2's towel dispenser is still to order, at the same 35.99. Room 1 swaps its
        // 121 allowance for 68.11 bought and falls to 1,818.49; room 2 goes from 0 to 68.12, its
        // soap dispenser bought; consumables part paid 56.54. Each only while it holds what it did.
        await step("V65 dispensers", async () => {
          const ROOM1 = "Treatment Room Furniture, Equipment and Styling Package", ROOM2 = "Consultation Room Furniture and Styling Package", CONS = "Clinical Smallwares and Consumables";
          const SHOP = "Cleaning Supplies Shop order, 20 October 2026, on David's Virgin Money card: one of two S4 soap dispensers (64.25 for both) and two Extra Mild foam soaps, 120.79 in all. Takes Tork S4 sealed refills: Extra Mild foam soap 520701.";
          await db.execute(sql`UPDATE kit_items SET name = 'Tork S4 soap dispenser, black (room 1)', amount_gbp = 32.12, status = 'paid', note = ${"Bought 20 October 2026, 32.12 with VAT. " + SHOP}, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Tork soap and towel dispensers, black' AND round(amount_gbp::numeric, 2) = 121 AND status = 'planned'`);
          await db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
            SELECT ${projectId}, 'treatment', t.id, 'Tork H2 towel dispenser, black (room 1)', 35.99, 'paid', 'Bought 20 October 2026 from Viking (order GB-VK-804384271W), 35.99 with VAT, on David''s Virgin Money card, with a free pack of Tork H2 brown 2-ply towels. Ask Viking for the invoice in the company''s name.' FROM launch_tasks t WHERE t.title = ${ROOM1} AND t.archived = FALSE AND t.phase_id IN ${V61_PHASES} AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Tork H2 towel dispenser, black (room 1)') LIMIT 1`);
          await db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
            SELECT ${projectId}, 'treatment', t.id, v.n, v.a, v.s, v.note FROM launch_tasks t, (VALUES
              ('Tork S4 soap dispenser, black (room 2)', 32.13, 'paid', ${"Bought 20 October 2026, 32.13 with VAT. " + SHOP}),
              ('Tork H2 towel dispenser, black (room 2)', 35.99, 'planned', 'Still to order: the same Viking dispenser as room 1, 35.99 with VAT (owner, 20 October 2026).')
            ) AS v(n, a, s, note) WHERE t.title = ${ROOM2} AND t.archived = FALSE AND t.phase_id IN ${V61_PHASES} AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = v.n)`);
          await db.execute(sql`UPDATE kit_items SET name = 'Room 2: stool, Omega 7 lamp, trolley, fridge (deferred)', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Room 2: stool, Omega 7 lamp, trolley, fridge, dispensers (deferred)'`);
          // Room 1: the allowance swapped for what was bought; 233.71 paid on the card in all.
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1818.49, actual_cost = 233.71, amount_paid_gbp = 233.71, payment_date = '2026-10-20', updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 1871.38 AND round(amount_paid_gbp::numeric, 2) = 165.6 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${ROOM1} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET actual_cost = 233.71, amount_paid_gbp = 233.71, payment_date = '2026-10-20', updated_at = NOW() WHERE title = ${ROOM1} AND archived = FALSE AND round(amount_paid_gbp::numeric, 2) = 165.6 AND phase_id IN ${V61_PHASES}`);
          // Room 2: its two dispensers, the soap one bought.
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 68.12, paid_status = 'part-paid', actual_cost = 32.13, amount_paid_gbp = 32.13, payment_date = '2026-10-20', updated_at = NOW() WHERE coalesce(selected_cost, 0) = 0 AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${ROOM2} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 32.13, amount_paid_gbp = 32.13, payment_date = '2026-10-20', updated_at = NOW() WHERE title = ${ROOM2} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN ${V61_PHASES}`);
          // Consumables: the first soap refills.
          const CONS_NOTE = " Bought 20 October 2026 on David's Virgin card: 2 Tork Extra Mild foam soaps, 1 litre (520701), 56.54 with VAT, from Cleaning Supplies Shop; a free pack of Tork H2 brown 2-ply towels (21 packs of 180) came with Viking's towel dispenser. Repeat soap: a 6-pack is cheaper (Smart UK, about 16.50 a litre with VAT).";
          await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'part-paid', actual_cost = 56.54, amount_paid_gbp = 56.54, payment_date = '2026-10-20', notes = coalesce(notes, (SELECT notes FROM launch_tasks WHERE id = property_task_overrides.task_id), '') || ${CONS_NOTE}, updated_at = NOW() WHERE coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${CONS} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 56.54, amount_paid_gbp = 56.54, payment_date = '2026-10-20', notes = coalesce(notes, '') || ${CONS_NOTE}, updated_at = NOW() WHERE title = ${CONS} AND archived = FALSE AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN ${V61_PHASES}`);
        });
        // V66, 20 October 2026 (owner): room 2's towel dispenser bought from Viking on David's Virgin
        // card, 43.13 with the 7.14 delivery (VAT 7.19). Room 2's two dispensers are now both bought:
        // the line goes from 68.12 to 75.26 and is paid. Only while it holds what V65 left.
        await step("V66 room 2 towel dispenser", async () => {
          const ROOM2 = "Consultation Room Furniture and Styling Package";
          await db.execute(sql`UPDATE kit_items SET amount_gbp = 43.13, status = 'paid', note = 'Bought 20 October 2026 from Viking, 35.99 plus 7.14 delivery, 43.13 with VAT (7.19), on David''s Virgin Money card. Ask Viking for the invoice in the company''s name.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Tork H2 towel dispenser, black (room 2)' AND round(amount_gbp::numeric, 2) = 35.99 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 75.26, paid_status = 'paid', actual_cost = 75.26, amount_paid_gbp = 75.26, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 68.12 AND paid_status = 'part-paid' AND round(amount_paid_gbp::numeric, 2) = 32.13 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${ROOM2} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET paid_status = 'paid', actual_cost = 75.26, amount_paid_gbp = 75.26, updated_at = NOW() WHERE title = ${ROOM2} AND archived = FALSE AND paid_status = 'part-paid' AND round(amount_paid_gbp::numeric, 2) = 32.13 AND phase_id IN ${V61_PHASES}`);
        });
        // V67, 20 October 2026 (owner): room 1's lamp bought, and three loose ends a check found.
        // The Luxamed LED examination lamp on its 5 ft stand, 331.20 with VAT on David's Virgin card,
        // replaces the Omega 7 magnifier lamp (244.99) and its floor stand (70): room 1 goes from
        // 1,818.49 to 1,834.70, part paid 564.91. Then: the desk's figure on the property, zeroed by
        // the old save bug on 18 October, goes back to its committed 1,000; the coffee station's units,
        // mirror and sink go to 0 until the quote, as the owner asked, leaving the Jeanne chair (149.99)
        // as the line's only figure; and the two paint entries on Abi's board, whose plan lines the
        // owner deleted, come off it (the paint area stays: it is V38's marker). Each only while it
        // holds what it did.
        await step("V67 lamp and loose ends", async () => {
          const ROOM1 = "Treatment Room Furniture, Equipment and Styling Package", LOBBY = "Lobby coffee station: machine, fridge, wine cooler, cupboards";
          await db.execute(sql`UPDATE kit_items SET name = 'Luxamed LED examination lamp on 5 ft stand, white', amount_gbp = 331.2, status = 'paid', note = 'Bought 20 October 2026 from Luxamed on David''s Virgin Money card: 299.99 less a 23.99 discount code, 276.00 plus 55.20 VAT, 331.20, free delivery. Replaces the Omega 7 magnifier lamp and its stand. Ask Luxamed for a VAT invoice to the company.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Daylight Omega 7 magnifier lamp' AND round(amount_gbp::numeric, 2) = 244.99 AND status = 'planned'`);
          await db.execute(sql`DELETE FROM kit_items WHERE project_id = ${projectId} AND name = 'Floor stand for the Omega 7 lamp' AND round(amount_gbp::numeric, 2) = 70 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1834.7, actual_cost = 564.91, amount_paid_gbp = 564.91, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 1818.49 AND round(amount_paid_gbp::numeric, 2) = 233.71 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${ROOM1} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET actual_cost = 564.91, amount_paid_gbp = 564.91, updated_at = NOW() WHERE title = ${ROOM1} AND archived = FALSE AND round(amount_paid_gbp::numeric, 2) = 233.71 AND phase_id IN ${V61_PHASES}`);
          // The desk: the property's figure back to the committed 1,000.
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1000, updated_at = NOW() WHERE coalesce(selected_cost, 0) = 0 AND task_id IN (SELECT id FROM launch_tasks WHERE title = 'Reception desk, Artisan Deco (custom, Corian top)' AND archived = FALSE AND round(committed_cost::numeric, 2) = 1000 AND phase_id IN ${V61_PHASES})`);
          // The coffee station: its parts to 0 until the quote; the chair is the line's figure.
          for (const [name, was] of [["Howdens units and worktop: navy base, white wall, Calacatta top", 600], ["Full-length mirror, 500 by 1,500, safety backed", 120], ["Compact sink and tap for the coffee station", 150]] as const) {
            await db.execute(sql`UPDATE kit_items SET amount_gbp = 0, note = ${`At 0 until the coffee station quote (owner, 20 October 2026); the estimate was ${was}.`}, updated_at = NOW() WHERE project_id = ${projectId} AND name = ${name} AND round(amount_gbp::numeric, 2) = ${was} AND status = 'planned' AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${LOBBY})`);
          }
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 149.99, updated_at = NOW() WHERE coalesce(selected_cost, 0) = 0 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${LOBBY} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET selected_cost = 149.99, updated_at = NOW() WHERE title = ${LOBBY} AND archived = FALSE AND round(selected_cost::numeric, 2) = 1019.99 AND phase_id IN ${V61_PHASES}`);
          // The paint entries whose plan lines were deleted.
          await db.execute(sql`DELETE FROM kit_lines l WHERE l.project_id = ${projectId} AND l.area_key = 'paint' AND l.label IN ('Outside: the shopfront white and blue', 'Inside: walls, ceilings and woodwork') AND NOT EXISTS (SELECT 1 FROM launch_tasks t WHERE t.id = l.task_id)`);
          await db.execute(sql`UPDATE kit_areas SET covers = 'The paint is in CBS''s price: the decorating (Ref 14) and the shopfront (Ref 17). The colours are on the finishes board. Nothing to buy here (owner, 20 October 2026).' WHERE project_id = ${projectId} AND area_key = 'paint' AND covers LIKE 'The paint you buy for the decorators%'`);
        });
        // V68, 20 October 2026 (owner): the reception desk's vase of stems bought on David's Virgin
        // card, 107.99 with VAT (18.00): a faux blue berry and pussy willow arrangement and a Thea white
        // ceramic vase, 119.98 less an 11.99 welcome code. The desk styling item keeps its 60 for the
        // tray and reed diffuser, still to buy, so reception rises by 107.99 to 2,532.22, part paid
        // 2,392.22. Only while it holds what it did.
        await step("V68 reception vase", async () => {
          const RECEP = "Reception furniture and styling (verified schedule)";
          await db.execute(sql`INSERT INTO kit_items (project_id, area_key, task_id, name, amount_gbp, status, note)
            SELECT ${projectId}, 'reception', t.id, 'Faux blue berry and pussy willow arrangement, Thea white ceramic vase (desk)', 107.99, 'paid', 'Bought 20 October 2026 on David''s Virgin Money card: arrangement 59.99 and vase 59.99, less an 11.99 welcome code, 107.99 with VAT (18.00), free delivery. Ask for a VAT invoice to the company.' FROM launch_tasks t WHERE t.title = ${RECEP} AND t.archived = FALSE AND t.phase_id IN ${V61_PHASES} AND NOT EXISTS (SELECT 1 FROM kit_items i WHERE i.project_id = ${projectId} AND i.name = 'Faux blue berry and pussy willow arrangement, Thea white ceramic vase (desk)') LIMIT 1`);
          await db.execute(sql`UPDATE kit_items SET name = 'Desk styling: tray and reed diffuser', note = 'Estimate (owner, 14 October 2026); the vase of stems is bought (20 October 2026). Replace with the real price when bought.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Desk styling: vase of stems, tray, reed diffuser' AND round(amount_gbp::numeric, 2) = 60 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 2532.22, actual_cost = 2392.22, amount_paid_gbp = 2392.22, payment_date = '2026-10-20', updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 2424.23 AND round(amount_paid_gbp::numeric, 2) = 2284.23 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${RECEP} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET selected_cost = 2532.22, actual_cost = 2392.22, amount_paid_gbp = 2392.22, payment_date = '2026-10-20', updated_at = NOW() WHERE title = ${RECEP} AND archived = FALSE AND round(selected_cost::numeric, 2) = 2424.23 AND round(amount_paid_gbp::numeric, 2) = 2284.23 AND phase_id IN ${V61_PHASES}`);
        });
        // V69, 20 October 2026 (owner): the work trainers bought from ASOS, two pairs of New Balance
        // 9060 for Abi and David: 320 less a 24 discount and a 160 gift voucher, 136 on David's Virgin
        // card. The voucher is not counted (owner), so the line goes from its 90.80 to 136 and is paid.
        // Plain trainers may not count as work clothing for VAT or tax: the note says to check with the
        // accountant. Only while the line and item hold what they did.
        await step("V69 trainers", async () => {
          const TRAINERS = "Trainers - Abi and David";
          const NOTE = "Bought 20 October 2026 from ASOS (order 1072388108), two pairs of New Balance 9060, sold and shipped by New Balance: 320 less a 24 discount and a 160 gift voucher, 136 on David's Virgin card. The voucher is not counted (owner). Everyday trainers may not be allowable as work clothing: ask Mark Wolfe & Co before reclaiming the VAT or claiming them against tax.";
          await db.execute(sql`UPDATE kit_items SET name = 'New Balance 9060 trainers, Abi and David (ASOS)', amount_gbp = 136, status = 'paid', note = ${NOTE}, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Work trainers, Abi and David' AND round(amount_gbp::numeric, 2) = 90.8 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 136, cost_tier = 'quoted', paid_status = 'paid', actual_cost = 136, amount_paid_gbp = 136, payment_date = '2026-10-20', updated_at = NOW() WHERE coalesce(paid_status, '') <> 'paid' AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${TRAINERS} AND archived = FALSE AND round(selected_cost::numeric, 2) = 90.8 AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET selected_cost = 136, cost_tier = 'quoted', paid_status = 'paid', actual_cost = 136, amount_paid_gbp = 136, payment_date = '2026-10-20', status = 'in_progress', notes = ${NOTE}, updated_at = NOW() WHERE title = ${TRAINERS} AND archived = FALSE AND round(selected_cost::numeric, 2) = 90.8 AND coalesce(paid_status, '') <> 'paid' AND phase_id IN ${V61_PHASES}`);
        });
        // V70, 21 October 2026 (owner's orders tracker, built from the order emails): the coat stand
        // is bought, 81 on David's Virgin card (Homary order UKA2610201549195576438, shipping by sea),
        // so its line is paid; a Toolstation laser distance measure and coin batteries, 30.49 on the
        // card, collected 16 and 18 October, become a small paid line of their own; and the delivery
        // dates the tracker holds go on the items they belong to. Each only while it holds what it did.
        await step("V70 orders tracker", async () => {
          const STAND = "Reception coat stand (Homary)", TOOLS = "Fit-out tools: laser distance measure and batteries (Toolstation)";
          await db.execute(sql`UPDATE kit_items SET status = 'paid', note = 'Bought 20 October 2026 from Homary, order UKA2610201549195576438, 81 with VAT on David''s Virgin Money card. Shipping by sea: chase the date, as it may arrive after opening. 400 by 300 base, 1,700 high. https://uk.homary.com/item/67-modern-chic-metal-freestanding-coat-rack-marble-base-in-black-18631.html', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Coat stand, Homary: black poles, white marble base' AND round(amount_gbp::numeric, 2) = 81 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'paid', actual_cost = 81, amount_paid_gbp = 81, payment_date = '2026-10-20', status = 'in_progress', updated_at = NOW() WHERE coalesce(paid_status, '') <> 'paid' AND round(selected_cost::numeric, 2) = 81 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${STAND} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET paid_status = 'paid', actual_cost = 81, amount_paid_gbp = 81, payment_date = '2026-10-20', status = 'in_progress', updated_at = NOW() WHERE title = ${STAND} AND archived = FALSE AND coalesce(paid_status, '') <> 'paid' AND phase_id IN ${V61_PHASES}`);
          await db.execute(sql`INSERT INTO launch_tasks (phase_id, title, notes, owner, supplier, status, risk_level, cost_tier, selected_cost, actual_cost, amount_paid_gbp, paid_status, payment_date, cost_vat_status, supply_scope, procurement_status, priority, budget_status, include_in_launch_budget, include_in_risk_view, payment_plan_json, sort_order)
            SELECT p.id, ${TOOLS}, 'Toolstation orders YWW556588255 and YWW558094189, collected 16 and 18 October 2026: a laser distance measure and coin batteries, 30.49 with VAT on David''s Virgin Money card. Keep the receipts for the VAT.', 'David', 'Toolstation', 'complete', 'low', 'quoted', 30.49, 30.49, 30.49, 'paid', '2026-10-18', 'inc_vat', 'to_confirm', 'quote_received', 'low', 'Included in approved launch budget', TRUE, TRUE, '[{"month":"2026-10","share":1,"method":"card"}]', coalesce((SELECT max(sort_order) FROM launch_tasks WHERE phase_id = p.id), 0) + 1
            FROM launch_phases p WHERE p.project_id = ${projectId} AND p.status = 'active' AND p.name = 'FF&E, Equipment & Clinic Styling' AND NOT EXISTS (SELECT 1 FROM launch_tasks t WHERE t.title = ${TOOLS}) LIMIT 1`);
          // The dates the tracker holds, on their items.
          for (const [name, add] of [
            ["Ingrid round side table, Cult Furniture", " Cult: available 17 November 2026; the change to the Pebble colour is not confirmed yet (orders tracker, 21 October)."],
            ["Reception desk, Artisan Deco: curved, fluted, Corian top", " Delivery estimated 3 to 13 November 2026; pay the 655 balance before it comes (orders tracker, 21 October)."],
            ["Floating shelves, Bespoke Nature: 4 with LEDs fitted (3 reception, 1 room 1)", " Paid and being made (order 6974349): needed on site by 16 November 2026 (orders tracker, 21 October)."],
          ] as const) {
            await db.execute(sql`UPDATE kit_items SET note = coalesce(note, '') || ${add}, updated_at = NOW() WHERE project_id = ${projectId} AND name = ${name} AND coalesce(note, '') NOT LIKE '%orders tracker, 21 October%'`);
          }
        });
        // V71, 21 October 2026 (owner): the Fixed Monthly Costs list on the Money page follows the
        // utilities the model now uses. Electricity on EDF's Fixed Online 3 Year tariff from 24 October
        // (26.2p a kWh, 65p a day, before VAT) at about 7,500 kWh a year is 183.52 a month: 184. Water
        // and sewerage about 20. Each only while it holds the old figure.
        await step("V71 utilities", async () => {
          await db.execute(sql`UPDATE fixed_cost_items SET name = 'Utilities - Electricity (EDF fixed to Oct 2029, 26.2p a kWh, 65p a day)', amount_gbp = 184, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Utilities - Electricity' AND round(amount_gbp::numeric, 2) = 180`);
          await db.execute(sql`UPDATE fixed_cost_items SET amount_gbp = 20, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Utilities - Water and Sewerage' AND round(amount_gbp::numeric, 2) = 30`);
        });
        // V72, 21 October 2026 (owner): broadband is Vodafone Business Pro II Full Fibre 910 from 17
        // November 2026 for 36 months, with nothing upfront: 32 a month before VAT to March 2027, then
        // 34.92, 37.84 and 40.76 from each April, about 1,320 in all before VAT. The 120 set-up line
        // goes to 0 (saving 120 on the card) and the monthly cost is a running cost, so the Money page's
        // list takes 32 for its 40 allowance. Each only while it holds what it did.
        await step("V72 broadband", async () => {
          const LINE = "Broadband Availability / Setup";
          const NOTE = " Vodafone Business Pro II Full Fibre 910 from 17 November 2026, 36 months to 17 November 2029, nothing upfront: 32.00 a month before VAT (38.40 with) to March 2027, 34.92 from April 2027, 37.84 from April 2028, 40.76 from April 2029, about 1,320 before VAT over the contract. Set-up is 0, so this line is 0 and the monthly cost is in running costs (owner, 21 October 2026).";
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 0, status = 'in_progress', supplier = 'Vodafone', notes = coalesce(notes, (SELECT notes FROM launch_tasks WHERE id = property_task_overrides.task_id), '') || ${NOTE}, updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 120 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${LINE} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET selected_cost = 0, cost_tier = 'quoted', status = 'in_progress', supplier = 'Vodafone', notes = coalesce(notes, '') || ${NOTE}, updated_at = NOW() WHERE title = ${LINE} AND archived = FALSE AND round(selected_cost::numeric, 2) = 100 AND phase_id IN ${V61_PHASES}`);
          await db.execute(sql`UPDATE fixed_cost_items SET name = 'Utilities - Broadband (Vodafone Full Fibre 910, from 17 Nov 2026, rises each April)', amount_gbp = 32, updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Utilities - Internet' AND round(amount_gbp::numeric, 2) = 40`);
        });
        // V73, 23 October 2026 (owner): CBS's first interim payment under the JCT Minor Works contract,
        // invoice 1 against Q2002C: 22,975 of work valued, less the 3% retention (689.25), 22,285.75,
        // plus VAT 4,457.15, 26,742.90 in all. The business bank pays the 22,285.75; Abi lends the
        // company the 4,457.15 VAT as a director's loan (held in the register under her account), repaid
        // when the VAT comes back from HMRC. Each Ref line is part paid by its share of the invoice (the
        // invoice's 25.0 fire-stopping sits in Ref 3, 10.1 to 10.3 in Ref 10, 11.0 and 11.1 in Ref 11,
        // 13.1 and 13.2 in Ref 13). What is left on each line, Abi's VAT among it, moves to the next
        // valuations, November and December in the ratio the stages had (60 to 17), with 3% of the line
        // held to May 2027 as the retention. Each only while the line is still unpaid as committed.
        await step("V73 CBS interim 1", async () => {
          const INV1: [number, number, number, number, string][] = [[1,1000,970,194,"[{\"month\":\"2026-11\",\"share\":0.7495,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2124,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0381,\"method\":\"bank\"}]"],[2,2535,2458.95,491.79,"[{\"month\":\"2026-11\",\"share\":0.6573,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.1862,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.1565,\"method\":\"bank\"}]"],[3,7000,6790,1358,"[{\"month\":\"2026-11\",\"share\":0.7249,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2054,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0697,\"method\":\"bank\"}]"],[4,1230,1193.1,238.62,"[{\"month\":\"2026-11\",\"share\":0.7371,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2088,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0541,\"method\":\"bank\"}]"],[6,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"],[7,4000,3880,776,"[{\"month\":\"2026-11\",\"share\":0.7453,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2112,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0435,\"method\":\"bank\"}]"],[8,620,601.4,120.28,"[{\"month\":\"2026-11\",\"share\":0.7503,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2126,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0371,\"method\":\"bank\"}]"],[10,1325,1285.25,257.05,"[{\"month\":\"2026-11\",\"share\":0.7483,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.212,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0397,\"method\":\"bank\"}]"],[11,5265,5107.05,1021.41,"[{\"month\":\"2026-11\",\"share\":0.7455,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2112,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.0433,\"method\":\"bank\"}]"],[13,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"],[14,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"],[17,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"],[18,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"],[21,0,0,0,"[{\"month\":\"2026-11\",\"share\":0.7558,\"method\":\"bank\"},{\"month\":\"2026-12\",\"share\":0.2142,\"method\":\"bank\"},{\"month\":\"2027-05\",\"share\":0.03,\"method\":\"bank\"}]"]];
          for (const [ref, inv, net, vat, plan] of INV1) {
            const note = ` CBS interim payment 1, 23 October 2026 (Q2002C invoice 1): ${inv.toFixed(2)} of this ref valued, less 3% retention, ${net.toFixed(2)} paid from the business bank, plus ${vat.toFixed(2)} VAT paid by Abi as a director's loan, to be repaid when the VAT is refunded.`;
            if (inv > 0) {
              await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = ${r2sql(net + vat)}, amount_paid_gbp = ${r2sql(net + vat)}, payment_date = '2026-10-23', invoice_ref = 'CBS Q2002C invoice 1', invoice_date = '2026-10-23', payment_plan_json = ${plan}, notes = coalesce(notes, '') || ${note}, updated_at = NOW() WHERE title ~ ${'^Ref ' + ref + ' - '} AND archived = FALSE AND coalesce(paid_status, 'committed') = 'committed' AND amount_paid_gbp IS NULL AND phase_id IN ${V61_PHASES}`);
            } else {
              await db.execute(sql`UPDATE launch_tasks SET payment_plan_json = ${plan}, notes = coalesce(notes, '') || ' Nothing on CBS invoice 1 (23 October 2026): its payments move to the November and December valuations, with 3% held to May 2027.', updated_at = NOW() WHERE title ~ ${'^Ref ' + ref + ' - '} AND archived = FALSE AND coalesce(paid_status, 'committed') = 'committed' AND amount_paid_gbp IS NULL AND payment_plan_json LIKE '%2026-10%' AND phase_id IN ${V61_PHASES}`);
            }
          }
        });
        // V74, 26 October 2026 (owner): the basins, taps and wastes bought from B&Q on David's Virgin
        // card, order 1070981266, 449.73, delivering 27 to 28 October: three sets of an Aveli fluted
        // round countertop basin (69.99), a Plum&Clay black click-clack waste (18.60) and a Reginox
        // Taravo matt black swan neck mixer (54.99), 143.58 a set, and silicone sealant (18.99). Two
        // sets and the sealant are the treatment rooms' (306.15, for the Arezzo and Alberta allowance of
        // 319.80), the third the lobby coffee station's sink (it was at 0 until the quote). Room 1 goes
        // to 1,821.05, part paid 871.06; the coffee station to 293.57, part paid 143.58. Each only while
        // it holds what it did.
        await step("V74 B&Q basins", async () => {
          const ROOM1 = "Treatment Room Furniture, Equipment and Styling Package", LOBBY = "Lobby coffee station: machine, fridge, wine cooler, cupboards";
          await db.execute(sql`UPDATE kit_items SET name = 'Basins, taps and wastes, both treatment rooms: Aveli fluted, Reginox matt black (B&Q)', amount_gbp = 306.15, status = 'paid', note = 'Bought 26 October 2026 from B&Q (order 1070981266) on David''s Virgin Money card: 2 Aveli fluted gloss white round countertop basins 360 by 360, 2 Reginox Taravo matt black swan neck mixers, 2 Plum&Clay black click-clack wastes, and Dryzone anti-mould sealant, 306.15 with VAT. Delivering 27 to 28 October. We supply, CBS fit: ask CBS for the credit on Ref 10.1, which priced their own basins and taps.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Arezzo basins and Alberta taps, both rooms' AND round(amount_gbp::numeric, 2) = 319.8 AND status = 'planned'`);
          await db.execute(sql`UPDATE kit_items SET name = 'Coffee station sink: Aveli fluted basin, Reginox matt black tap, waste (B&Q)', amount_gbp = 143.58, status = 'paid', note = 'Bought 26 October 2026 from B&Q (order 1070981266) on David''s Virgin Money card: an Aveli fluted gloss white round countertop basin 360 by 360 (69.99), a Reginox Taravo matt black swan neck mixer (54.99) and a Plum&Clay black click-clack waste (18.60), 143.58 with VAT. Ours; CBS connect it to the existing services.', updated_at = NOW() WHERE project_id = ${projectId} AND name = 'Compact sink and tap for the coffee station' AND amount_gbp = 0 AND status = 'planned'`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 1821.05, actual_cost = 871.06, amount_paid_gbp = 871.06, payment_date = '2026-10-26', updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 1834.7 AND round(amount_paid_gbp::numeric, 2) = 564.91 AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${ROOM1} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET actual_cost = 871.06, amount_paid_gbp = 871.06, payment_date = '2026-10-26', updated_at = NOW() WHERE title = ${ROOM1} AND archived = FALSE AND round(amount_paid_gbp::numeric, 2) = 564.91 AND phase_id IN ${V61_PHASES}`);
          await db.execute(sql`UPDATE property_task_overrides SET selected_cost = 293.57, paid_status = 'part-paid', actual_cost = 143.58, amount_paid_gbp = 143.58, payment_date = '2026-10-26', updated_at = NOW() WHERE round(selected_cost::numeric, 2) = 149.99 AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND task_id IN (SELECT id FROM launch_tasks WHERE title = ${LOBBY} AND archived = FALSE AND phase_id IN ${V61_PHASES})`);
          await db.execute(sql`UPDATE launch_tasks SET selected_cost = 293.57, paid_status = 'part-paid', actual_cost = 143.58, amount_paid_gbp = 143.58, payment_date = '2026-10-26', updated_at = NOW() WHERE title = ${LOBBY} AND archived = FALSE AND round(selected_cost::numeric, 2) = 149.99 AND coalesce(paid_status, '') NOT IN ('paid', 'part-paid') AND phase_id IN ${V61_PHASES}`);
        });
        await db.execute(sql`UPDATE launch_tasks SET paid_status = 'part-paid', actual_cost = 350, amount_paid_gbp = 350 WHERE title ILIKE 'External Signage Package%' AND coalesce(paid_status, '') NOT IN ('part-paid', 'paid') AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE property_task_overrides SET paid_status = 'part-paid', actual_cost = 350, amount_paid_gbp = 350 WHERE task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'External Signage Package%' AND coalesce(paid_status, '') NOT IN ('part-paid', 'paid') AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        // (d) Insurance carries insurance premium tax, not VAT.
        await db.execute(sql`UPDATE launch_tasks SET invoice_vat_status = 'exempt' WHERE title ILIKE 'Hamilton Fraser%' AND coalesce(invoice_vat_status, '') <> 'exempt' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        await db.execute(sql`UPDATE property_task_overrides SET invoice_vat_status = 'exempt' WHERE task_id IN (SELECT id FROM launch_tasks WHERE title ILIKE 'Hamilton Fraser%' AND coalesce(invoice_vat_status, '') <> 'exempt' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId}))`);
        // (e) BAMAN membership removed by the owner: archived, not deleted.
        await db.execute(sql`UPDATE launch_tasks SET archived = TRUE, archived_reason = 'Removed by the owner on 30 September 2026' WHERE title ILIKE 'BAMAN membership%' AND archived = FALSE AND phase_id IN (SELECT id FROM launch_phases WHERE project_id = ${projectId})`);
        // (f) Funding: the two old loans archived; James's equity, Bill's gift and James's new loan added.
        await db.execute(sql`UPDATE investments SET archived = TRUE, notes = 'Superseded 30 September 2026: James is equity (10%, 37,000) and Bill is a gift (10,000). ' || notes WHERE project_id = ${projectId} AND archived = FALSE AND name IN ('Founding Investment - James Gibbons', 'Angel Loan - Bill Peters')`);
        await db.execute(sql`INSERT INTO investments (project_id, name, type, amount_gbp, equity_percent, deposit_date, notes) SELECT ${projectId}, 'James Gibbons (Sky Holdings Ltd): equity', 'equity', 37000, 10, '2026-10-01', 'Equity investment for 10% from October 2026. No repayments.' WHERE NOT EXISTS (SELECT 1 FROM investments WHERE project_id = ${projectId} AND name = 'James Gibbons (Sky Holdings Ltd): equity')`);
        await db.execute(sql`INSERT INTO investments (project_id, name, type, amount_gbp, deposit_date, notes) SELECT ${projectId}, 'Bill Peters: gift', 'gift', 10000, '2026-10-01', 'Gift, no repayments. Check the tax treatment with the accountant.' WHERE NOT EXISTS (SELECT 1 FROM investments WHERE project_id = ${projectId} AND name = 'Bill Peters: gift')`);
        await db.execute(sql`INSERT INTO investments (project_id, name, type, amount_gbp, equity_percent, interest_rate_percent, repayment_term_months, holiday_months, equity_kicker_percent, deposit_date, first_payment_date, notes) SELECT ${projectId}, 'James Gibbons (Sky Holdings Ltd): loan', 'loan', 10000, 0, 5, 30, 6, 1, '2026-11-26', '2027-06-01', 'Drawn at opening. 5% a year, 6-month repayment holiday with interest accruing, then 30 monthly repayments of about 365 from June 2027. Equity kicker 1%, issue to be confirmed.' WHERE NOT EXISTS (SELECT 1 FROM investments WHERE project_id = ${projectId} AND name = 'James Gibbons (Sky Holdings Ltd): loan')`);
        // (g) Ownership over time: 50/50 until October, 45/45/10 from October, the 1% kicker pending.
        await db.execute(sql`UPDATE shareholders SET equity_percent = 45, effective_from = '2026-10-01' WHERE project_id = ${projectId} AND name IN ('Abi Peters', 'David Savin') AND equity_percent = 48 AND effective_from IS NULL`);
        await db.execute(sql`UPDATE shareholders SET equity_percent = 10, effective_from = '2026-10-01' WHERE project_id = ${projectId} AND name = 'James Gibbons' AND equity_percent = 4 AND effective_from IS NULL`);
        await db.execute(sql`INSERT INTO shareholders (project_id, name, role, equity_percent, effective_from, notes) SELECT ${projectId}, v.n, 'Founder', 50, '2025-01-01', 'From incorporation until 30 September 2026.' FROM (VALUES ('Abi Peters'), ('David Savin')) v(n) WHERE NOT EXISTS (SELECT 1 FROM shareholders s WHERE s.project_id = ${projectId} AND s.name = v.n AND s.effective_from = '2025-01-01')`);
        await db.execute(sql`INSERT INTO shareholders (project_id, name, role, equity_percent, effective_from, status, notes) SELECT ${projectId}, v.n, v.r, v.e, '2026-11-26', 'pending', 'After the 1% equity kicker on the 10,000 loan. Not final until the owner confirms how the 1% is issued.' FROM (VALUES ('Abi Peters', 'Founder', 44.5::real), ('David Savin', 'Founder', 44.5::real), ('James Gibbons', 'Investor', 11::real)) v(n, r, e) WHERE NOT EXISTS (SELECT 1 FROM shareholders s WHERE s.project_id = ${projectId} AND s.name = v.n AND s.status = 'pending')`);
        // (h) Running costs register (analysis A): rates 1,333; ACE is 72 a year; insurance is the
        // 950 annual premium in the plan; JCCP deferred until after opening.
        await db.execute(sql`UPDATE fixed_cost_items SET amount_gbp = 1333 WHERE project_id = ${projectId} AND name = 'Business Rates' AND amount_gbp = 1300`);
        await db.execute(sql`UPDATE fixed_cost_items SET amount_gbp = 6 WHERE project_id = ${projectId} AND name ILIKE 'ACE Regist%' AND amount_gbp = 20`);
        await db.execute(sql`UPDATE fixed_cost_items SET active = FALSE WHERE project_id = ${projectId} AND active = TRUE AND (name ILIKE 'Insurance - Hamilton Fraser%' OR name ILIKE 'Insurance - Employers Liability%' OR name ILIKE 'JCCP/BCAM%')`);

        return;
      }

      // No phases at all — fresh install, seed everything below.
    } else {
      const [project] = await db.insert(schema.projectsTable).values({
        name: "Winchester Clinic Opening Plan",
        description: "Full launch plan for Abi Peters Aesthetics at 9A Jewry Street, Winchester. Dad doing the fit-out labour.",
        targetLocation: "9A Jewry Street, Winchester, Hampshire SO23 8RZ",
        targetOpeningDate: "2026-11-02",
        status: "planning",
        launchReadinessPercent: 0,
      }).returning();
      projectId = project.id;
    }

    // Insert all 7 V5 phases and tasks
    let totalTasks = 0;
    for (const phaseData of PHASES) {
      const [phase] = await db.insert(schema.phasesTable).values({
        projectId,
        name: phaseData.name,
        description: phaseData.description,
        sortOrder: phaseData.sortOrder,
        status: "not_started",
      }).returning();

      for (let i = 0; i < phaseData.tasks.length; i++) {
        const t = phaseData.tasks[i];
        await db.insert(schema.tasksTable).values({
          phaseId: phase.id,
          title: t.title,
          owner: t.owner,
          status: "not_started",
          riskLevel: t.riskLevel,
          costTier: "mid",
          costLow: t.costLow,
          costMid: t.costMid,
          costHigh: t.costHigh,
          selectedCost: t.costMid,
          isNonNegotiable: t.isNonNegotiable,
          isCriticalRisk: t.isCriticalRisk,
          durationDays: t.durationDays,
          notes: t.notes ?? null,
          sortOrder: i,
        });
      }
      totalTasks += phaseData.tasks.length;
      console.log(`  ✅ Phase ${phaseData.sortOrder}: ${phaseData.name} (${phaseData.tasks.length} tasks)`);
    }

    // Seed financial model — only on a fresh install, never overwrite user's saved assumptions
    const existingFin = await db.select().from(schema.financialsTable).where(eq(schema.financialsTable.projectId, projectId));
    if (existingFin.length === 0) {
    await db.insert(schema.financialsTable).values({
      projectId,
      rentGbp: 2708,
      ratesGbp: 995,
      utilitiesGbp: 200,
      internetGbp: 50,
      insuranceGbp: 167,
      accountantGbp: 175,
      softwareGbp: 55,
      wasteContractGbp: 48,
      cleanerGbp: 0,
      subscriptionsGbp: 15,
      financeRepaymentsGbp: 0,
      stockPercent: 20,
      marketingGbp: 600,
      staffingGbp: 1047,
      commissionsPercent: 0,
      consumablesGbp: 0,
      averageClientValueGbp: 135,
      treatmentRoomsCount: 2,
      practitionerHoursPerDay: 7,
      workingDaysPerMonth: 22,
      conservativeOccupancyPercent: 40,
      realisticOccupancyPercent: 65,
      aggressiveOccupancyPercent: 85,
      repeatBookingRatePercent: 60,
      membershipRevenueGbp: 0,
      existingClinicRevenueGbp: 10000,
      bedhamptonCostsGbp: 3200,
      bedhStockPercent: 35,
      cannibalPercent: 0,
      wincSelfFundingTargetGbp: 12000,
      ownerDrawingsGbp: 1047,
      runwaySavingsGbp: 80000,
      personalSalaryNeedsGbp: 1047,
      nursingIncomeGbp: 0,
      targetDrawingsGbp: 4000,
      wincAcvGbp: 155,
    });
    } // end if (existingFin.length === 0)

    // Ensure scenario configs exist
    const existingScenarios = await db.select().from(schema.scenarioConfigsTable).where(eq(schema.scenarioConfigsTable.projectId, projectId));
    if (existingScenarios.length === 0) {
      await db.insert(schema.scenarioConfigsTable).values([
        { projectId, name: "Conservative", description: "Cautious opening — 40% occupancy, slow ramp", occupancyPercent: 40, revenueMultiplier: 1, isDefault: false },
        { projectId, name: "Realistic", description: "Expected performance — 65% occupancy by month 6", occupancyPercent: 65, revenueMultiplier: 1, isDefault: true },
        { projectId, name: "Aggressive", description: "Strong opening — 85% occupancy with high marketing spend", occupancyPercent: 85, revenueMultiplier: 1, isDefault: false },
      ]);
    }

    // Ensure compliance items exist
    const existingCompliance = await db.select().from(schema.complianceItemsTable).where(eq(schema.complianceItemsTable.projectId, projectId));
    if (existingCompliance.length === 0) {
      await seedCompliance(projectId);
    }

    // Ensure CQC milestones exist
    const existingMilestones = await db.select().from(schema.cqcMilestonesTable).where(eq(schema.cqcMilestonesTable.projectId, projectId));
    if (existingMilestones.length === 0) {
      await seedCqcMilestones(projectId);
    }

    // Ensure risks exist
    const existingRisks = await db.select().from(schema.risksTable).where(eq(schema.risksTable.projectId, projectId));
    if (existingRisks.length === 0) {
      await seedRisks(projectId);
    }

    // Ensure backlink tracker exists
    const existingBacklinks = await db.select().from(schema.backlinkOpportunitiesTable).where(eq(schema.backlinkOpportunitiesTable.projectId, projectId));
    if (existingBacklinks.length === 0) {
      await seedBacklinks(projectId);
    }
    await seedKit(projectId);
    await seedKitLines(projectId);
    await seedFinishes(projectId);
    await migrateKitV38(projectId);

    console.log(`🎉 Startup seed complete: 7 phases, ${totalTasks} tasks (Winchester V5)`);
  } catch (err) {
    console.error("❌ Startup seed failed:", err);
  }
}
