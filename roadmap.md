# Tarefas

- [x] Remover a dependência da consulta IBGE indisponível na emissão: tabela local com 5.571 códigos únicos, origem/licença incluídas; validações de município retornam mensagem sem erro 500, antes de gravar ou enviar. Dez testes passaram, incluindo rede indisponível; build OK. Não testei com login e nenhuma nota foi reenviada.

- [x] Corrigir município do tomador na emissão NFS-e: endereço usa a cidade/UF do cliente, consulta o IBGE antes de criar o rascunho e bloqueia códigos ausentes ou zero; mesma validação para endereço brasileiro da obra. Nove testes passaram e build OK; nenhuma nota reenviada; não testei com login.

- [x] Corrigir o erro 500 ao gravar o rascunho da NFS-e: o problema era o cast implícito de texto vazio para smallint na chave de bloqueio da numeração, não os campos do formulário. Migração aplicada; testes do gatilho em tabela temporária passaram em homologação, produção e número explícito; três testes Brasil NFe passaram e build OK. Nenhuma nota enviada; não testei com login.

- [x] Substituir Focus por Brasil NFe na emissão de NFS-e com envio e consulta de lote conforme documentação oficial; três testes passaram. Emissão real e compatibilidade nacional do município não verificadas; não testei com login.

- [x] Melhorar os seletores de códigos de tributação nacional e municipal na NFS-e com busca por código e descrição sem acentos/pontuação, descrições completas e contagem dos resultados; três testes passaram e build OK. Não testei com login.

- [x] Transformar Pago em botão no faturamento de clientes e exigir data do crédito em conta e senha do usuário antes da gravação; quatro testes passaram e a página sem sessão redirecionou ao login sem erros. Não testei com login.

- [x] Corrigir recuperação de fotos e memória antes da impressão individual e em lote e acesso às fotos privadas; sete testes passaram e PDF de teste confirmou foto e memória com valores sem sobreposição. Não testei com login.

- [x] Exibir valores unitários, por setor, subtotais e total na memória de cálculo dos PDFs combinados de O.S., com e sem fotos, individuais e em lote; três testes passaram e as duas folhas foram conferidas visualmente. Não testei com login.

- [x] Corrigir aprovação de orçamento sem limite no diálogo compartilhado (desktop e celular), impor proteção no banco e testar os critérios de bloqueio (4 testes).

Limite desta correção: aprovação autenticada não testada; não testei com login no Supabase externo.

- [x] Preparar base de sugestões somente com O.S. validadas de 2025 e 2026, associada aos cadastros atuais.
- [x] Exibir e permitir aceitar sugestões de categoria e serviço na abertura de O.S., sem substituir a classificação manual.
- [x] Testar critérios de elegibilidade e correspondência, verificar a integração disponível sem login.

Limite da verificação: fluxo autenticado de aceitar e salvar uma O.S. não testado, conforme a preferência do projeto de não testar com login.