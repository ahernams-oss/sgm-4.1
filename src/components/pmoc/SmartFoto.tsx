import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { fotoPmocSmartUrl } from "@/lib/pmocSmartFotos";
export default function SmartFoto({ referencia, numero }: { referencia: string; numero: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let ativa = true;
    void fotoPmocSmartUrl(referencia).then((u) => { if (ativa) setUrl(u); }).catch(() => { if (ativa) setUrl(""); });
    return () => { ativa = false; };
  }, [referencia]);
  return url ? <a href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border border-border bg-muted" title={`Abrir foto ${numero}`}><img src={url} alt={`Foto ${numero}`} className="h-full w-full object-cover" /></a>
    : <div className="grid aspect-square place-items-center rounded-md border border-border bg-muted" aria-label={`Foto ${numero} indisponível`}><ImageOff className="size-5 text-muted-foreground" /></div>;
}