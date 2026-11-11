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

/** National NFSe keys have 50 digits; product NFe keys have 44 digits. */
export function chaveNotaXml(xml: Document): string {
  const elements = Array.from(xml.getElementsByTagName("*"));
  const name = (el: Element) => (el.localName || el.nodeName).toLowerCase();
  const fiscal = elements.filter(el => {
    let current: Element | null = el;
    while (current) {
      if (["dps", "infdps", "rps", "infrps", "identificacaorps"].includes(name(current))) return false;
      current = current.parentNode?.nodeType === 1 ? current.parentNode as Element : null;
    }
    return true;
  });
  const key = (value: string) => {
    const cleaned = value.trim().replace(/^(?:NFSe|NFS|NFe)/i, "");
    return /^(?:\d{44}|\d{50})$/.test(cleaned) ? cleaned : "";
  };
  for (const tag of ["chnfse", "chnfe", "chaveacesso", "chave_acesso", "chaveacessonfse"]) {
    for (const el of fiscal.filter(el => name(el) === tag)) {
      const found = key(el.textContent || "");
      if (found) return found;
    }
  }
  for (const tag of ["infnfse", "infnfe"]) {
    for (const el of fiscal.filter(el => name(el) === tag)) {
      const found = key(el.getAttribute("Id") || el.getAttribute("id") || "");
      if (found) return found;
    }
  }
  return "";
}