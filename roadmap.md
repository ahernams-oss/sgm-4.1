# Tarefas

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