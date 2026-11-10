// Official bytes come from Brasil NFe, never from a locally recreated layout.
export function decodificarPdfDanfse(base64: string): Uint8Array {
  const conteudo = base64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(conteudo), c => c.charCodeAt(0)); }
  catch { throw new Error("O DANFSe retornado não é um PDF válido."); }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("O DANFSe retornado não é um PDF válido.");
  }
  return bytes;
}

export function extrairDanfseOficial(body: any, nota: {
  id: string; numero_dps: number; ambiente: number; prestador: any;
}) {
  if (body?.Error || Number(body?.StatusLote) !== 1 || Number(body?.CodTipoAmbiente) !== nota.ambiente) {
    throw new Error("O DANFSe oficial ainda não está disponível para esta nota no ambiente informado.");
  }
  const notas: any[] = Array.isArray(body?.Notas) ? body.Notas : [];
  const correspondentes = notas.filter(n => n.IdentificadorInterno === `nfse-${nota.id}`);
  if (correspondentes.length !== 1) throw new Error("Não foi possível identificar o DANFSe desta nota com segurança.");
  const documento = correspondentes[0];
  const cnpj = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  // The national provider can omit CpfCnpjPrestador in the JSON while
  // returning it in the authorized XML. Use that same response's XML,
  // never the local form or the recipient's CNPJ, as the fallback.
  let xml = "";
  if (!cnpj(documento.CpfCnpjPrestador) && documento.Base64Xml) {
    try { xml = new TextDecoder().decode(Uint8Array.from(atob(documento.Base64Xml), c => c.charCodeAt(0))); }
    catch { /* Missing trustworthy issuer is rejected below. */ }
  }
  const tag = (nome: string, conteudo: string) => conteudo.match(new RegExp(`<(?:[\\w.-]+:)?${nome}\\b[^>]*>\\s*([^<]*)\\s*</`, "i"))?.[1]?.trim();
  const emitente = xml.match(/<(?:[\w.-]+:)?emit\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?emit>/i)?.[1] || "";
  const cnpjPrestador = cnpj(documento.CpfCnpjPrestador) || cnpj(tag("CNPJ", emitente));
  const xmlConsistente = !xml || (tag("nNFSe", xml) === String(documento.NumeroNFSe) && Number(tag("nDPS", xml)) === nota.numero_dps && Number(tag("tpAmb", xml)) === nota.ambiente);
  if (Number(documento.NumeroRPS) !== nota.numero_dps || !cnpj(nota.prestador?.cnpj) ||
    cnpjPrestador !== cnpj(nota.prestador?.cnpj) || !xmlConsistente ||
    documento.Erro || Number(documento.Status) !== 1 || !documento.NumeroNFSe) {
    throw new Error("O documento retornado não corresponde à nota autorizada.");
  }
  if (!documento.Base64Doc) throw new Error("A Brasil NFe ainda não disponibilizou o DANFSe oficial. Tente novamente mais tarde.");
  const bytes = decodificarPdfDanfse(documento.Base64Doc);
  // Return a normalized, validated PDF, preserving the original provider bytes.
  const base64 = documento.Base64Doc.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
  return { base64, numero: String(documento.NumeroNFSe), tamanho: bytes.byteLength };
}

export function baixarDanfseBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = nome;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function salvarDanfseBlob(blob: Blob, nome: string): Promise<void> {
  const arquivo = new File([blob], nome, { type: blob.type });
  if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return;
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") return;
    }
  }
  baixarDanfseBlob(blob, nome);
}