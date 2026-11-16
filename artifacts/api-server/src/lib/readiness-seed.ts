// First drafts for Ready for Winchester (owner, 16 Nov 2026). Written for Abi to edit, not to
// follow blind: every clinical draft says it is hers to check and sign off. Keys are stable; the
// route inserts only missing keys, so changing a draft here never overwrites an edited one.
// Markup used in drafts: a line starting "- " is a bullet, "## " a small heading, a blank line a
// new paragraph. No em or en dashes anywhere.

export const FIRST_PATIENTS = "2026-12-02";
export const OPENING = "2026-12-08";

export const READY_SECTIONS = [
  { key: "week", title: "Start here", blurb: "How to use this list, and the few things that unlock everything else." },
  { key: "flow", title: "Patient journey", blurb: "What happens from the moment someone books to the review two weeks later. Decide this first; the room, the cupboard and the SOPs all follow from it." },
  { key: "room", title: "Treatment room", blurb: "Layout, what lives where, and the clean and dirty zones." },
  { key: "cupboard", title: "Cupboard and stock", blurb: "Everything that has to be in the building, ordered and checked, before the first patient." },
  { key: "sops", title: "SOPs and pathways", blurb: "How each treatment is done here, written down once. Mostly your Bedhampton way, put on paper." },
  { key: "emergency", title: "Emergencies", blurb: "The plans you hope never to use. Kit by the door, steps on the wall." },
  { key: "cover", title: "Paperwork and cover", blurb: "Insurance, waste, data, fire and training: what has to be true before anyone is treated." },
  { key: "systems", title: "Bookings and payments", blurb: "ANS, consent forms, the card machine, the phone and the Wi-Fi." },
  { key: "rehearse", title: "Practice runs", blurb: "A dry run with a friend, then the model days on 2 and 3 December as the real rehearsal." },
  { key: "opening", title: "Opening and media", blurb: "8 December, guests, photos and what you will say." },
] as const;

export interface SeedItem { key: string; section: string; order: number; title: string; owner: "Abi" | "David" | "Both"; due?: string; draft?: string }

const CHECK = "This is a first draft written for you to correct. Change anything that is not how you work, then mark it done once you are happy to work to it.";

