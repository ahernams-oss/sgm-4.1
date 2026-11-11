/** Extract only an issued invoice number, never a provisional DPS/RPS number. */
export function numeroNotaXml(xml: Document): string {
  const elements = Array.from(xml.getElementsByTagName("*"));
  const name = (el: Element) => (el.localName || el.nodeName).toLowerCase();
  const provisional = (el: Element) => {
    let current: Element | null = el;
    while (current) {
      if (["dps", "infdps", "rps", "infrps", "identificacaorps"].includes(name(current))) return true;
      current = current.parentNode?.nodeType === 1 ? current.parentNode as Element : null;
    }
    return false;
  };
  for (const tag of ["nnfse", "numeronfse", "numero_nfse", "nnf"]) {
    const found = elements.find(el => name(el) === tag && !provisional(el) && el.textContent?.trim());
    if (found) return found.textContent?.trim() || "";
  }
  // ABRASF/municipal Numero must be a direct child of the fiscal information.
  for (const parentTag of ["infnfse", "nfse"]) {
    for (const parent of elements.filter(el => name(el) === parentTag && !provisional(el))) {
      const found = Array.from(parent.childNodes).find(node => node.nodeType === 1 && name(node as Element) === "numero" && node.textContent?.trim());
      if (found) return found.textContent?.trim() || "";
    }
  }
  return "";
}