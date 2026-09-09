// Compactação padrão de arquivos do sistema.
// Imagens: redimensionadas e recomprimidas (JPEG/WEBP) antes de salvar.
// PDF/Excel/Word: mantidos íntegros (já são formatos compactados);
// os documentos gerados pelo próprio sistema saem com compressão ativada.

const TIPOS_IMAGEM = /^image\/(jpeg|jpg|png|webp|bmp)$/i;

export interface OpcoesCompressao {
  /** Maior dimensão permitida (px). Padrão 1600. */
  maxDimensao?: number;
  /** Qualidade JPEG/WEBP (0-1). Padrão 0.72. */
  qualidade?: number;
}

/**
 * Comprime uma imagem. Qualquer outro tipo de arquivo é devolvido sem alteração.
 */
export async function comprimirArquivo(
  file: File,
  opcoes: OpcoesCompressao = {},
): Promise<File> {
  const { maxDimensao = 1600, qualidade = 0.72 } = opcoes;
  if (!file || !TIPOS_IMAGEM.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDimensao / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const temTransparencia = /png|webp/i.test(file.type);
    const mime = temTransparencia ? "image/webp" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), mime, qualidade),
    );
    if (!blob || blob.size >= file.size) return file;

    const ext = mime === "image/webp" ? ".webp" : ".jpg";
    const nome = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([blob], nome, { type: mime, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Lê o arquivo como dataURL, comprimindo imagens automaticamente. */
export async function lerArquivoBase64(
  file: File,
  opcoes?: OpcoesCompressao,
): Promise<string> {
  const arquivo = await comprimirArquivo(file, opcoes);
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(arquivo);
  });
}
