import { useState, useEffect, useRef } from "react";
import { useComunicacao, Conversa } from "@/contexts/ComunicacaoContext";
import { useUsuarios } from "@/contexts/UsuariosContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";
import { Plus, Send, MessageSquare, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ComunicacaoMensagens() {
  const { conversas, mensagens, loadMensagens, addConversa, addParticipante, addMensagem, deleteConversa } = useComunicacao();
  const { usuarios } = useUsuarios();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriarConversa = tem("comunicacao_mensagens.criar_conversa");
  const podeEnviar = tem("comunicacao_mensagens.enviar");
  const podeCriarGrupo = tem("comunicacao_mensagens.criar_grupo");

  const [selectedConversa, setSelectedConversa] = useState<string | null>(null);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaConversaTipo, setNovaConversaTipo] = useState<"direta" | "grupo">("direta");
  const [novaConversaTitulo, setNovaConversaTitulo] = useState("");
  const [participantesSelecionados, setParticipantesSelecionados] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedConversa) {
      loadMensagens(selectedConversa);
      const channel = supabase
        .channel(`msgs-${selectedConversa}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "comunicacao_mensagens",
          filter: `conversa_id=eq.${selectedConversa}`,
        }, () => { loadMensagens(selectedConversa); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedConversa, loadMensagens]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleCriarConversa = async () => {
    if (!podeCriarConversa) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (novaConversaTipo === "grupo" && !podeCriarGrupo) { toast({ title: "Você não possui permissão para criar grupos.", variant: "destructive" }); return; }
    if (participantesSelecionados.length === 0) {
      toast({ title: "Selecione ao menos um participante", variant: "destructive" });
      return;
    }
    const titulo = novaConversaTipo === "grupo" ? novaConversaTitulo : "";
    const result = await addConversa({
      tipo: novaConversaTipo,
      titulo,
      criado_por: usuarioLogado?.nome || "",
    });
    if (result?.id) {
      // Add creator as participant
      await addParticipante({
        conversa_id: result.id,
        usuario_nome: usuarioLogado?.nome || "",
        usuario_email: usuarioLogado?.email || "",
      });
      // Add selected participants
      for (const uid of participantesSelecionados) {
        const u = usuarios.find(us => us.id === uid);
        if (u) {
          await addParticipante({
            conversa_id: result.id,
            usuario_nome: u.nome,
            usuario_email: u.email,
          });
        }
      }
      setSelectedConversa(result.id);
      toast({ title: "Conversa criada com sucesso!" });
    }
    setDialogOpen(false);
    setNovaConversaTitulo("");
    setParticipantesSelecionados([]);
  };

  const handleEnviarMensagem = async () => {
    if (!podeEnviar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!novaMensagem.trim() || !selectedConversa) return;
    await addMensagem({
      conversa_id: selectedConversa,
      remetente_nome: usuarioLogado?.nome || "",
      remetente_email: usuarioLogado?.email || "",
      conteudo: novaMensagem.trim(),
    });
    setNovaMensagem("");
    await loadMensagens(selectedConversa);
  };

  const conversaAtual = conversas.find(c => c.id === selectedConversa);

  const getConversaLabel = (c: Conversa) => {
    if (c.tipo === "grupo") return c.titulo || "Grupo";
    const other = c.participantes.find(p => p.usuarioEmail !== usuarioLogado?.email);
    return other?.usuarioNome || c.participantes[0]?.usuarioNome || "Conversa";
  };

  const filteredConversas = conversas.filter(c => {
    if (!search.trim()) return true;
    const label = getConversaLabel(c).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 pt-[15px] pl-0 pr-[10px]">
      <h1 className="text-2xl font-bold mx-[7px]">Mensagens</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-160px)]">
        {/* Sidebar de conversas */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Conversas</CardTitle>
              {podeCriarConversa && (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Nova
                </Button>
              )}
            </div>
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {filteredConversas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConversa(c.id)}
                    className={`w-full text-left rounded-md p-3 transition-colors ${
                      selectedConversa === c.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {c.tipo === "grupo" ? (
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{getConversaLabel(c)}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                        {c.tipo === "grupo" ? "Grupo" : "Direta"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {c.participantes.length} participante{c.participantes.length !== 1 && "s"}
                    </p>
                  </button>
                ))}
                {filteredConversas.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de mensagens */}
        <Card className="md:col-span-2 flex flex-col">
          {selectedConversa && conversaAtual ? (
            <>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{getConversaLabel(conversaAtual)}</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      {conversaAtual.participantes.map(p => p.usuarioNome).join(", ")}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      await deleteConversa(selectedConversa);
                      setSelectedConversa(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3">
                    {mensagens.map(m => {
                      const isMe = m.remetenteEmail === usuarioLogado?.email;
                      return (
                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-lg p-3 ${
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            {!isMe && (
                              <p className="text-[11px] font-semibold mb-1">{m.remetenteNome}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {m.createdAt ? format(new Date(m.createdAt), "dd/MM/yy HH:mm", { locale: ptBR }) : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleEnviarMensagem()}
                />
                <Button onClick={handleEnviarMensagem} disabled={!novaMensagem.trim() || !podeEnviar}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione ou crie uma conversa</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Dialog nova conversa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={novaConversaTipo} onValueChange={(v: any) => setNovaConversaTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direta">Direta</SelectItem>
                  <SelectItem value="grupo">Grupo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {novaConversaTipo === "grupo" && (
              <div>
                <Label>Nome do Grupo</Label>
                <Input value={novaConversaTitulo} onChange={e => setNovaConversaTitulo(e.target.value)} placeholder="Nome do grupo..." />
              </div>
            )}
            <div>
              <Label>Participantes</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-2 mt-1">
                {usuarios
                  .filter(u => u.email !== usuarioLogado?.email)
                  .map(u => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={participantesSelecionados.includes(u.id)}
                        onCheckedChange={(checked) => {
                          if (novaConversaTipo === "direta") {
                            setParticipantesSelecionados(checked ? [u.id] : []);
                          } else {
                            setParticipantesSelecionados(prev =>
                              checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            );
                          }
                        }}
                      />
                      <span className="text-sm">{u.nome}</span>
                      <span className="text-xs text-muted-foreground">({u.email})</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarConversa}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
