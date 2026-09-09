import { useMemo, useState } from "react";
import { useComunicacao } from "@/contexts/ComunicacaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

/**
 * Popup global persistente: enquanto houver Avisos & Comunicados não lidos
 * pelo usuário logado, exibe um diálogo (não fechável por overlay) com o
 * próximo aviso pendente. Só fecha após o usuário marcar como lido.
 */
export default function AvisosPopup() {
  const { avisos, confirmarLeitura, grupos } = useComunicacao();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const pendentes = useMemo(() => {
    if (!usuarioLogado) return [];
    const meuEmail = usuarioLogado.email;
    const meusGrupoIds = new Set(
      grupos.filter(g => (g.membrosEmails || []).includes(meuEmail)).map(g => g.id)
    );
    return avisos
      .filter(a => a.ativo !== false)
      // targeting: se ambos vazios = broadcast; senão precisa estar em destinatarios ou em algum grupo do qual sou membro
      .filter(a => {
        const dest = a.destinatariosEmails || [];
        const grps = a.gruposIds || [];
        if (dest.length === 0 && grps.length === 0) return true;
        if (dest.includes(meuEmail)) return true;
        return grps.some(gid => meusGrupoIds.has(gid));
      })
      .filter(a => !(a.leituras || []).some(l => l.usuarioEmail === meuEmail))
      // mais antigos primeiro, para o usuário ir confirmando em ordem
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }, [avisos, usuarioLogado, grupos]);

  const atual = pendentes[0];
  if (!atual || !usuarioLogado) return null;

  const prioridadeColor = (p: string) => {
    switch (p) {
      case "Urgente": return "bg-yellow-500 text-white";
      case "Crítica": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleConfirmar = async () => {
    setSaving(true);
    try {
      await confirmarLeitura({
        aviso_id: atual.id,
        usuario_nome: usuarioLogado.nome,
        usuario_email: usuarioLogado.email,
      });
      toast({ title: "Leitura confirmada" });
    } catch {
      toast({ title: "Erro ao confirmar leitura", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => { /* bloqueado: não fecha sem confirmar */ }}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {atual.titulo}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge className={prioridadeColor(atual.prioridade)}>{atual.prioridade}</Badge>
            <span className="text-xs text-muted-foreground">
              {atual.criadoPor && `Publicado por ${atual.criadoPor}`}
              {atual.createdAt && ` em ${format(new Date(atual.createdAt), "dd/MM/yyyy, HH:mm", { locale: ptBR })}`}
            </span>
            {pendentes.length > 1 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {pendentes.length - 1} pendente(s) após este
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm text-foreground py-2">
          {atual.conteudo}
        </div>

        <DialogFooter>
          <Button onClick={handleConfirmar} disabled={saving}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {saving ? "Confirmando..." : "Marcar como lido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
