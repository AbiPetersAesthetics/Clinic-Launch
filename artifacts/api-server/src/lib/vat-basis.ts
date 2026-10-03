// How a plan line's figure stands on VAT: its ex-VAT part, and the basis in words.
// The invoice's own VAT status wins; else the planning note on the cost; else the
// figure is assumed to include VAT.
export function exVatOf(amount: number, invoiceVat: string | null, costVat: string | null): { ex: number; basis: string } {
  const inv = (invoiceVat ?? "").toLowerCase();
  if (inv === "inc") return { ex: amount / 1.2, basis: "inc VAT on the invoice" };
  if (inv === "exc") return { ex: amount, basis: "ex VAT on the invoice" };
  if (inv === "exempt") return { ex: amount, basis: "no VAT" };
  const c = (costVat ?? "").toLowerCase();
  if (/exempt|vat_na|n\/a|no vat|not applicable/.test(c)) return { ex: amount, basis: "no VAT" };
  if (/inc/.test(c)) return { ex: amount / 1.2, basis: "planned inc VAT" };
  if (/ex_vat|ex vat|exc/.test(c)) return { ex: amount, basis: "planned ex VAT" };
  return { ex: amount / 1.2, basis: "VAT basis not set, assumed inc VAT" };
}
