DO $migration$
DECLARE
  unidade record;
  contratos_atuais jsonb;
  novo_contrato jsonb;
BEGIN
  FOR unidade IN SELECT * FROM (VALUES
    ('20053f10-3569-4995-aa79-6c3bcbaf09c7'::uuid, 'UPA JOÃO XXIII'),
    ('f9d94b0b-c38a-4a71-b5cb-dc5244243f2b'::uuid, 'UPA MAGALHÃES BASTOS'),
    ('cc51d935-4cd5-4588-9373-f45ffeb68eb8'::uuid, 'UPA PACIÊNCIA'),
    ('d95f98a4-d2bd-4c57-b7e9-7ce40fc1bd59'::uuid, 'UPA SENADOR CAMARÁ'),
    ('12358185-078a-4d31-8e7f-f239533181c3'::uuid, 'UPA SEPETIBA'),
    ('ced78f0d-3c5b-4e3a-ad84-ca8aaaececb4'::uuid, 'UPA VILA KENNEDY')
  ) AS alvo(id, nome)
  LOOP
    SELECT contratos INTO contratos_atuais FROM public.clientes WHERE id=unidade.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'UPA não encontrada: %', unidade.nome; END IF;
    IF contratos_atuais IS NOT NULL AND contratos_atuais <> '[]'::jsonb THEN
      RAISE EXCEPTION 'Contratos existentes mudaram para %, interrompendo para preservar os dados', unidade.nome;
    END IF;
    novo_contrato := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'numero', '121/2023',
      'numeroProcesso', 'RSU-PRO-2022/02389',
      'descricao', 'SERVIÇO DE MANUTENÇÃO PREDIAL PREVENTIVA E CORRETIVA, REFRIGERAÇÃO E JARDINAGEM COM FORNECIMENTO DE MATERIAIS.',
      'dataInicio', '2023-05-01',
      'dataFim', '2029-05-01',
      'iss', '3',
      'textoNotaFiscal', 'PRESTAÇÃO DE SERVIÇO DE MANUTENÇÃO PREDIAL PREVENTIVA E CORRETIVA, REFRIGERAÇÃO E JARDINAGEM COM FORNECIMENTO DE MATERIAIS – ' || unidade.nome || ' - PERÍODO DE EXECUÇÃO DE (      /       /          )  A (       /       /           ). CONTRATO Nº 121/2023 / PROCESSO Nº RSU-PRO-2022/02389 - VALOR MÃO DE OBRA -> R$ ------------- / MATERIAL APLICADO E SERVIÇOS EXTRAS -> R$ ------------ / BENEFÍCIOS E INSUMOS -> R$ ----------- / RETENÇÃO INSS 11% -> R$ ----------- / VALOR LÍQUIDO -> VIDE RODAPÉ DESTA NOTA FISCAL - DADOS BANCÁRIOS: BCO SANTANDER  /  AG.: 1525  /  C/C.: 1300126228 / RETENÇÕES: PIS - 0,65% - R$ ----------- / COFINS - 3,00% - R$ ---------- / CSLL - 1,00% - R$ ---------.',
      'bdi', '', 'valorBase', '', 'valorBase2', '', 'valorBase3', '', 'mesSco', '', 'anoSco', '',
      'faturamentos', '[]'::jsonb, 'empenhos', '[]'::jsonb
    );
    UPDATE public.clientes SET contratos=jsonb_build_array(novo_contrato) WHERE id=unidade.id;
  END LOOP;
END
$migration$;