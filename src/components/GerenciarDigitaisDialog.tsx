import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import {
  disponibilidadeDigital,
  listarDigitais,
  cadastrarDigital,
  removerDigital,
  type DigitalCadastrada,
  type Disponibilidade,
} from "@/lib/passkeys";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const formatarData = (iso: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const nomeAparelho = (d: DigitalCadastrada): string => {
  if (d.device_type === "multiDevice") return "Aparelho sincronizado";
  if (d.device_type === "singleDevice") return "Aparelho único";
  return "Digital";
};

export function GerenciarDigitaisDialog({ open, onOpenChange }: Props) {
  const [digitais, setDigitais] = useState<DigitalCadastrada[]>([]);
  const [disponivel, setDisponivel] = useState<Disponibilidade>({ ok: true, motivo: "" });
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDigitais(await listarDigitais());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível listar as suas digitais.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    disponibilidadeDigital()
      .then(setDisponivel)
      .catch(() =>
        setDisponivel({ ok: false, motivo: "A digital não está disponível neste aparelho." }),
      );
    void recarregar();
  }, [open, recarregar]);

  const cadastrar = async () => {
    setSalvando(true);
    try {
      await cadastrarDigital(nome);
      toast.success("Digital cadastrada neste aparelho.");
      setNome("");
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar a digital.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (d: DigitalCadastrada) => {
    setSalvando(true);
    try {
      await removerDigital(d.id);
      toast.success("Digital removida.");
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover a digital.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Acesso com digital
          </DialogTitle>
          <DialogDescription>
            Entre no SGM com a digital ou o reconhecimento facial deste aparelho, sem digitar
            senha. A chave fica no próprio aparelho; no sistema fica apenas o necessário para
            conferi-la.
          </DialogDescription>
        </DialogHeader>

        {!disponivel.ok && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {disponivel.motivo}
          </p>
        )}

        <div className="space-y-1">
          <Label htmlFor="nome-digital">Nome para esta digital</Label>
          <div className="flex gap-2">
            <Input
              id="nome-digital"
              placeholder="Ex.: Celular pessoal"
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
            />
            <Button onClick={cadastrar} disabled={!disponivel.ok || salvando}>
              <Plus className="mr-1 h-4 w-4" />
              Cadastrar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A janela do aparelho pede a sua digital para concluir o cadastro.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Digitais cadastradas</p>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : digitais.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Nenhuma digital cadastrada ainda.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {digitais.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.nome || nomeAparelho(d)}</p>
                    <p className="text-xs text-muted-foreground">
                      {nomeAparelho(d)} · cadastrada em {formatarData(d.criado_em)} · último uso{" "}
                      {formatarData(d.ultimo_uso)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remover(d)}
                    disabled={salvando}
                    aria-label={`Remover a digital ${d.nome || nomeAparelho(d)}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
