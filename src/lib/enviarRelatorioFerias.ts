import { supabase } from "@/integrations/supabase/client";
import {
  gerarPdfFerias,
  gerarExcelFerias,
  type FeriasReportRow,
  type EscalaReportRow,
} from "@/lib/gerarRelatoriosFerias";

const BUCKET = "relatorios-ferias";
const DEBOUNCE_MS = 20_000; // agrupa múltiplas alterações seguidas
const INTERVALO_MINIMO_MIN = 15; // evita spam ao RH

let timer: ReturnType<typeof setTimeout> | null = null;
let motivosPendentes: string[] = [];

interface FeriasDb {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_limite_concessao: string;
  dias_direito: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  dias_gozados: number;
  dias_abonados: number;
  status: string;
}

const CONCLUIDOS = ["concluída", "concluida", "gozada", "paga"];

/** Monta as linhas do relatório (cobertura do posto) e a escala sugerida. */
export async function montarDadosFerias(): Promise<{ rows: FeriasReportRow[]; escala: EscalaReportRow[] }> {
  const [feriasRes, funcRes, cargosRes, clientesRes] = await Promise.all([
    (supabase as any).from("ferias").select("*").order("data_limite_concessao", { ascending: true }),
    (supabase as any).from("funcionarios").select("id, nome, cargo_id, cliente_id, status"),
    (supabase as any).from("cargos").select("id, nome"),
    (supabase as any).from("clientes").select("id, nome"),
  ]);

  const ferias: FeriasDb[] = feriasRes.data || [];
  const funcionarios: any[] = funcRes.data || [];
  const cargos: any[] = cargosRes.data || [];
  const clientes: any[] = clientesRes.data || [];
  const nomeCliente = (id?: string | null) => clientes.find((c) => c.id === id)?.nome || "—";
  const hoje = new Date();

  const indisponiveis = new Set<string>();
  ferias.forEach((f) => {
    const st = (f.status || "").toLowerCase();
    if (["em gozo", "aprovada", "gozada"].includes(st)) indisponiveis.add(f.funcionario_id);
    if (f.data_limite_concessao) {
      const d = Math.ceil((new Date(f.data_limite_concessao + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
      if (d <= 60 && !CONCLUIDOS.includes(st)) indisponiveis.add(f.funcionario_id);
    }
  });

  const rows: FeriasReportRow[] = ferias.map((f) => {
    const func = funcionarios.find((x) => x.id === f.funcionario_id);
    const diasParaVencer = Math.ceil(
      (new Date(f.data_limite_concessao + "T00:00:00").getTime() - hoje.getTime()) / 86400000,
    );
    const substitutos = func
      ? funcionarios
          .filter(
            (x) =>
              x.id !== func.id &&
              x.cargo_id &&
              x.cargo_id === func.cargo_id &&
              (x.status || "Ativo") === "Ativo" &&
              !indisponiveis.has(x.id),
          )
          .sort((a, b) => Number(b.cliente_id === func.cliente_id) - Number(a.cliente_id === func.cliente_id))
          .slice(0, 3)
          .map((x) => ({
            id: x.id,
            nome: x.nome,
            mesmoPosto: x.cliente_id === func.cliente_id,
            clienteNome: nomeCliente(x.cliente_id),
          }))
      : [];
    const critico = f.status !== "Concluída" && diasParaVencer <= 60;
    return {
      ...f,
      clienteNome: nomeCliente(func?.cliente_id),
      cargoNome: cargos.find((c) => c.id === func?.cargo_id)?.nome || "—",
      diasParaVencer,
      substitutos,
      critico,
      precisaTemporario: critico && substitutos.length === 0,
    } as FeriasReportRow;
  });

  const usados = new Set<string>();
  const escala: EscalaReportRow[] = rows
    .filter((r) => r.critico)
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
    .map((r) => {
      const livre = r.substitutos.find((s) => !usados.has(s.id));
      if (livre) usados.add(livre.id);
      const base = new Date(r.data_limite_concessao + "T00:00:00");
      const dias = r.dias_direito || 30;
      const fim = new Date(base.getTime() - 5 * 86400000);
      const inicio = new Date(fim.getTime() - (dias - 1) * 86400000);
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
      return {
        ...r,
        precisaTemporario: !livre,
        substitutoEscolhido: livre
          ? `${livre.nome}${livre.mesmoPosto ? " (mesmo posto)" : ` (remanejar de ${livre.clienteNome})`}`
          : "",
        inicioSugerido: fmt(inicio),
        fimSugerido: fmt(fim),
      };
    });

  return { rows, escala };
}

const VALIDADE_LINK_S = 60 * 60 * 24 * 60; // 60 dias

async function upload(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, VALIDADE_LINK_S);
  if (signErr || !data?.signedUrl) throw signErr || new Error("Falha ao gerar link do relatório.");
  return data.signedUrl;
}

/** Gera PDF + Excel, publica no storage e envia o e-mail ao RH. */
export async function enviarRelatorioFeriasAgora(
  motivo: string,
  opts?: { ignorarIntervalo?: boolean },
): Promise<{ enviado: boolean; motivoSkip?: string }> {
  const { data: empresa } = await (supabase as any)
    .from("empresa")
    .select("email_rh, nome_fantasia, razao_social")
    .limit(1)
    .maybeSingle();

  const destinatario = (empresa?.email_rh || "").trim();
  if (!destinatario) return { enviado: false, motivoSkip: "E-mail do RH não cadastrado em Dados da Empresa." };

  if (!opts?.ignorarIntervalo) {
    const limite = new Date(Date.now() - INTERVALO_MINIMO_MIN * 60_000).toISOString();
    const { data: recente } = await (supabase as any)
      .from("ferias_relatorio_envios")
      .select("id")
      .eq("status", "enviado")
      .gte("created_at", limite)
      .limit(1);
    if (recente && recente.length > 0) {
      return { enviado: false, motivoSkip: `Relatório já enviado nos últimos ${INTERVALO_MINIMO_MIN} minutos.` };
    }
  }

  const { rows, escala } = await montarDadosFerias();
  const pdf = (await gerarPdfFerias(rows, { output: "blob" })) as Blob;
  const xlsx = await gerarExcelFerias(rows, escala, { output: "blob" }) as Blob;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pasta = `mapa-ferias/${stamp}`;
  const [pdfUrl, xlsxUrl] = await Promise.all([
    upload(`${pasta}/relatorio-mapa-ferias.pdf`, pdf),
    upload(`${pasta}/relatorio-mapa-ferias.xlsx`, xlsx),
  ]);

  const resumo = {
    total: rows.length,
    vencidas: rows.filter((r) => r.diasParaVencer < 0).length,
    criticas: rows.filter((r) => r.diasParaVencer >= 0 && r.diasParaVencer <= 30).length,
    atencao: rows.filter((r) => r.diasParaVencer > 30 && r.diasParaVencer <= 60).length,
    semCobertura: rows.filter((r) => r.precisaTemporario).length,
  };

  const { data: log } = await (supabase as any)
    .from("ferias_relatorio_envios")
    .insert({
      destinatario,
      motivo,
      status: "pendente",
      pdf_url: pdfUrl,
      excel_url: xlsxUrl,
      resumo,
    })
    .select("id")
    .maybeSingle();

  const { error } = await supabase.functions.invoke("send-email-mapa-ferias", {
    body: {
      recipientEmail: destinatario,
      idempotencyKey: `mapa-ferias-${stamp}`,
      templateData: {
        empresa: empresa?.nome_fantasia || empresa?.razao_social || "LASANT",
        motivo,
        pdfUrl,
        excelUrl: xlsxUrl,
        ...resumo,
        geradoEm: new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      },
    },
  });

  if (log?.id) {
    await (supabase as any)
      .from("ferias_relatorio_envios")
      .update({ status: error ? "erro" : "enviado", erro: error ? String(error.message || error) : null })
      .eq("id", log.id);
  }

  if (error) throw error;
  return { enviado: true };
}

/**
 * Agenda o envio automático do relatório ao RH após uma atualização do mapa de férias.
 * Múltiplas alterações em sequência são agrupadas em um único envio.
 */
export function agendarEnvioRelatorioFerias(motivo: string) {
  motivosPendentes.push(motivo);
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const motivos = Array.from(new Set(motivosPendentes));
    motivosPendentes = [];
    timer = null;
    try {
      await enviarRelatorioFeriasAgora(motivos.join("; "));
    } catch (e) {
      console.error("Falha no envio automático do relatório de férias:", e);
    }
  }, DEBOUNCE_MS);
}
