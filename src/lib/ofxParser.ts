// Simple OFX parser (SGML/XML hybrid, browser-side)
export interface OfxTrn { fitid: string; date: string; amount: number; memo: string; }

export function parseOfx(content: string): OfxTrn[] {
  const trns: OfxTrn[] = [];
  // Normalize: extract tag values regardless of closing tag
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const end = b.search(/<\/STMTTRN>/i);
    const body = end >= 0 ? b.slice(0, end) : b;
    const get = (tag: string) => {
      const m = body.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const dt = get("DTPOSTED").slice(0, 8);
    const date = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "";
    const amount = parseFloat(get("TRNAMT").replace(",", ".")) || 0;
    const fitid = get("FITID") || `${date}-${amount}-${get("MEMO")}`;
    const memo = get("MEMO") || get("NAME") || "";
    if (date) trns.push({ fitid, date, amount, memo });
  }
  return trns;
}
