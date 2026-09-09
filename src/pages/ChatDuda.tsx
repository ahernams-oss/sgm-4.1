import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Trash2, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { gerarPdfDuda, gerarExcelDuda, gerarWordDuda, type ReportData } from "@/lib/gerarRelatorioDuda";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";
import dudaAvatar from "@/assets/duda-avatar.png";

const DudaAvatar = ({ className = "h-5 w-5" }: { className?: string }) => (
  <img src={dudaAvatar} alt="Duda" className={`${className} rounded-full object-cover`} />
);

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-duda`;

const REPORT_REGEX = /\[RELATORIO:(PDF|EXCEL|WORD)\]\s*([\s\S]*?)\s*\[\/RELATORIO\]/g;

function parseReports(content: string): { text: string; reports: { format: string; data: ReportData }[] } {
  const reports: { format: string; data: ReportData }[] = [];
  const text = content.replace(REPORT_REGEX, (_, format, json) => {
    try {
      const data = JSON.parse(json.trim()) as ReportData;
      reports.push({ format: format.toUpperCase(), data });
      return ""; // remove block from displayed text
    } catch {
      return "";
    }
  }).trim();
  return { text, reports };
}

async function streamChat({ messages, onDelta, onDone, onError }: {
  messages: Msg[]; onDelta: (t: string) => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
    onError(err.error || "Erro ao conectar com a Duda"); return;
  }
  if (!resp.body) { onError("Stream indisponível"); return; }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { buf = line + "\n" + buf; break; }
    }
  }
  onDone();
}

function ReportButton({ format, data }: { format: string; data: ReportData }) {
  const [loading, setLoading] = useState(false);

  const icon = format === "PDF" ? <FileText className="h-4 w-4" /> :
    format === "EXCEL" ? <FileSpreadsheet className="h-4 w-4" /> :
    <FileDown className="h-4 w-4" />;

  const label = format === "PDF" ? "Baixar PDF" : format === "EXCEL" ? "Baixar Excel" : "Baixar Word";

  const handleClick = async () => {
    setLoading(true);
    try {
      if (format === "PDF") gerarPdfDuda(data);
      else if (format === "EXCEL") gerarExcelDuda(data);
      else await gerarWordDuda(data);
      toast.success(`${format} gerado com sucesso!`);
    } catch (e) {
      toast.error(`Erro ao gerar ${format}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm" className="gap-2 mt-2 mr-2">
      {icon} {loading ? "Gerando..." : label}
    </Button>
  );
}

function AssistantMessage({ content, podeExportar }: { content: string; podeExportar: boolean }) {
  const { text, reports } = parseReports(content);
  return (
    <div>
      {text && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
      {podeExportar && reports.length > 0 && (
        <div className="flex flex-wrap mt-1">
          {reports.map((r, i) => <ReportButton key={i} format={r.format} data={r.data} />)}
        </div>
      )}
    </div>
  );
}

export default function ChatDuda() {
  const { tem } = usePermissao();
  const podeUsar = tem("chat_duda.usar");
  const podeExportar = tem("chat_duda.exportar");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useCallback(async () => {
    if (!podeUsar) { toast.error("Você não possui permissão para esta ação."); return; }
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };
    await streamChat({
      messages: [...messages, userMsg],
      onDelta: upsert,
      onDone: () => setLoading(false),
      onError: (msg) => { upsert(`⚠️ ${msg}`); setLoading(false); },
    });
  }, [input, loading, messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-primary/20">
            <DudaAvatar className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Duda</h1>
            <p className="text-xs text-muted-foreground">Assistente Inteligente do SGM</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-primary/20">
              <DudaAvatar className="h-16 w-16" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Olá! Eu sou a Duda 💡</h2>
              <p className="text-muted-foreground mt-1 max-w-md">
                Estou aqui para te ajudar com dúvidas sobre o sistema, gerar relatórios e fornecer informações. Como posso ajudar?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-lg w-full">
              {[
                "Como faço uma requisição de compras?",
                "Gere um relatório de funcionários em PDF",
                "Como gerar um relatório de estoque?",
                "Gere um relatório de equipamentos em Excel",
              ].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-left text-sm border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-muted-foreground">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 mb-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 mt-1 ring-1 ring-primary/20">
                <DudaAvatar className="h-8 w-8" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}>
              {m.role === "assistant" ? <AssistantMessage content={m.content} podeExportar={podeExportar} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
            </div>
            {m.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3 mb-4">
            <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 ring-1 ring-primary/20 animate-pulse">
              <DudaAvatar className="h-8 w-8" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-3">
              <span className="text-sm text-muted-foreground animate-pulse">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Digite sua pergunta..." className="min-h-[44px] max-h-[120px] resize-none" rows={1} disabled={loading} />
          <Button onClick={send} disabled={!input.trim() || loading} size="icon" className="shrink-0 h-[44px] w-[44px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
