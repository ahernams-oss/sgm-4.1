import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useOrdensServico, OrdemServico } from "@/contexts/OrdensServicoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useCargos } from "@/contexts/CargosContext";
import { useOsAssinaturas, PapelOsAssinatura } from "@/contexts/OsAssinaturasContext";
import { usePermissao } from "@/hooks/usePermissao";
import { gerarHashOs, obterIpOrigem } from "@/lib/assinaturaHashOs";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { formatNumeroAno } from "@/lib/formatNumero";
import { TokenAssinaturaEmail } from "@/components/TokenAssinaturaEmail";
import { purposeAssinatura, verificarTokenAssinatura } from "@/lib/otpAssinatura";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileSignature, Search, ShieldCheck } from "lucide-react";

const labelPapel = (p: PapelOsAssinatura) =>
  p === "solicitante"
    ? "Solicitante"
    : p === "fiscal"
    ? "Fiscal do Contrato 1"
    : p === "fiscal_2"
    ? "Fiscal do Contrato 2"
    : "Fiscal do Contrato 3";

export default function AssinarLoteOs() {
  const { ordens } = useOrdensServico();
  const { usuarioLogado } = useAuth();
  const { clientes } = useClientes();
  const { cargos } = useCargos();
  const { tem } = usePermissao();
  const { assinaturas, registrar, refresh } = useOsAssinaturas();

  const _saved = loadPersistedFilters<{ search: string; filterCliente: string; }>("assinar_lote_os_filters_v1");
  const [search, setSearch] = useState(_saved?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(_saved?.filterCliente ?? "all");
  usePersistFilters("assinar_lote_os_filters_v1", { search, filterCliente });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [papel, setPapel] = useState<PapelOsAssinatura>("fiscal");
  const [openConfirm, setOpenConfirm] = useState(false);
  const [senha, setSenha] = useState("");
  const [token, setToken] = useState("");

  const [signing, setSigning] = useState(false);

  const podeFiscal = tem("os.assinar_fiscal");
  const podeAssinarLote = tem("os.assinar_lote");

  // Apenas OS Validadas podem ser assinadas, e sem sobreposição (mesmo papel)
  const validadasDisponiveis = useMemo(() => {
    return ordens.filter((os) => {
      if (os.situacao !== "Validada") return false;
      const jaAssinada = assinaturas.some(
        (a) => a.os_id === os.id && a.papel === papel
      );
      return !jaAssinada;
    });
  }, [ordens, assinaturas, papel]);

  const filtered = useMemo(() => {
    let result = validadasDisponiveis;
    if (filterCliente !== "all") {
      result = result.filter((s) => s.clienteId === filterCliente);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          String(s.numero).includes(q) ||
          formatNumeroAno(s.numero, s.createdAt).toLowerCase().includes(q) ||
          s.clienteNome?.toLowerCase().includes(q) ||
          s.descricaoServicos?.toLowerCase().includes(q) ||
          s.localDescricao?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [validadasDisponiveis, search, filterCliente]);

  const { paginated } = paginate(filtered, page, pageSize);
  const allPageIds = paginated.map((s) => s.id);
  const allPageSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) allPageIds.forEach((id) => next.delete(id));
      else allPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clientesUnicos = useMemo(
    () =>
      (clientes || [])
        .filter((c: any) => (c.tipo || "Cliente") === "Cliente")
        .map((c: any) => [c.id, c.nome] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [clientes]
  );

  const isFiscalPapel = papel === "fiscal" || papel === "fiscal_2" || papel === "fiscal_3";
  const podePapel = isFiscalPapel ? podeFiscal : true;

  const handleAssinarLote = async () => {
    if (!podeAssinarLote) {
      toast.error("Você não possui permissão para esta ação.");
      return;
    }
    if (!usuarioLogado) {
      toast.error("Usuário não autenticado.");
      return;
    }
    const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
    if (!senhaOk) {
      toast.error("Senha incorreta.");
      return;
    }
    if (token.length !== 6) {
      toast.error("Informe o token de 6 dígitos enviado por e-mail.");
      return;
    }
    const otp = await verificarTokenAssinatura({
      usuarioId: usuarioLogado.id,
      purpose: purposeAssinatura("os", "lote", papel),
      code: token,
    });
    if (!otp.success) {
      toast.error(otp.error || "Token inválido ou expirado.");
      return;
    }
    if (isFiscalPapel && !podeFiscal) {
      toast.error("Sem permissão para assinar como Fiscal do Contrato.");
      return;
    }

    setSigning(true);
    const ip = await obterIpOrigem();
    const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);
    const matricula = usuarioLogado.matricula || "";

    let ok = 0;
    let fail = 0;

    for (const id of selectedIds) {
      const os = ordens.find((o) => o.id === id);
      if (!os || os.situacao !== "Validada") {
        fail++;
        continue;
      }
      // Não duplicar (sobreposição de assinatura)
      if (assinaturas.some((a) => a.os_id === os.id && a.papel === papel)) {
        fail++;
        continue;
      }
      try {
        const hash = await gerarHashOs(os);
        const r = await registrar({
          os_id: os.id,
          os_numero: os.numero || 0,
          papel,
          signatario_user_id: usuarioLogado.id,
          signatario_nome: usuarioLogado.nome,
          signatario_email: usuarioLogado.email,
          signatario_cargo: cargo?.nome || "",
          signatario_matricula: matricula,
          hash_documento: hash,
          ip_origem: ip,
          user_agent: navigator.userAgent,
        });
        if (r) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }

    await refresh();
    setSigning(false);
    setOpenConfirm(false);
    setSenha(""); setToken("");
    setSelectedIds(new Set());

    if (ok > 0) {
      toast.success(
        `${ok} OS assinada(s) como ${labelPapel(papel)}.${
          fail > 0 ? ` ${fail} falharam.` : ""
        }`
      );
    } else {
      toast.error("Nenhuma OS pôde ser assinada.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Assinar OS em Lote
            </h1>
            <p className="text-sm text-muted-foreground">
              Ordens de Serviço validadas, pendentes de assinatura
            </p>
          </div>
        </div>
        <Badge variant="secondary">{filtered.length} disponíveis</Badge>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-[220px]">
          <Label className="text-xs">Assinar como</Label>
          <Select
            value={papel}
            onValueChange={(v) => {
              setPapel(v as PapelOsAssinatura);
              setSelectedIds(new Set());
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fiscal">Fiscal do Contrato 1</SelectItem>
              <SelectItem value="fiscal_2">Fiscal do Contrato 2</SelectItem>
              <SelectItem value="fiscal_3">Fiscal do Contrato 3</SelectItem>
              <SelectItem value="solicitante">Solicitante</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nº, cliente, descrição..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="w-[220px]">
          <Label className="text-xs">Cliente</Label>
          <Select
            value={filterCliente}
            onValueChange={(v) => {
              setFilterCliente(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {clientesUnicos.map(([id, nome]) => (
                <SelectItem key={id} value={id}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!podePapel && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          Você não possui permissão para assinar como Fiscal do Contrato.
        </div>
      )}

      {selectedIds.size > 0 && podePapel && podeAssinarLote && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">
            {selectedIds.size} OS selecionada(s)
          </span>
          <Button size="sm" onClick={() => setOpenConfirm(true)}>
            <FileSignature className="mr-2 h-4 w-4" />
            Assinar selecionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={!podePapel}
                  aria-label="Selecionar todos da página"
                />
              </TableHead>
              <TableHead className="w-16">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Descrição do Serviço</TableHead>
              <TableHead className="w-32">Solicitante</TableHead>
              <TableHead className="w-28 text-center">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-12"
                >
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhuma OS disponível para assinatura
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((s: OrdemServico, idx: number) => (
                <TableRow
                  key={s.id}
                  className={selectedIds.has(s.id) ? "bg-accent/50" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                      disabled={!podePapel}
                      aria-label={`Selecionar OS ${s.numero}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold">
                    {formatNumeroAno(s.numero, s.createdAt)}
                  </TableCell>
                  <TableCell>{s.clienteNome || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[s.localDescricao, s.pavimentoDescricao, s.setorDescricao]
                      .filter(Boolean)
                      .join(" › ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">
                    {s.descricaoServicos || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.solicitante || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{s.tipoOs?.sigla || "—"}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        currentPage={page}
        totalItems={filtered.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura Eletrônica em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você assinará <strong>{selectedIds.size} OS</strong> como{" "}
              <strong>
                {labelPapel(papel)}
              </strong>
              .
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p>
                <strong>Signatário:</strong> {usuarioLogado?.nome}
              </p>
              <p>
                <strong>E-mail:</strong> {usuarioLogado?.email}
              </p>
              <p className="italic text-muted-foreground mt-2">
                Cada OS receberá uma assinatura individual com data, hora, IP,
                hash e código verificador único, conforme Lei nº 14.063, de 23 de Setembro de 2020.
              </p>
            </div>
            <div>
              <Label>Confirme sua senha para prosseguir</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>
            {usuarioLogado && (
              <TokenAssinaturaEmail
                usuarioId={usuarioLogado.id}
                purpose={purposeAssinatura("os", "lote", papel)}
                documento={`Assinatura em lote de ${selectedIds.size} Ordem(ns) de Serviço`}
                papel={labelPapel(papel)}
                token={token}
                onTokenChange={setToken}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenConfirm(false);
                setSenha("");
                setToken("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssinarLote}
              disabled={signing || !senha || token.length !== 6 || selectedIds.size === 0}
            >

              {signing ? "Assinando..." : "Confirmar e Assinar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