export const READY_ITEMS: SeedItem[] = [
  // ── Start here ──
  { key: "start-how", section: "week", order: 10, owner: "Abi", due: "2026-11-19", title: "Read this page once, top to bottom (20 minutes)", draft: `You have 16 days until the first model patients on Wednesday 2 December, and 22 until opening on Tuesday 8 December. That is enough time, as long as it is spent in the right order.

## How this list works
- Every item has a first draft. You correct it rather than write it from nothing.
- Tap the circle to mark something done. Tap the title to open the draft, edit it, or add a note.
- Items marked David are his. You only need to know they are moving.
- "This week" at the top only ever shows what is due in the next seven days. Ignore the rest until it appears there.

## The order that matters
- Thursday and Friday this week: the patient journey and the treatment room. Everything else follows from these two.
- Next week: the cupboard, the stock order, the SOPs and the emergency plans. All of this can be done at home, before the builders leave.
- Friday 27 November: the builders hand over and the couch arrives. Setting up the room happens from then.
- Saturday 28 November: the opening event with photographers.
- Tuesday 1 December: a full dry run in the room.
- 2 and 3 December: the model days are your rehearsal. Anything that goes wrong there is a gift, not a failure.` },
  { key: "start-hour", section: "week", order: 20, owner: "Both", due: "2026-11-19", title: "Walk the building together for an hour, with this list open", draft: `Do this on Thursday 19 November at 9A Jewry Street, before deciding anything else.

- Stand where a patient stands when they walk in. Where do they wait? Where do they put their coat?
- Stand in the treatment room. Where does the couch go so the light falls on the face and you can reach both sides?
- Find the nearest sink to the couch, and where clinical waste and sharps will sit.
- Find where the emergency kit will live: it should be grabbable from the couch in under ten seconds.
- Note every socket you will need: couch, fridge, lamp, card machine, laptop, LED.
- Take photos of each wall. They make the layout item easy to finish at home.` },
  { key: "start-blockers", section: "week", order: 30, owner: "David", due: "2026-11-20", title: "Confirm the handover: 27 November, keys, and what is still open", draft: `CBS's practical completion is set for Friday 27 November, the same day the couch is delivered (Direct Salon Furniture order 106608). That leaves four days to set up before the model days, so this date matters more than anything else on the list.

- Is 27 November still holding? If it slips, the dry run and the model days slip with it.
- Can Abi get into the treatment room a day or two earlier to measure up and store boxes?
- Keys and alarm codes for Abi.
- Building Control's final certificate is still outstanding, as are the ventilation details and sound readings. Chase it so it is in hand before patients are treated.
- The electrical certificate.
- Air conditioning arrives in February. Check the room stays warm enough in December (a heater if needed, and the fridge kept away from it).` },

  // ── Patient journey ──
  { key: "flow-map", section: "flow", order: 10, owner: "Abi", due: "2026-11-20", title: "Agree the patient journey, step by step", draft: `${CHECK}

## Before the visit
- Books online in ANS or through the team. Gets the confirmation with the address, parking and what to expect.
- 48 hours before: reminder from ANS with the medical questionnaire and consent forms to complete at home.
- New injectable patients: a consultation first. Prescription-only treatments need a face to face consultation by you before any prescribing, and a cooling-off period for anything new.

## Arrival
- You greet them at the door yourself. There is no receptionist, so the waiting area has to look after itself for a few minutes (water, a seat, something to read, Wi-Fi code on a card).
- If you are mid-treatment, the door is locked and a small sign says "In treatment, back with you at [time]" with a bell or a text number.

## In the room
- Consultation: medical history check, concerns, expectations, honest plan including "nothing yet".
- Photos with consent, same light and same angles every time.
- Consent signed in ANS for the treatment being done today.
- Treatment, with the record written as you go.

## After
- Aftercare explained and sent by ANS straight away.
- Payment taken in the room on the card machine, then the next appointment booked before they leave.
- Two week review booked for filler and anti-wrinkle treatment, and a check-in message at day 3.
- From opening: a review request once they are happy.` },
  { key: "flow-timing", section: "flow", order: 20, owner: "Abi", due: "2026-11-21", title: "Set appointment lengths and the turnaround between patients", draft: `${CHECK}

Suggested slot lengths for the diary, including the clean down. Adjust to how long you really take.

- New consultation, no treatment: 30 minutes.
- Consultation and treatment, same visit: 60 minutes.
- Anti-wrinkle treatment, returning patient: 30 minutes.
- Lip filler: 45 minutes (numbing cream needs 20 of them).
- Dermal filler, other areas: 60 minutes.
- Skin boosters and polynucleotides: 45 minutes.
- Microneedling: 60 minutes.
- Two week review: 15 minutes.
- Leave 10 minutes between patients for cleaning, notes and the door. With no receptionist this buffer is what stops the day running late.

Check these against what is set in ANS for Winchester.` },
  { key: "flow-door", section: "flow", order: 30, owner: "Abi", due: "2026-11-24", title: "Decide how the door and waiting area work with no receptionist", draft: `${CHECK}

- Front door locked during treatments, or open with a chime? Locked is safer when you are alone with a patient and a needle.
- Doorbell or a "text me, I am with a patient" sign with the clinic number.
- Waiting area: water, a few magazines or a short card about the clinic, the Wi-Fi code, a coat hook.
- Where patients wait if they arrive early while the previous patient is still paying.
- Toilet: is it signed, stocked, and checked at the start of each day?` },
  { key: "flow-pay", section: "flow", order: 40, owner: "Both", due: "2026-11-25", title: "Agree payment, deposits and the cancellation rule", draft: `${CHECK}

- Payment taken in the room at the end, on the card machine. No cash, or cash only with a receipt from ANS.
- Introductory prices apply as set in ANS. Founding patients: check the price shown matches what they were promised.
- Deposits for new patients: take one at booking or not? If yes, how much, and is it taken off the treatment?
- Cancellation and no-show rule: the notice period and what is charged, written in the booking confirmation.
- Refunds and complaints follow the complaints policy.` },
  { key: "flow-after", section: "flow", order: 50, owner: "Abi", due: "2026-11-26", title: "Write the aftercare messages and the follow-up rhythm", draft: `${CHECK}

- Aftercare sheet for each treatment type, sent by ANS when the appointment is checked out. Copy your Bedhampton ones, change the address and phone number.
- Day 3 message: "How are you feeling?" with who to contact if anything worries them.
- Two week review for filler and anti-wrinkle treatment, booked before they leave.
- Out of hours: what number do patients call if they are worried in the evening? Put it on every aftercare sheet.` },

  // ── Treatment room ──
  { key: "room-layout", section: "room", order: 10, owner: "Abi", due: "2026-11-21", title: "Draw the treatment room layout", draft: `${CHECK}

## What you already have for room 1
- Lec Pharmacy Plus medical fridge.
- Omega 7 lamp (the floor stand is still to buy).
- Adexa trolley.
- The skin analyser, on its trolley.
- The couch, arriving 27 November.
- Still to buy: the stool, a mirror, and a tablet arm if you want one.

Room 2 has its basin and cupboards, but its furniture waits for a second clinician. Until then it can be your consultation room, with two chairs, or your store.

## A layout that works for injectables
- Couch in the middle of the room or with its head end free, so you can work from both sides and from behind the head.
- Main light from the front and side of the face, never from behind you. A daylight lamp on a stand for photos and assessment.
- Your trolley on your working side, within arm's reach without twisting.
- Sink and hand hygiene point between the door and the couch, so you wash on the way in.
- Clean zone: worktop or trolley top for drawing up and laying out. Nothing used goes back onto it.
- Dirty zone: sharps bin and clinical waste bin low down, on the opposite side from the clean zone.
- Emergency kit on the wall or a shelf by the door, labelled, grabbable in ten seconds.
- Medicines fridge out of sight of patients, with its thermometer readable without opening it.
- Chair for the patient's bag and coat, and a mirror they can use after treatment.
- Laptop or tablet for ANS on a surface away from the clean zone.

Write down where each of these goes, or sketch it and add a photo note.` },
  { key: "room-photo", section: "room", order: 20, owner: "Abi", due: "2026-11-24", title: "Set up a photo spot: plain wall, fixed light, marked position", draft: `${CHECK}

- A plain light wall or backdrop, with nothing behind the head.
- The same light every time: the daylight lamp at a marked position.
- A mark on the floor for the chair and one for where you stand, so before and after photos match.
- Angles: front, left and right 45 degrees, left and right profile, and the treated area close.
- Photos stored in ANS against the patient, never on your own camera roll.
- Consent for clinical photos is part of the consent form. Using any photo in marketing needs separate written consent.` },
  { key: "room-clean", section: "room", order: 30, owner: "Abi", due: "2026-11-27", title: "Write the start of day, between patients and end of day clean", draft: `${CHECK}

## Start of day
- Fridge temperature read and written down (2 to 8 degrees).
- Couch, trolley and worktops wiped with detergent and disinfectant wipes.
- Sharps bin below the fill line, waste bins lined, couch roll stocked.
- Emergency kit seal checked.

## Between patients
- Hands, then wipe the couch, headrest, trolley top and anything touched.
- New couch roll.
- Sharps into the sharps bin at the point of use, never recapped.

## End of day
- All surfaces cleaned, waste bagged and stored for collection.
- Fridge locked, cupboard locked, laptop logged out.
- Fridge temperature written down again.` },
  { key: "room-front", section: "room", order: 40, owner: "Abi", due: "2026-11-28", title: "Finish the front of house: waiting chairs, retail shelf, signs", draft: `${CHECK}

- Seats for two people waiting.
- Obagi retail shelf: what goes on display and what is kept back.
- Signs: clinic hours on the door, the complaints procedure and your registration visible, toilet sign.
- Card with the Wi-Fi code.
- Somewhere for patients to sit after treatment if they feel faint.` },

  // ── Cupboard and stock ──
  { key: "cup-list", section: "cupboard", order: 10, owner: "Abi", due: "2026-11-23", title: "Check the cupboard list against what you use at Bedhampton", draft: `${CHECK}

Go through this and cross off what you already have or will bring from Bedhampton. What is left is the order.

## Injectables
- Products for each treatment on the menu, in the quantities for two model days and the first two weeks.
- Hyaluronidase, enough for an occlusion, in date and in the fridge.
- Needles in the gauges and lengths you use, and cannulas.
- Syringes: 1ml luer lock and 3ml for reconstitution and hyaluronidase.
- Bacteriostatic saline or sodium chloride for reconstitution.
- Numbing cream and cling film.

## Clinical consumables
- Non-sterile gloves in your size and one size up, sterile gloves for microneedling.
- Skin prep: chlorhexidine 2% in alcohol, or your usual.
- Gauze, cotton pads, cotton buds.
- White eyeliner or a surgical marker for marking.
- Couch roll, aprons, face masks.
- Ice packs or a cold compress.
- Arnica or your usual post-treatment cream, if you use one.

## Infection control and waste
- Sharps bins (yellow lid for medicinal sharps), clinical waste bags and bin, offensive waste bags.
- Detergent and disinfectant wipes, hand gel, hand soap, paper towels.
- Spillage kit.

## Skin treatments
- Microneedling cartridges, serums, LED eye protection, peel products and neutraliser as used.

## Front of house and admin
- Aftercare leaflets if you hand any out, pens, a printed price list for your reference only.
- Toilet roll, hand towels, bin liners, cleaning products.` },
  { key: "cup-order", section: "cupboard", order: 20, owner: "Abi", due: "2026-11-24", title: "Place the stock order for the model days and first two weeks", draft: `${CHECK}

- Order by Tuesday 24 November so it arrives with a week to spare. Pharmacies can take three to five working days for prescription products.
- Healthxchange deliveries came on 9 and 13 November. Count what came against this list first, and only order the gap.
- Delivery address: Bedhampton, not Winchester. The Winchester fridge can only be switched on after the builders leave on 27 November, then needs 48 hours holding 2 to 8 degrees. So move fridge stock across in a cool bag on Sunday 29 November or Tuesday 1 December.
- Write the batch numbers and expiry dates into the stock list when it arrives.
- Count the model day bookings in ANS to size the order.` },
  { key: "cup-fridge", section: "cupboard", order: 30, owner: "Both", due: "2026-11-28", title: "Medicines fridge running, locked, with a min/max thermometer and log", draft: `- The Lec Pharmacy Plus fridge is already bought. Switch it on as soon as the builders hand over on 27 November.
- Lock it, and keep the key with you.
- Min/max thermometer, read and written down at the start and end of each clinic day. 2 to 8 degrees.
- Run it empty for 48 hours and check it holds temperature before stock goes in.
- What to do if it goes out of range: who to call, which stock to quarantine.` },
  { key: "cup-locked", section: "cupboard", order: 40, owner: "Abi", due: "2026-11-27", title: "Locked storage for medicines and patient paperwork", draft: `- A locked cupboard for prescription products not needing the fridge, and for prescription records if any are on paper.
- Who holds the keys. Never left in the lock.
- Retail Obagi stock kept separately from clinical stock.` },
  { key: "cup-stocklist", section: "cupboard", order: 50, owner: "Abi", due: "2026-11-30", title: "Enter the key items into ALFRED's stock list with reorder points", draft: `Use the Stock page in ALFRED (Clinic, then Stock). For each item you never want to run out of, add the count on hand and the count at which you reorder. Anything low then shows on your home screen.

Start with: each injectable product, hyaluronidase, needles and cannulas, sharps bins, gloves, couch roll, numbing cream.` },

  // ── SOPs and pathways ──
  { key: "sop-consult", section: "sops", order: 10, owner: "Abi", due: "2026-11-25", title: "Consultation and prescribing pathway", draft: `${CHECK}

- Face to face consultation with you before any prescription-only medicine is prescribed. Never by phone or online form alone.
- Medical history from the ANS questionnaire, checked with the patient: medicines, allergies, pregnancy or breastfeeding, autoimmune conditions, previous treatments and any complications.
- Assess capacity and expectations. Screen for body dysmorphic concerns and say no where it is right to.
- Record the prescribing decision, the product, dose, batch and expiry, and the injection points in ANS.
- Cooling off: new patients for prescription-only treatments are offered time to think before treatment, and are never pressured to decide on the day.
- Under 18s are not treated with injectables.` },
  { key: "sop-consent", section: "sops", order: 20, owner: "Abi", due: "2026-11-25", title: "Consent and photographs", draft: `${CHECK}

- Treatment specific consent form in ANS for each treatment type, signed before treatment, on the day.
- Risks explained in plain words, including the rare serious ones. Results vary and are not guaranteed.
- Clinical photographs consented separately from marketing use.
- Consent recorded again if the plan changes on the day.` },
  { key: "sop-toxin", section: "sops", order: 30, owner: "Abi", due: "2026-11-26", title: "Anti-wrinkle treatment protocol", draft: `${CHECK}

- Reconstitution: the product, the diluent and the volume you use, written once so it is the same every time.
- Areas, typical starting doses and injection points: your standard map for each area.
- Storage once reconstituted and how long you keep it.
- Aftercare: what to avoid for the first four hours and the first 24 hours.
- Review at two weeks, and your top-up rule.
- Recognising and managing ptosis and asymmetry.` },
  { key: "sop-filler", section: "sops", order: 40, owner: "Abi", due: "2026-11-26", title: "Dermal filler protocol, including danger zones", draft: `${CHECK}

- Products you use by area, needle or cannula choice, and volumes.
- Skin prep and aseptic technique.
- Danger zones for each area and your technique to reduce risk: aspirate where you choose to, slow low pressure injection, small boluses, cannula where appropriate.
- Watch for blanching, pain out of proportion and mottling during and after injection.
- Hyaluronidase in the room, in date, before any filler is drawn up.
- Aftercare and the two week review.` },
  { key: "sop-skin", section: "sops", order: 50, owner: "Abi", due: "2026-11-27", title: "Skin boosters, polynucleotides, Sculptra, microneedling and peel protocols", draft: `${CHECK}

The Winchester menu covers Profhilo, SkinVive, Restylane Skinboosters, polynucleotides, Sculptra, microneedling with Dermapen 4 (with or without exosomes), the Obagi Blue Radiance Peel and AI skin analysis. Filler dissolving belongs with the filler protocol.

- Product, technique and course length for each.
- Sculptra: how you reconstitute it, how far ahead, the massage aftercare and the interval between sessions.
- Contraindications particular to each (active skin infection, isotretinoin within six months for microneedling and peels, allergies to ingredients).
- Aftercare and the interval between sessions.` },
  { key: "sop-records", section: "sops", order: 60, owner: "Abi", due: "2026-11-27", title: "Record keeping", draft: `${CHECK}

- Everything in ANS, written at the time: consultation, consent, product, batch and expiry, dose, sites, photos, aftercare given.
- Prescription records kept as the regulations require.
- Never on paper you take home, never on a personal phone.` },
  { key: "sop-ipc", section: "sops", order: 70, owner: "Abi", due: "2026-11-28", title: "Infection prevention, sharps and waste", draft: `${CHECK}

- Hand hygiene before and after every patient, and after taking gloves off.
- Single use items used once. Nothing reprocessed.
- Sharps go straight into the sharps bin at the point of use, never recapped, bin closed when three quarters full.
- Needlestick: make it bleed, wash under running water, do not scrub, cover, then follow occupational health advice and record it.
- Clinical waste stored securely until collected by the registered carrier, with waste transfer notes kept.` },
  { key: "sop-lone", section: "sops", order: 80, owner: "Both", due: "2026-11-28", title: "Working alone safely", draft: `${CHECK}

- Someone knows your clinic hours each day and expects a message at the end.
- Phone on you, not in a bag.
- The front door locked during treatment.
- A plan for a difficult or aggressive patient: you can end an appointment and ask them to leave.
- Chaperone: offer one if a patient asks or the treatment area makes it right. Who could you call on?` },

  // ── Emergencies ──
  { key: "em-kit", section: "emergency", order: 10, owner: "Abi", due: "2026-11-25", title: "Emergency kit packed, sealed and by the door", draft: `${CHECK}

- Adrenaline 1:1000 ampoules and auto-injectors, in date, with needles and syringes for IM use.
- Chlorphenamine and hydrocortisone if you carry them.
- Hyaluronidase, enough for a full occlusion, with diluent, syringes and needles.
- Aspirin 300mg.
- Pocket mask for rescue breaths, gloves.
- Glucose for a faint or a hypo.
- Warm compress for occlusion.
- A printed copy of the anaphylaxis and occlusion steps on top.
- A seal or tag so you know at a glance it has not been opened, and an expiry check written on it.` },
  { key: "em-anaph", section: "emergency", order: 20, owner: "Abi", due: "2026-11-25", title: "Anaphylaxis: the steps, printed on the wall", draft: `${CHECK} Check it against the current Resuscitation Council UK guidance.

- Recognise: sudden airway, breathing or circulation problems, usually with skin changes.
- Call 999 and say anaphylaxis.
- Lie them flat, legs raised, or sit up if breathing is hard. Do not stand them up.
- Adrenaline 1:1000 IM into the outer thigh at the adult dose; repeat after 5 minutes if no better.
- Stay with them, monitor, start CPR if they stop breathing normally.
- Record the times and doses, and send a copy with the ambulance.` },
  { key: "em-vo", section: "emergency", order: 30, owner: "Abi", due: "2026-11-25", title: "Vascular occlusion: the steps, printed on the wall", draft: `${CHECK} Check it against the current Aesthetic Complications Expert Group guidance.

- Stop injecting at once.
- Signs: blanching, then mottling or dusky colour, pain out of proportion. Visual change or loss of sight is a 999 emergency.
- Hyaluronidase at high dose into and around the affected area, repeated hourly until the skin recovers.
- Warm compress and massage, aspirin unless contraindicated.
- Visual symptoms: 999 and urgent eye referral, without delay.
- Follow up the same day and the next, record everything, and report to your insurer.` },
  { key: "em-other", section: "emergency", order: 40, owner: "Abi", due: "2026-11-27", title: "Fainting, a hypo, a seizure, and calling for help when alone", draft: `${CHECK}

- Faint: lie flat, legs up, loosen clothing, recover slowly, glucose drink once alert.
- Hypo: glucose, then something to eat.
- Seizure: protect the head, time it, 999 if over five minutes or a first seizure.
- Alone: phone on you, 999 on speaker while you act. Nearest defibrillator: find it and write where it is here.
- Every incident recorded and reviewed.` },
  { key: "em-aed", section: "emergency", order: 50, owner: "David", due: "2026-11-24", title: "Find the nearest public defibrillator to 9A Jewry Street", draft: `Look it up on The Circuit (the national defibrillator network) and write here where it is and how long it takes to fetch. Put it on the emergency sheet.` },

  // ── Paperwork and cover ──
  { key: "cov-ins", section: "cover", order: 10, owner: "David", due: "2026-11-24", title: "Insurance: put the Hamilton Fraser cover in force for Winchester", draft: `The most important item on this page. The records show a Hamilton Fraser quote of £1,660.40 for the combined policy, but nothing to say it is in force. Nobody is treated at Winchester, model days included, until the certificate is in hand.

- Medical malpractice and treatment cover includes 9A Jewry Street and every treatment on the Winchester menu.
- Public liability at the level the lease asks for.
- Building contents and equipment.
- Employers' liability, only when someone is employed.
- Ask the insurer if they need the fire risk assessment or anything else before you treat there.` },
  { key: "cov-waste", section: "cover", order: 20, owner: "David", due: "2026-11-24", title: "Clinical waste and sharps collection contract for Winchester", draft: `- There is a Business Waste invoice dated 2 November. Check it covers clinical waste and sharps from 9A Jewry Street, not only general waste.
- First collection booked, and how often after that.
- Bins and sharps containers supplied by them or bought.
- The clinical waste cupboard in the utility room is put off until after opening. Until then, choose a lockable place where full bags and sharps bins wait for collection, away from patients.
- Waste transfer notes kept.` },
  { key: "cov-ico", section: "cover", order: 30, owner: "David", due: "2026-11-24", title: "Data protection: ICO registration covers the new clinic, privacy notice up to date", draft: `- ICO registration ZC191072 is published in the privacy policy. Check it is current and paid.
- Privacy notice names both clinics.
- Patient data only in ANS. Laptop or tablet password protected and locked when you leave the room.` },
  { key: "cov-fire", section: "cover", order: 40, owner: "David", due: "2026-11-27", title: "Fire risk assessment, extinguisher, alarm and the escape route", draft: `- The Arundel fire alarm is installed and the BAFE certificates came on 3 November.
- Fire risk assessment, planned for 23 to 26 November: confirm the date, and have the written report in hand before patients are treated.
- Emergency lighting, which CBS is doing.
- Extinguisher and fire blanket in place, smoke alarm tested.
- Escape route clear and signed.` },
  { key: "cov-training", section: "cover", order: 50, owner: "Abi", due: "2026-11-27", title: "Your training in date: basic life support and anaphylaxis", draft: `- Basic life support and anaphylaxis certificates in date. If either runs out before the summer, book the refresher now.
- Safeguarding training in date.
- Copies kept with your registration and insurance certificates.` },
  { key: "cov-licence", section: "cover", order: 60, owner: "David", due: "2026-11-27", title: "Confirm with Winchester City Council that no special treatment licence is needed", draft: `Our reading is that injectables, microneedling and facials by a nurse prescriber do not need special treatment registration with the council, but this has not been confirmed in writing. A short email to the licensing team settles it before anyone is treated.

The clinic is not registered with CQC, and whether to register is a decision for early 2027. The compliance list in ALFRED still carries CQC steps from an early template; they are not needed for opening.` },
  { key: "cov-policies", section: "cover", order: 70, owner: "Abi", due: "2026-11-30", title: "Policies on file: complaints, safeguarding, consent, medicines, incidents", draft: `${CHECK}

The SOP drafts above cover most of this. What is left is a short written policy for each, kept in one folder:
- Complaints, with the response times, and a notice in the waiting area.
- Safeguarding, with who you would contact.
- Consent.
- Medicines management.
- Adverse incidents, including how you report to the Yellow Card scheme.
Your Bedhampton versions with the new address are fine.` },

  // ── Bookings and payments ──
  { key: "sys-ans", section: "systems", order: 10, owner: "David", due: "2026-11-23", title: "ANS set up for Winchester: location, hours, treatments and lengths", draft: `- Winchester location with the right address, opening hours and days.
- Each treatment with the slot length agreed in the patient journey.
- Introductory prices as set on 6 November, to switch back on 8 December from the record.
- Online booking showing the right clinic.` },
  { key: "sys-forms", section: "systems", order: 20, owner: "Abi", due: "2026-11-25", title: "Medical questionnaire, consent and aftercare forms in ANS for Winchester", draft: `- Check each form shows the Winchester address and phone number.
- Forms sent automatically before the appointment.
- Aftercare sent on checkout.` },
  { key: "sys-card", section: "systems", order: 30, owner: "David", due: "2026-11-25", title: "Card machine working at Winchester, tested with a real payment", draft: `- No card machine has been chosen yet; the plan only has a SumUp Air as a placeholder. Use the Bedhampton machine if it can be moved, or order one this week.
- Card machine registered to the Winchester location, charged and connected to the Wi-Fi.
- Test a small real payment and refund it.
- Payments reconcile against ANS.` },
  { key: "sys-net", section: "systems", order: 40, owner: "David", due: "2026-11-25", title: "Wi-Fi, phone and a laptop or tablet for the room", draft: `- The Vodafone engineer is booked for 17 November. Check broadband is live afterwards, with a guest network for patients.
- How the clinic phone works at Winchester: which number patients call and who answers it during treatments.
- A laptop or tablet logged into ANS in the treatment room.` },
  { key: "sys-google", section: "systems", order: 50, owner: "David", due: "2026-11-30", title: "Google profile and website show the right address, hours and opening date", draft: `- Google Business Profile for Winchester at 9A Jewry Street with the opening hours.
- Website contact and booking pages correct.
- Directions and parking notes in the booking confirmation.` },

  // ── Practice runs ──
  { key: "reh-dry", section: "rehearse", order: 10, owner: "Both", due: "2026-12-01", title: "Full dry run with a friend as the patient", draft: `Tuesday 1 December, once the room is set up after the handover on 27 November and the event on 28 November. Run one whole appointment start to finish in the room with a friend playing the patient, no needles.

- Booking confirmation and forms arrive.
- They knock; you greet them, and the waiting area works.
- Consultation, consent in ANS, photos at the photo spot.
- Mock treatment: is everything within reach? What did you have to walk across the room for?
- Payment on the card machine, rebook in ANS, aftercare sent.
- Clean down between patients and time it.
Write down every snag here as a note.` },
  { key: "reh-emergency", section: "rehearse", order: 20, owner: "Abi", due: "2026-12-01", title: "Practise the emergency drill once in the room", draft: `Time yourself from "patient collapses" to adrenaline drawn up and 999 called, using the real kit by the door. Then reseal the kit.` },
  { key: "reh-model", section: "rehearse", order: 30, owner: "Abi", due: "2026-12-01", title: "Model days ready: bookings, stock and timings checked the day before", draft: `- Check the 2 and 3 December bookings in ANS. Everyone has completed their forms.
- Stock for every booked treatment is in the fridge and cupboard.
- Leave longer gaps than usual between patients on the first day.` },
  { key: "reh-review", section: "rehearse", order: 40, owner: "Both", due: "2026-12-04", title: "After the model days: write down what to change before 8 December", draft: `Half an hour on Friday 4 December. What ran late, what was missing, what patients asked that you had no answer for. Fix them before opening.` },

  // ── Opening and media ──
  { key: "op-plan", section: "opening", order: 10, owner: "Both", due: "2026-11-20", title: "Plan the opening event on 28 November", draft: `The records show an opening event with photographers on Saturday 28 November, the day after handover, with a soft launch the week after. This item is for confirming that plan.

- Time, guest list and who is sending invites: Bedhampton regulars, the founders list, neighbouring shops on Jewry Street, local press.
- Photographers booked, and what they shoot: the room dressed, you, the shopfront.
- Food and drink, and who clears up.
- Is the room clean and set up enough by the 28th to be shown? If handover slips, the event slips too.
- The press release written on 11 November has not been sent yet. Agree a date for it.
- No treatments at the event.` },
  { key: "op-say", section: "opening", order: 20, owner: "Abi", due: "2026-12-01", title: "Three things you want to say about the clinic", draft: `For press, social posts and people at the door, in your own words. A start:

- Who you are: a nurse prescriber, with more than 300 five-star reviews from Bedhampton.
- What makes the clinic different: an honest consultation first, and no pressure to book.
- Where: 9A Jewry Street, with the opening hours.

Never name or price prescription-only medicines in anything public, and no before-and-after photos without written consent.` },
  { key: "op-content", section: "opening", order: 30, owner: "Both", due: "2026-12-05", title: "Photos and short videos of the finished clinic", draft: `- The shopfront, the waiting area, the treatment room set up and you at work, before patients arrive.
- No patient faces without written consent on file.
- These replace the ad images from 6 December.` },
];
