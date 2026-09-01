// Tender Comparison — faithful port of the owner's APA-ITT-55603 comparison
// document. Self-contained: all styling is scoped under `.tcmp` so it does not
// touch the rest of the app. Content is inline and editable on request.

const CSS = `
.tcmp{
  --navy:#1e2a3a; --navy2:#2c3e52; --ink:#26323f; --muted:#6b7885;
  --line:#e2e0d8; --cream:#f7f5ef; --paper:#ffffff; --band:#f1eee6;
  --green:#1f7a4d; --greenbg:#e6f2ea; --amber:#9a6a12; --amberbg:#faf1dd;
  --red:#a12b2b; --redbg:#f8e7e6; --blue:#2b5f8a; --bluebg:#e8f0f7;
  --await:#9aa3ad;
  background:var(--cream); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased;
  border:1px solid var(--line); border-radius:12px; overflow:hidden;
}
.tcmp *{box-sizing:border-box;}
.tcmp .wrap{max-width:1200px;margin:0 auto;padding:26px 22px 44px;}
.tcmp .masthead{border-bottom:2px solid var(--navy);padding-bottom:16px;margin-bottom:22px;}
.tcmp .eyebrow{letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:var(--muted);font-weight:600;}
.tcmp h1{font-size:25px;margin:6px 0 4px;color:var(--navy);font-weight:700;letter-spacing:.01em;}
.tcmp .sub{color:var(--muted);font-size:13.5px;}
.tcmp .metabar{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:14px;font-size:12.5px;color:var(--ink);}
.tcmp .metabar b{color:var(--navy);}
.tcmp .updated{font-size:12px;color:var(--muted);margin-top:6px;}
.tcmp h2{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--navy);margin:34px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--line);font-weight:700;}
.tcmp .note{font-size:12.5px;color:var(--muted);margin:-4px 0 14px;}
.tcmp .status{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px;}
.tcmp .pill{border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:6px 14px;font-size:12.5px;color:var(--muted);}
.tcmp .pill.pin{color:var(--green);border-color:#bfe0cb;background:var(--greenbg);font-weight:600;}
.tcmp .pill.pind{color:var(--amber);border-color:#e7d3a6;background:var(--amberbg);font-weight:600;}
.tcmp .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:13px;}
.tcmp .card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:15px 14px;display:flex;flex-direction:column;min-height:200px;}
.tcmp .card.ind{border-color:#e7d3a6;}
.tcmp .card.await{border-style:dashed;}
.tcmp .card .rank{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;}
.tcmp .card h3{margin:3px 0 2px;font-size:16px;color:var(--navy);}
.tcmp .card .co{font-size:11.5px;color:var(--muted);margin-bottom:9px;}
.tcmp .big{font-size:23px;font-weight:700;color:var(--navy);letter-spacing:-.01em;line-height:1.1;}
.tcmp .biglabel{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;}
.tcmp .adj{font-size:12px;color:var(--ink);margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);}
.tcmp .adj b{color:var(--navy);}
.tcmp .cardflags{margin-top:auto;padding-top:10px;display:flex;flex-wrap:wrap;gap:5px;}
.tcmp .tag{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:5px;line-height:1.5;}
.tcmp .t-green{background:var(--greenbg);color:var(--green);}
.tcmp .t-amber{background:var(--amberbg);color:var(--amber);}
.tcmp .t-red{background:var(--redbg);color:var(--red);}
.tcmp .t-blue{background:var(--bluebg);color:var(--blue);}
.tcmp .t-grey{background:#eef0f2;color:var(--muted);}
.tcmp .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--paper);}
.tcmp table{border-collapse:collapse;width:100%;font-size:13px;min-width:860px;}
.tcmp th,.tcmp td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top;}
.tcmp thead th{background:var(--navy);color:#fff;font-weight:600;font-size:12px;letter-spacing:.02em;}
.tcmp thead th.ind{background:var(--navy2);}
.tcmp thead th.await{background:var(--navy2);color:#dfe4ea;font-weight:500;}
.tcmp tbody tr:nth-child(even){background:#faf9f4;}
.tcmp td.item{color:var(--ink);}
.tcmp td.ref{color:var(--muted);font-variant-numeric:tabular-nums;width:34px;font-weight:600;}
.tcmp td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.tcmp td.awaitc{color:var(--await);text-align:center;}
.tcmp td.indc{color:var(--amber);}
.tcmp td.costnum{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:700;color:var(--navy);}
.tcmp .sub2{display:block;font-size:11.5px;color:var(--muted);margin-top:2px;font-weight:400;}
.tcmp tr.grp td{background:var(--band);font-weight:700;color:var(--navy);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;}
.tcmp tr.total td{background:#eef2f6;font-weight:700;color:var(--navy);font-size:14px;border-top:2px solid var(--navy);}
.tcmp tr.subtot td{font-weight:600;color:var(--navy);background:#f4f6f9;}
.tcmp .fig{font-weight:700;}
.tcmp .flagcard{background:var(--paper);border:1px solid var(--line);border-left:4px solid var(--navy);border-radius:8px;padding:15px 17px;margin-bottom:14px;}
.tcmp .flagcard.ind{border-left-color:var(--amber);}
.tcmp .flagcard.ok{border-left-color:var(--green);}
.tcmp .flagcard h4{margin:0 0 4px;color:var(--navy);font-size:15px;}
.tcmp .flagcard .co{font-size:12px;color:var(--muted);margin-bottom:10px;}
.tcmp .flag{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line);}
.tcmp .flag:first-of-type{border-top:none;}
.tcmp .flag .sev{flex:0 0 auto;}
.tcmp .flag .body{flex:1;}
.tcmp .flag .body b{color:var(--ink);}
.tcmp .tfoot{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);}
.tcmp .tfoot b{color:var(--ink);}
.tcmp .legend{display:flex;flex-wrap:wrap;gap:14px;margin:10px 0 0;font-size:11.5px;color:var(--muted);}
.tcmp .legend span{display:inline-flex;align-items:center;gap:5px;}
.tcmp .dot{width:9px;height:9px;border-radius:2px;display:inline-block;}
`;

