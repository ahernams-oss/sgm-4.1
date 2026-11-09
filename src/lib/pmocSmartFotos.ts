import { supabase } from "@/integrations/supabase/client";
const BUCKET = "pmoc-smart-fotos";
export async function fotoPmocSmartUrl(referencia: string): Promise<string> {
  const path = referencia.startsWith(`${BUCKET}/`) ? referencia.slice(BUCKET.length + 1)
    : referencia.includes(`/storage/v1/object/public/${BUCKET}/`) ? referencia.split(`/storage/v1/object/public/${BUCKET}/`)[1] : null;
  if (!path) return referencia;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("Não foi possível carregar a foto.");
  return data.signedUrl;
}