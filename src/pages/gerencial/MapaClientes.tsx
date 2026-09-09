import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useClientes, type Cliente } from "@/contexts/ClientesContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

// Fix default marker icons
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const RJ_CENTER: [number, number] = [-22.4, -42.5];
const CACHE_KEY = "geocode_cache_v1";

type GeoCache = Record<string, { lat: number; lng: number } | null>;

const loadCache = (): GeoCache => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
};
const saveCache = (c: GeoCache) => localStorage.setItem(CACHE_KEY, JSON.stringify(c));

const enderecoCompleto = (c: Cliente) => {
  const partes = [
    c.logradouro,
    c.numero,
    c.bairro,
    c.cidade,
    c.uf || "RJ",
    c.cep,
    "Brasil",
  ].filter(Boolean);
  return partes.join(", ");
};

const isClienteAtivo = (c: Cliente) => c.tipo === "Cliente";

async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function MapaClientes() {
  const { clientes } = useClientes();
  const ativos = useMemo(() => clientes.filter(isClienteAtivo), [clientes]);

  const [cache, setCache] = useState<GeoCache>(loadCache());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busca, setBusca] = useState("");
  const mapRef = useRef<L.Map | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return ativos;
    return ativos.filter((c) =>
      [c.nome, c.nomeFantasia, c.cidade, c.bairro, c.cnpj].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [ativos, busca]);

  const pontos = useMemo(() => {
    return filtrados
      .map((c) => {
        const key = enderecoCompleto(c);
        const coord = cache[key];
        return coord ? { cliente: c, ...coord } : null;
      })
      .filter(Boolean) as { cliente: Cliente; lat: number; lng: number }[];
  }, [filtrados, cache]);

  const pendentes = useMemo(
    () => ativos.filter((c) => !(enderecoCompleto(c) in cache)),
    [ativos, cache]
  );

  const geocodificar = async (lista: Cliente[]) => {
    if (!lista.length) {
      toast.info("Todos os clientes já estão geolocalizados.");
      return;
    }
    setLoading(true);
    setProgress({ done: 0, total: lista.length });
    const novoCache = { ...cache };
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i];
      const key = enderecoCompleto(c);
      try {
        const coord = await geocodeNominatim(key);
        novoCache[key] = coord;
      } catch {
        novoCache[key] = null;
      }
      setProgress({ done: i + 1, total: lista.length });
      // Respect Nominatim usage policy (~1 req/sec)
      await new Promise((r) => setTimeout(r, 1100));
    }
    setCache(novoCache);
    saveCache(novoCache);
    setLoading(false);
    toast.success("Geolocalização concluída.");
  };

  const limparCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setCache({});
    toast.success("Cache de geolocalização limpo.");
  };

  useEffect(() => {
    if (mapRef.current && pontos.length) {
      const bounds = L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [pontos]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif">Mapa de Clientes - RJ</h1>
          <p className="text-sm text-muted-foreground">
            Visualização geográfica dos clientes ativos no Estado do Rio de Janeiro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{ativos.length} clientes</Badge>
          <Badge variant="outline">{pontos.length} no mapa</Badge>
          {pendentes.length > 0 && <Badge variant="destructive">{pendentes.length} pendentes</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Controle
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 w-64"
                  placeholder="Buscar cliente, cidade, CNPJ..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Button
                onClick={() => geocodificar(pendentes)}
                disabled={loading || !pendentes.length}
                size="sm"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Geolocalizar pendentes ({pendentes.length})
              </Button>
              <Button
                onClick={() => geocodificar(ativos)}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Re-geolocalizar todos
              </Button>
              <Button onClick={limparCache} disabled={loading} size="sm" variant="ghost">
                Limpar cache
              </Button>
            </div>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground mt-2">
              Processando {progress.done}/{progress.total}... (~1s por endereço para respeitar a API gratuita)
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[600px] w-full rounded-b-lg overflow-hidden">
            <MapContainer
              center={RJ_CENTER}
              zoom={8}
              style={{ height: "100%", width: "100%" }}
              ref={(m) => { if (m) mapRef.current = m; }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {pontos.map(({ cliente, lat, lng }) => (
                <Marker key={cliente.id} position={[lat, lng]}>
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">{cliente.nomeFantasia || cliente.nome}</p>
                      {cliente.nomeFantasia && cliente.nome && (
                        <p className="text-xs text-muted-foreground">{cliente.nome}</p>
                      )}
                      <p>{[cliente.logradouro, cliente.numero].filter(Boolean).join(", ")}</p>
                      <p>{[cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(" - ")}</p>
                      {cliente.cep && <p>CEP: {cliente.cep}</p>}
                      {cliente.cnpj && <p className="text-xs">CNPJ: {cliente.cnpj}</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {pendentes.length > 0 && !loading && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Clientes sem coordenadas ({pendentes.length})</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground max-h-40 overflow-auto">
            {pendentes.slice(0, 50).map((c) => (
              <div key={c.id}>• {c.nomeFantasia || c.nome} — {c.cidade || "(sem cidade)"}</div>
            ))}
            {pendentes.length > 50 && <div>...e mais {pendentes.length - 50}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