const box: React.CSSProperties = { flex: 1, minWidth: 150, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" };

export function TenderComparison() {
  return (
    <div className="tcmp">
      <style>{CSS}</style>
      <div className="wrap">

        <header className="masthead">
          <div className="eyebrow">Abi Peters Skin Clinic · Tender Comparison</div>
          <h1>Winchester Fit-Out — Contractor Returns &amp; Due Diligence</h1>
          <div className="sub">9a Jewry Street, Winchester · Internal fit-out, main contractor · JCT Minor Works · all figures <b>ex&nbsp;VAT</b></div>
          <div className="metabar">
            <span><b>Ref:</b> APA-ITT-55603</span>
            <span><b>Quotes due:</b> Fri 24 Jul 2026, 12:00 noon</span>
            <span><b>Possession:</b> ~1 Sep 2026</span>
            <span><b>Target PC:</b> Fri 16 Oct 2026</span>
            <span><b>Opening:</b> by 2 Nov 2026</span>
          </div>
          <div className="updated">Last updated: Thu 30 Jul 2026 · five contractors in the field</div>
        </header>

        <div className="status">
          <span className="pill pin">1 compliant bid — MJT</span>
          <span className="pill pind">1 indicative — Clinic Fitouts</span>
          <span className="pill">3 bids awaited — CBS · HE Interiors · Lanext</span>
        </div>

        <h2>Headline Summary</h2>
        <div className="cards">
          <div className="card">
            <div className="rank">MJT · compliant</div>
            <h3>MJT</h3>
            <div className="co">M.J.T. Decorating Ltd · reg 02734353</div>
            <div className="biglabel">Total as submitted</div>
            <div className="big">£91,211</div>
            <div className="adj"><b>Comparable:</b> £83,714 (sq) / £84,774 (curved)<span className="sub2">Likely outturn ~£90–96k once PS/TBC/statutory firm up</span></div>
            <div className="cardflags"><span className="tag t-red">Programme over</span><span className="tag t-amber">Double-count</span></div>
          </div>
          <div className="card ind">
            <div className="rank">Clinic Fitouts · indicative</div>
            <h3>Clinic Fitouts</h3>
            <div className="co">Clinic Fitouts Ltd · reg 16762571</div>
            <div className="biglabel">Indicative (verbal)</div>
            <div className="big">£100–120k</div>
            <div className="adj"><b>Likely ~£115–125k.</b> No priced schedule.<span className="sub2">9-month-old co; director's prior firm in liquidation</span></div>
            <div className="cardflags"><span className="tag t-red">High risk</span><span className="tag t-amber">Scope gaps</span></div>
          </div>
          <div className="card await">
            <div className="rank">HE Interiors · awaited</div>
            <h3>HE Interiors</h3>
            <div className="co">HE Interiors Ltd · reg 12871530</div>
            <div className="biglabel">Likely cost (est.)</div>
            <div className="big">£100–125k</div>
            <div className="adj"><b>Clinical specialist</b> — best fit.<span className="sub2">Thin balance sheet (net assets ~£1.1k)</span></div>
            <div className="cardflags"><span className="tag t-blue">Best fit</span><span className="tag t-amber">Weak finances</span></div>
          </div>
          <div className="card await">
            <div className="rank">CBS · awaited</div>
            <h3>CBS</h3>
            <div className="co">Commercial Building Solutions Ltd · reg 08630016</div>
            <div className="biglabel">Likely cost (est.)</div>
            <div className="big">£90–110k</div>
            <div className="adj"><b>Established local fit-out firm</b> (Portsmouth, ~13 yrs).<span className="sub2">Non-clinical; "Steve Walker" role unverified</span></div>
            <div className="cardflags"><span className="tag t-green">Established</span><span className="tag t-amber">Non-clinical</span></div>
          </div>
          <div className="card await">
            <div className="rank">Lanext · awaited</div>
            <h3>Lanext</h3>
            <div className="co">Lanext Group Ltd · reg 14232352</div>
            <div className="biglabel">Likely cost (est.)</div>
            <div className="big">£95–130k</div>
            <div className="adj"><b>Residential builder</b>, NE London (~80 mi).<span className="sub2">£0 cash, no accreditations, no clinical work</span></div>
            <div className="cardflags"><span className="tag t-red">Poor fit</span><span className="tag t-red">Weak finances</span></div>
          </div>
        </div>

        <h2>Likely Cost Positioning — indicative, ex VAT</h2>
        <p className="note"><b>Read this as a steer, not a quote.</b> Only MJT (a real bid) and Clinic Fitouts (their own verbal indication) come from the contractors. CBS, HE Interiors and Lanext figures are <b>estimates</b> modelled from each firm's size, overheads, clinical-scope competence and location, anchored to MJT's corrected bid (£83.7k ≈ £136/sq ft on 614 sq ft) and the market rate for a CQC-standard clinical fit-out (~£130–200/sq ft ≈ £80k–£123k). Do not disclose any of this to tenderers.</p>
        <div className="tablewrap">
          <table>
            <thead><tr>
              <th style={{ minWidth: 120 }}>Contractor</th>
              <th style={{ minWidth: 90 }}>Basis</th>
              <th style={{ textAlign: "right", minWidth: 120 }}>Likely range</th>
              <th style={{ textAlign: "right", minWidth: 90 }}>Midpoint</th>
              <th style={{ minWidth: 300 }}>Reasoning</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="item"><b>MJT</b></td>
                <td><span className="tag t-green">Actual bid</span></td>
                <td className="costnum">£84k–£96k</td>
                <td className="costnum">~£90k</td>
                <td className="item">Corrected bid £83.7k (square). Keenest price — low-overhead decorating-led firm. Likely to drift up as the £6.6k provisional sums, the TBC HVAC-replacement, statutory fees and any under-allowed clinical/ventilation items firm up.</td>
              </tr>
              <tr>
                <td className="item"><b>CBS</b></td>
                <td><span className="tag t-grey">Estimate</span></td>
                <td className="costnum">£90k–£110k</td>
                <td className="costnum">~£100k</td>
                <td className="item">Established commercial fit-out contractor with proper overhead and in-house M&amp;E — should price the build competently but a touch above MJT. No clinical premium/experience, so may either sit mid-field or carry risk allowance for the CQC elements. Local (Portsmouth) keeps prelims sensible.</td>
              </tr>
              <tr>
                <td className="item"><b>HE Interiors</b></td>
                <td><span className="tag t-grey">Estimate</span></td>
                <td className="costnum">£100k–£125k</td>
                <td className="costnum">~£112k</td>
                <td className="item">Clinical/CQC specialist and design-and-build — will cost the compliance (ventilation, welded floors, certification, infection-control) properly rather than under-allow, so fewer surprises but a premium. Higher overhead + ~50 mi travel push it to the upper-middle of the field.</td>
              </tr>
              <tr>
                <td className="item"><b>Clinic Fitouts</b></td>
                <td><span className="tag t-amber">Their indication</span></td>
                <td className="costnum">£110k–£125k</td>
                <td className="costnum">~£118k</td>
                <td className="item">Own words: "can't see it under £100k… gut ~£120k," framed as negotiate-first with variations and contingency. New firm pricing cautiously/high. Expect it to settle near the top of the field.</td>
              </tr>
              <tr>
                <td className="item"><b>Lanext</b></td>
                <td><span className="tag t-grey">Estimate (wide)</span></td>
                <td className="costnum">£95k–£130k</td>
                <td className="costnum">~£110k</td>
                <td className="item">Hardest to call: a residential builder out of area with no clinical/M&amp;E track record. Would sub-contract most specialist trades, so either a high, risk-loaded number or an unrealistically low one with scope gaps. Wide band, low confidence.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Field likely to land roughly <b>£84k–£125k ex VAT</b>. MJT anchors the bottom; the clinical specialists and the new entrant sit higher because they price (or should price) the CQC scope in full. Cheapest ≠ best value if clinical items are under-allowed — normalise every bid to the full pack before ranking on price.</p>

        <h2>Contractor Due Diligence</h2>
        <p className="note">Companies House and open-source checks, rated for fit to a CQC-standard clinical fit-out. Verify all "obtain / confirm" items in writing before appointing.</p>
        <div className="tablewrap">
          <table>
            <thead><tr>
              <th style={{ minWidth: 110 }}>Contractor</th>
              <th style={{ minWidth: 140 }}>Legal entity / reg</th>
              <th style={{ minWidth: 140 }}>Age &amp; status</th>
              <th style={{ minWidth: 170 }}>Financial standing</th>
              <th style={{ minWidth: 170 }}>Clinical / CQC fit</th>
              <th style={{ minWidth: 170 }}>Reputation &amp; accreditation</th>
              <th style={{ minWidth: 150 }}>Verdict</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="item"><b>HE Interiors</b><span className="sub2">awaited bid</span></td>
                <td>HE Interiors Ltd · <b>12871530</b><span className="sub2">fka Hughes Escott Interiors</span></td>
                <td>Inc. 2020 (~6 yrs) · Active<span className="sub2">no charges/insolvency</span></td>
                <td><span className="tag t-amber">Thin</span> Micro, ~10 staff. Net assets ~<b>£1.09k</b>, ~100% debt ratio, down ~96% YoY.</td>
                <td><span className="tag t-green">Strong on paper</span> Dedicated cosmetic/aesthetics, dental &amp; CQC fit-out; NHS Property Services cited.</td>
                <td>No named case studies/reviews or accreditations displayed — verify.</td>
                <td><span className="tag t-blue">Best specialism fit</span><span className="sub2">Verify finances, references &amp; accreditations; stage payments.</span></td>
              </tr>
              <tr>
                <td className="item"><b>CBS</b><span className="sub2">awaited bid</span></td>
                <td>Commercial Building Solutions Ltd · <b>08630016</b><span className="sub2">cbsltd.info · Portsmouth</span></td>
                <td>Inc. 2013 (~13 yrs) · Active<span className="sub2">clean 10+ yr filing history</span></td>
                <td><span className="tag t-green">Stable</span> Small, owner-managed (dir. S. Crippen), audit-exempt. Net assets undisclosed — request accounts.</td>
                <td><span className="tag t-red">None evidenced</span> General commercial fit-out (offices, mezzanines, M&amp;E). No clinical/CQC work shown.</td>
                <td>Commercial client testimonials (SHW, BIMM, Glanvilles); no accreditations displayed. "20 yrs" claim vs 13-yr company.</td>
                <td><span className="tag t-green">Credible &amp; local</span><span className="sub2">Confirm "Steve Walker" acts for the firm; get clinical reference + accreditations.</span></td>
              </tr>
              <tr>
                <td className="item"><b>MJT</b><span className="sub2">compliant bid in</span></td>
                <td>M.J.T. Decorating Ltd · <b>02734353</b><span className="sub2">"Building &amp; Decorating" is a trading style</span></td>
                <td>Inc. 1992 (~34 yrs) · Active<span className="sub2">clean, no insolvency/charges</span></td>
                <td><span className="tag t-green">Clean</span> Micro, family-run (R &amp; A Thompson). No adverse signals; scale risk on £80–120k.</td>
                <td><span className="tag t-red">None evidenced</span> Decorating + commercial office fit-out; no clinical/dental/CQC work.</td>
                <td>Thin — no independent reviews. CHAS self-claimed, unverified. Signatory G. Floyd is Contracts Manager, not a director.</td>
                <td><span className="tag t-amber">Established, unproven clinically</span><span className="sub2">Get clinical reference + method statement; contract in correct legal name.</span></td>
              </tr>
              <tr>
                <td className="item"><b>Clinic Fitouts</b><span className="sub2">indicative only</span></td>
                <td>Clinic Fitouts Ltd · <b>16762571</b><span className="sub2">virtual office, Southampton</span></td>
                <td><span className="tag t-red">Inc. Oct 2025 (~9 mo)</span> Active · no accounts filed</td>
                <td><span className="tag t-red">Cannot assess</span> No accounts. Director T. Patel's prior firm <b>in compulsory liquidation</b>; another dissolved 2023.</td>
                <td>Markets clinic fit-out but <b>no verifiable projects</b>; template website, placeholder testimonials &amp; fake phone.</td>
                <td>None verifiable; no accreditations. Undisclosed 2nd director.</td>
                <td><span className="tag t-red">High risk</span><span className="sub2">New shell + director liquidation history. Heavy safeguards, no upfront money.</span></td>
              </tr>
              <tr>
                <td className="item"><b>Lanext</b><span className="sub2">awaited bid</span></td>
                <td>Lanext Group Ltd · <b>14232352</b><span className="sub2">lanextconstruction.com · virtual office</span></td>
                <td>Inc. 2022 (~4 yrs) · Active<span className="sub2">no insolvency; 3 sister cos struck off</span></td>
                <td><span className="tag t-red">Weak</span> Net worth ~<b>£261, £0 cash</b>, negative working capital. Young principals.</td>
                <td><span className="tag t-red">None — residential</span> Portfolio is house extensions &amp; lofts. No clinical, CQC or even commercial fit-out case study.</td>
                <td>Claims 4.9/5 TrustATrader (unverified). No CHAS/ISO/accreditations. ~80 mi from site.</td>
                <td><span className="tag t-red">Poor fit</span><span className="sub2">Out-of-area domestic builder, no clinical capability, no cash. High risk for this brief.</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Commercial &amp; Programme</h2>
        <div className="tablewrap">
          <table>
            <thead><tr>
              <th style={{ minWidth: 210 }}>{" "}</th>
              <th>MJT</th>
              <th className="ind">Clinic Fitouts</th>
              <th className="await">CBS</th>
              <th className="await">HE Interiors</th>
              <th className="await">Lanext</th>
            </tr></thead>
            <tbody>
              <tr><td className="item">Submission status</td><td>Signed Quote Form + priced schedule</td><td className="indc">Indicative email only</td><td className="awaitc">Awaited</td><td className="awaitc">Awaited</td><td className="awaitc">Awaited</td></tr>
              <tr className="subtot"><td className="item">Headline figure (ex VAT)</td><td className="num fig">£91,210.56</td><td className="num indc">£100–120k<span className="sub2">indicative</span></td><td className="awaitc">—</td><td className="awaitc">—</td><td className="awaitc">—</td></tr>
              <tr><td className="item">Comparable build (square)</td><td className="num">£83,713.89</td><td className="indc">n/a</td><td className="awaitc">—</td><td className="awaitc">—</td><td className="awaitc">—</td></tr>
              <tr><td className="item">Likely cost (est. ex VAT)</td><td className="num">£84–96k</td><td className="num indc">£110–125k</td><td className="num">£90–110k</td><td className="num">£100–125k</td><td className="num">£95–130k</td></tr>
              <tr className="grp"><td colSpan={6}>Programme</td></tr>
              <tr><td className="item">Earliest start</td><td>01/09/2026</td><td className="indc">~1 mo to keys</td><td className="awaitc">—</td><td className="awaitc">—</td><td className="awaitc">—</td></tr>
              <tr><td className="item">Construction period</td><td>7–8 weeks</td><td className="indc">Not stated</td><td className="awaitc">—</td><td className="awaitc">—</td><td className="awaitc">—</td></tr>
              <tr><td className="item">Meets 16 Oct handover?</td><td><span className="tag t-red">No — 4–11 days over</span></td><td className="indc"><span className="tag t-amber">Not committed</span></td><td className="awaitc">—</td><td className="awaitc">—</td><td className="awaitc">—</td></tr>
            </tbody>
          </table>
        </div>

        <h2>Pricing Schedule — line by line (MJT)</h2>
        <p className="note">Only MJT has returned the priced schedule (Document 6). Other columns fill once compliant bids arrive. Figures ex VAT.</p>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="ref">#</th><th style={{ minWidth: 340 }}>Item</th><th style={{ textAlign: "right" }}>MJT</th></tr></thead>
            <tbody>
              <tr><td className="ref">1</td><td className="item">Preliminaries</td><td className="num">£5,696.00</td></tr>
              <tr><td className="ref">2</td><td className="item">Strip-out &amp; demolition</td><td className="num">£4,330.00</td></tr>
              <tr><td className="ref">3</td><td className="item">Partitions — square frontage option</td><td className="num">£6,436.58</td></tr>
              <tr><td className="ref">4</td><td className="item">Partitions — curved frontage option <span className="sub2">alternative to ref 3, not additive</span></td><td className="num">£7,496.67</td></tr>
              <tr><td className="ref">5</td><td className="item">Tendered joinery <span className="sub2">overlaps client cabinet-maker route</span></td><td className="num">£8,740.81</td></tr>
              <tr><td className="ref">6</td><td className="item">Doors — five hinged internal</td><td className="num">£3,554.88</td></tr>
              <tr><td className="ref">7</td><td className="item">Electrics</td><td className="num">£3,600.00</td></tr>
              <tr><td className="ref">8</td><td className="item">Lighting (core)</td><td className="num">£3,576.00</td></tr>
              <tr><td className="ref">9</td><td className="item">Feature &amp; brand lighting</td><td className="num">£2,368.00</td></tr>
              <tr><td className="ref">10</td><td className="item">Plumbing &amp; drainage</td><td className="num">£2,095.00<span className="sub2">+ £1,066 P/S</span></td></tr>
              <tr><td className="ref">11</td><td className="item">HVAC — retain &amp; zone, fresh air, extract</td><td className="num">£10,457.25</td></tr>
              <tr><td className="ref">12</td><td className="item">HVAC replacement option</td><td className="num"><span className="tag t-amber">TBC</span></td></tr>
              <tr><td className="ref">13</td><td className="item">Flooring — LVT + welded clinical vinyl</td><td className="num">£6,794.55</td></tr>
              <tr><td className="ref">14</td><td className="item">Decoration &amp; finishes</td><td className="num">£7,193.82<span className="sub2">+ £2,800 P/S</span></td></tr>
              <tr><td className="ref">15</td><td className="item">Feature finishes</td><td className="num">Incl. ref 5</td></tr>
              <tr><td className="ref">16</td><td className="item">Clinical fixing sundries</td><td className="num">£350.00</td></tr>
              <tr><td className="ref">17</td><td className="item">Shopfront refurbishment</td><td className="num">£4,320.00</td></tr>
              <tr><td className="ref">18</td><td className="item">Security &amp; access</td><td className="num">£120.00</td></tr>
              <tr><td className="ref">19</td><td className="item">Audio &amp; screen</td><td className="num">£2,780.00<span className="sub2">P/S</span></td></tr>
              <tr><td className="ref">20</td><td className="item">Fire safety</td><td className="num">£1,835.00</td></tr>
              <tr><td className="ref">21</td><td className="item">Building Regs &amp; M&amp;E CAD completion</td><td className="num">£600.00</td></tr>
              <tr><td className="ref">22</td><td className="item">Overheads &amp; profit</td><td className="num">Included</td></tr>
              <tr><td className="ref">23</td><td className="item">Contingency</td><td className="num">£5,000.00</td></tr>
              <tr><td className="ref">24</td><td className="item">Statutory fees</td><td className="num"><span className="tag t-amber">By client</span></td></tr>
              <tr className="total"><td></td><td className="item">Total as submitted (ex VAT)</td><td className="num">£91,210.56</td></tr>
            </tbody>
          </table>
        </div>

        <h2>Cost-Reduction &amp; Rebuttal Log</h2>
        <p className="note">Every cost challenge put to each contractor, captured line by line with our position, the target, the saving and where it stands. Seeded rebuttals for MJT are <b>suggestions for review</b> — advisory only, nothing sent. Updated as negotiations move. Do not disclose targets or other bids to any tenderer. Figures ex VAT.</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={box}>
            <div className="biglabel">MJT — potential reductions</div>
            <div className="big" style={{ color: "var(--green)" }}>£24,651</div>
            <div className="sub2">across 7 costed challenges (+ 4 clarify/risk items)</div>
          </div>
          <div style={box}>
            <div className="biglabel">MJT — indicative post-VE floor</div>
            <div className="big">~£66,559</div>
            <div className="sub2">if all agreed &amp; joinery goes to Bill</div>
          </div>
          <div style={box}>
            <div className="biglabel">MJT — target (full scope)</div>
            <div className="big">~£77,500</div>
            <div className="sub2">from corrected £83,714 (square)</div>
          </div>
        </div>

        <h3 style={{ fontSize: 14, color: "var(--navy)", margin: "14px 0 8px" }}>MJT Building &amp; Decorating Ltd</h3>
        <div className="tablewrap">
          <table>
            <thead><tr>
              <th className="ref">Ref</th>
              <th style={{ minWidth: 200 }}>Line item</th>
              <th style={{ textAlign: "right" }}>Original £</th>
              <th style={{ minWidth: 300 }}>Our rebuttal / position</th>
              <th style={{ textAlign: "right" }}>Target £</th>
              <th style={{ textAlign: "right" }}>Saving £</th>
              <th style={{ minWidth: 90 }}>Status</th>
            </tr></thead>
            <tbody>
              <tr><td className="ref">3/4</td><td className="item">Partition frontage — double-count<span className="sub2">arithmetic (must fix)</span></td><td className="num">£7,496.67</td><td className="item">Total includes both square (£6,436.58) &amp; curved (£7,496.67); alternatives — remove the unchosen option (adopt square).</td><td className="num">£0.00</td><td className="num fig">£7,496.67</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">5</td><td className="item">Tendered joinery<span className="sub2">scope overlap</span></td><td className="num">£8,740.81</td><td className="item">Remove from contractor scope — client's cabinet maker (Bill) to supply/fit feature wall, mouldings &amp; shelving. Keep MJT's coordination allowance.</td><td className="num">£0.00</td><td className="num fig">£8,740.81</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">9</td><td className="item">Feature &amp; brand lighting</td><td className="num">£2,368.00</td><td className="item">Client to free-issue decorative fittings; contractor installs &amp; wires only.</td><td className="num">£800.00</td><td className="num fig">£1,568.00</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">10</td><td className="item">Sinks &amp; taps provisional sum</td><td className="num">£1,066.00</td><td className="item">Client free-issues basins &amp; taps; delete PS — contractor fits only (labour already in £2,095).</td><td className="num">£0.00</td><td className="num fig">£1,066.00</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">14</td><td className="item">Marble-look panelling PS</td><td className="num">£2,800.00</td><td className="item">Value-engineer feature-wall finish (laminate/porcelain) or client-source panels; reduce the PS.</td><td className="num">£1,500.00</td><td className="num fig">£1,300.00</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">19</td><td className="item">Audio &amp; screen provisional sum</td><td className="num">£2,780.00</td><td className="item">Clinic runs on Wi-Fi; client supplies own audio &amp; screen. Contractor: power + concealed cabling only.</td><td className="num">£800.00</td><td className="num fig">£1,980.00</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">23</td><td className="item">Contingency</td><td className="num">£5,000.00</td><td className="item">Reduce contractor contingency — client holds its own. Asbestos clear, no gas, survey done.</td><td className="num">£2,500.00</td><td className="num fig">£2,500.00</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr className="subtot"><td></td><td className="item">Costed reductions subtotal</td><td className="num"></td><td className="item"></td><td className="num"></td><td className="num fig">£24,651.48</td><td></td></tr>
              <tr><td className="ref">11/12</td><td className="item">HVAC — retain vs replace</td><td className="num">£10,457.25</td><td className="item">Confirm retain-and-zone existing Hitachi; delete open-ended "TBC" (ref 12) or give a fixed replacement price.</td><td className="num">—</td><td className="num"><span className="tag t-amber">Risk cap</span></td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">1</td><td className="item">Preliminaries</td><td className="num">£5,696.00</td><td className="item">Query prelims for a 7–8 week programme (~7% of build); confirm what sits here (scaffold?) and test for reduction.</td><td className="num">—</td><td className="num">tbd</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">22</td><td className="item">Overheads &amp; profit ("Included")</td><td className="num">—</td><td className="item">Ask MJT to disclose the O&amp;P % folded into rates so margin can be benchmarked.</td><td className="num">—</td><td className="num">disclose</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">17</td><td className="item">Shopfront refurbishment</td><td className="num">£4,320.00</td><td className="item">Subject to conservation consent; if consent slips, allow separate instruction rather than delay PC — but needed before opening.</td><td className="num">—</td><td className="num">timing</td><td><span className="tag t-amber">Open</span></td></tr>
            </tbody>
          </table>
        </div>
        <p className="note"><b>Reconciliation:</b> as-submitted £91,210.56 → remove double-count → £83,713.89 (square) → apply the seven reductions → <b>~£66,559</b> indicative floor. Target ~£77,500 keeps joinery in-contract; the floor assumes joinery moves to Bill.</p>

        <h3 style={{ fontSize: 14, color: "var(--navy)", margin: "18px 0 8px" }}>Clinic Fitouts Ltd <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>— normalise to pack before any reduction</span></h3>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="ref">Ref</th><th style={{ minWidth: 180 }}>Item</th><th style={{ minWidth: 420 }}>Our position</th><th style={{ minWidth: 90 }}>Status</th></tr></thead>
            <tbody>
              <tr><td className="ref">—</td><td className="item">Compliant bid</td><td className="item">Return the Document 6 schedule + signed Quote Form (fixed lump sum, assumptions listed) before any commercial meeting. Can't rebut a verbal £100–120k range.</td><td><span className="tag t-red">Open</span></td></tr>
              <tr><td className="ref">20</td><td className="item">Fire safety</td><td className="item">Include full contractor scope — survey, adapt &amp; extend alarm into new rooms, certify — not punted to client/third party.</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">11</td><td className="item">Ventilation</td><td className="item">Price compliant fresh-air supply/extract to both treatment rooms (state air-change rate), not AC only.</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">8/9</td><td className="item">Lighting</td><td className="item">Price the full clinical/feature scheme with laser-room dimming, not "keep existing spotlights".</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">5</td><td className="item">Display-unit sides</td><td className="item">Remove — overlaps client cabinet-maker (Bill) scope.</td><td><span className="tag t-amber">Open</span></td></tr>
              <tr><td className="ref">2</td><td className="item">Kitchen units / worktop</td><td className="item">Clarify — pack removes the kitchenette; confirm not an added cost.</td><td><span className="tag t-amber">Open</span></td></tr>
            </tbody>
          </table>
        </div>
        <p className="note"><b>CBS, HE Interiors &amp; Lanext:</b> awaiting priced bids — line-item rebuttals added here on receipt.</p>

        <h2>Project Notes</h2>
        <div className="flagcard ok">
          <h4>VAT — resolved</h4>
          <div className="co">Confirmed by David, 24 Jul 2026</div>
          <div className="flag"><div className="sev"><span className="tag t-green">Recoverable</span></div><div className="body">Company <b>VAT-registered from 1 Aug 2026</b>; all clinic services standard-rated (wholly taxable). Build invoiced Sep–Oct → <b>VAT recoverable in full</b> on normal returns. Valid VAT invoices in <b>Abi Peters Aesthetics Ltd</b>'s name; confirm each contractor is VAT-registered; notify contractors <b>in writing that the client is the "end user"</b> so the CIS domestic reverse charge does not apply. Accountant to confirm; grid figures remain ex VAT.</div></div>
        </div>

        <h2>Clarifications &amp; Flags</h2>
        <div className="flagcard">
          <h4>MJT Building &amp; Decorating Ltd — compliant bid</h4>
          <div className="flag"><div className="sev"><span className="tag t-amber">Arithmetic</span></div><div className="body"><b>Partition options double-counted</b> — total adds both square (£6,436.58) and curved (£7,496.67). Comparable: £83,713.89 (sq) / £84,773.98 (curved).</div></div>
          <div className="flag"><div className="sev"><span className="tag t-red">Programme</span></div><div className="body"><b>7–8 weeks from 1 Sep misses the 16 Oct handover</b> by 4–11 days. Not confirmed on the form.</div></div>
          <div className="flag"><div className="sev"><span className="tag t-amber">Cost risk</span></div><div className="body">£6,646 provisional sums + HVAC-replacement TBC; statutory fees excluded ("by client").</div></div>
        </div>
        <div className="flagcard ind">
          <h4>Clinic Fitouts Ltd — indicative only</h4>
          <div className="flag"><div className="sev"><span className="tag t-red">Status</span></div><div className="body">No Quote Form / priced schedule. Verbal £100k–£120k, negotiate-first. Get a compliant lump sum on Document 6 before any commercial meeting.</div></div>
          <div className="flag"><div className="sev"><span className="tag t-amber">Scope</span></div><div className="body">Under-scope risks (fire punted to client, ventilation "unknown", "keep existing spotlights"); possible adds/overlaps (kitchen units, display-unit sides overlap Bill).</div></div>
          <div className="flag"><div className="sev"><span className="tag t-red">Integrity</span></div><div className="body">Asked where you are with other quotes — <b>do not disclose pricing or your position</b> to any tenderer.</div></div>
        </div>

        <div className="tfoot">
          <div><b>How this grid is maintained.</b> Each return is normalised against the issued pack (Document 6) and shown as-submitted and on a comparable basis. Indicative/non-compliant responses and cost estimates are tracked but kept out of the like-for-like total until a priced schedule is received.</div>
          <div className="legend">
            <span><span className="dot" style={{ background: "var(--red)" }}></span> resolve / high risk</span>
            <span><span className="dot" style={{ background: "var(--amber)" }}></span> clarify / caution</span>
            <span><span className="dot" style={{ background: "var(--blue)" }}></span> note / fit</span>
            <span><span className="dot" style={{ background: "var(--green)" }}></span> confirmed / strong</span>
          </div>
          <div style={{ marginTop: 10 }}>Responses folder: <b>Downloads\1. Tender Pack\3. Tender Pack Responses</b> · all figures ex VAT · cost estimates are advisory, not quotes — not for disclosure to tenderers.</div>
        </div>

      </div>
    </div>
  );
}
