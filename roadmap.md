# Tarefas

- [x] Preparar webhook isolado Z-API para recebimento, envio/entrega, leitura e conexão/desconexão; validar origem com segredo compartilhado e registrar somente tipo/status, sem dados pessoais. Dezesseis testes passaram; GET local 200, POST sem configuração bloqueado com 503; build OK. PlugSend preservada.
- [ ] Ativar teste real Z-API: usuário autorizou publicação e proteção antes de mensagens reais; solicitar publicação, depois ZAPI_WEBHOOK_SECRET em formulário seguro com geração/cópia para o painel da Z-API e configurar URLs dos cinco callbacks. Ainda não recebeu eventos reais; não testei com login.
- [ ] Revisar alertas de segurança antes da publicação: verificação rápida concluída com alertas de acesso; análise aprofundada solicitada e em andamento, aguardando resultado para distinguir exposição real de controles complementares. Nenhuma permissão alterada nem publicação solicitada.

- [x] Tratar desconexão da PlugSend como resultado recuperável na consulta de grupos, com aviso visível e sem expor respostas brutas. Reconexão do aparelho depende do responsável pela conta PlugSend; não testei com login.

- [x] Corrigir leitura do número fiscal no XML do faturamento: reconhecer nNFSe nacional, manter NF-e/ABRASF e nunca usar DPS/RPS ou número do arquivo; reanexar atualiza o campo.

- [x] Criar seleção explícita das 16 abas de Funcionários nos perfis; abas não autorizadas não são exibidas/montadas e ações existentes permanecem independentes. 22 testes passaram, tipos e build OK. Perfis existentes precisam marcar as novas opções; controle de abas aplicado na tela, sem mudar RLS. Não testei com login.

- [x] Adicionar marcador visual Cliente, persistido nos usuários e perfis, sem alterar permissões ou clientes liberados; cadastro, edição e duplicação preservam a marcação. Três testes passaram, tipos e build OK; campos conferidos no banco. Não testei com login.

- [x] Corrigir a recusa no download oficial: usar a sessão já validada e a autorização SQL do módulo, sem a ponte legada; leitura da nota continua sujeita às restrições de cliente, conferidas no banco. Dezessete testes passaram, tipos e build OK; falhas de consulta agora têm mensagem própria. Não testei com login nem consultei o PDF real no provedor.

- [x] Tornar o download do PDF oficial das NFS-e visível na grade e preparar arquivo antes do clique de salvar, com compartilhamento em celulares compatíveis e URLs revogadas com atraso para PDF/XML; consulta e permissões preservadas. Dezesseis testes e tipos passaram, build OK; download auxiliar no navegador preservou os bytes. Não testei com login nem baixei nota real nesta verificação.

- [x] Corrigir carregamento de módulo antigo da Operação SMART: recuperar falhas de pré-carregamento antes da barreira React, sem loops ou repetição de gravações; sete testes, tipos e build OK. Navegador confirmou recarga única e abertura sem erros até o login. Não testei com login.

- [x] Criar PMOC › Operação SMART com cartões, etapas por toque, captura/anexo de fotos privadas e observações com salvamento automático; gravação transacional sincroniza execução/O.S. e preserva confirmação/faturamento. Quinze testes passaram e tipos/build sem erros. Sem sessão, celular/tablet redirecionaram ao login sem erros; cartões autenticados, salvamento real e câmera física não verificados. Não testei com login.

- [x] Restringir listas e registros vinculados aos clientes selecionados com políticas restritivas e filtros de cache; impedir bypass por cargo e nas ações fiscais/exclusão de OS. Testes específicos passaram; não testei com login. A suíte geral ainda apresenta falhas antigas de envio e consulta de senhas vazadas.

- [x] Adicionar Benefícios e Insumos em reais, preencher seu trecho na descrição e corrigir Deduções como Valor do serviço − Material aplicado − Benefícios e Insumos; sem emitir notas. Não testei com login.

- [x] Adicionar valores de mão de obra e material abaixo do período de execução, somar no valor do serviço e preencher somente os trechos correspondentes da descrição, inclusive ao trocar de contrato; não emitir notas.

- [x] Adicionar ao contrato o bloco Local de prestação e codigo do serviço abaixo de Texto para NF, com UF, município e códigos nacional/municipal selecionáveis e salvos pelo cadastro existente. Não testei com login.

- [x] Corrigir recuperação de módulo antigo da NFS-e após atualização: nova versão disponível, recarga única por erro e botão de recuperação manual, sem repetir emissão. Não testei com login.

- [x] Adicionar início/fim do período de execução na emissão, preencher o trecho correspondente na descrição e preservar ajustes manuais e texto do contrato; validação e testes incluídos. Não testei com login nem emiti notas.

- [x] Preparar instalação do SGM na tela inicial com nome e ícone Lasant, sem modo offline; metadados, três ícones e login em tamanho de celular conferidos no navegador, sem erros e build OK. Não testei com login nem instalação em aparelho físico.

- [x] Preencher Descrição do Serviço pelo Texto para NF do contrato do tomador selecionado, mantendo edição manual e limpando o texto anterior ao trocar para um contrato sem texto.

- [x] Mostrar o valor calculado da CSLL mesmo sem retenção no formulário, preservando a retenção exclusiva pela seleção explícita; 11 testes passaram e build OK. Não testei com login nem emiti notas; PDF oficial não alterado.

- [ ] Incluir Exclusões e Reduções da Base de Cálculo no DANFSe oficial: bloqueado pela ausência de campo documentado de exclusões IBS/CBS na Brasil NFe. ValorDeducoes é do bloco de serviços/ISS e não pode ser reutilizado como exclusão IBS/CBS sem confirmação fiscal do provedor. Imagem recebida mostra R$ 4.986,59, mas não estabelece a origem do cálculo; nenhum PDF/XML autorizado foi modificado.

- [x] Corrigir retenção para que a opção PIS/COFINS não inclua CSLL: cálculo automático, campo e envio seguem seleção explícita; servidor ignora valores residuais para CSLL não selecionado. Dezenove testes passaram, tipos sem erros e build OK. Não testei com login nem emiti notas; nota 592 autorizada não alterada.

- [x] Corrigir recusa do DANFSe quando Brasil NFe retorna CpfCnpjPrestador nulo no JSON: validar emit/CNPJ no XML autorizado do mesmo retorno, com número fiscal, DPS e ambiente. Nove testes passaram; retorno real da nota 592 validado e PDF oficial conferido visualmente sem cortes ou alterações. Build OK; não testei com login e nenhuma nota reenviada.

- [x] Ligar o download de NFS-e ao DANFSe oficial da Brasil NFe, conforme o modelo enviado, sem emitir ou reenviar notas. Vinte testes passaram, tipos sem erros e build OK; download auxiliar preservou integralmente o PDF do anexo, página única conferida visualmente sem alterações. Não testei com login nem consultei o PDF real de uma nota no provedor; notas antigas sem código de lote recuperável podem exigir identificação pelo provedor.

- [x] Corrigir envio de controles documentados de PIS/COFINS, CSLL e IRRF, com destaque de apuração própria e retenções explícitas, mantendo ISS e INSS. Rejeitar CST/alíquotas/base incompatíveis antes de consumir número. 17 testes passaram e build OK; não testei com login nem emiti/reenviei notas.
- [ ] Enviar percentuais aproximados federal/estadual/municipal exatamente como preenchidos: bloqueado por ausência de campos correspondentes no contrato público Brasil NFe; requer suporte documentado do provedor, sem inventar parâmetros ou modificar XML autorizado. Confirmação dos controles federais no XML de nova emissão permanece não verificada.

- [x] Resolver série após E0010: usuário autorizou série 30000 para Produção, dentro da faixa de aplicativo próprio. Configuração alterada, início 539 preservado; nenhuma nota reenviada. Não testei com login nem emissão real.

- [x] Configurar Produção com série 70000 e início 539 sem reutilizar números; próximo número 539 confirmado no banco, gatilho respeita configuração e números existentes. Corrigidas exibição na tela/PDF e gravação de retornos sem horário; 20 testes passaram e build OK. Não testei com login nem emiti notas.

- [x] Adicionar seletor Homologação / Produção na NFS-e, com autorização existente de emissão, confirmação para Produção e persistência da configuração; 17 testes passaram e build OK. Página sem sessão redireciona ao login sem erros. Não testei com login, não verifiquei a gravação autenticada e nenhuma nota foi emitida.

- [x] Recuperar o ISS cadastrado no contrato na emissão de NFS-e; contrato único selecionado automaticamente, demais disponíveis na lista do tomador; decimais e zero preservados, padrão restaurado quando não há ISS. Quatro testes passaram; build OK. Não testei com login e nenhuma nota emitida.

- [x] Exibir os quatro submenus de Faturamento em Perfis de Acesso usando as chaves existentes, preservando as restrições de acesso; quatro testes passaram. Não testei com login.

- [x] Bloquear Usuários e Perfis de Acesso para Coordenadores Técnico/Administrativo Lasant e Gerente Executivo; exigir permissões explícitas de perfil para os itens Gerencial, sem liberação automática por cargo; regras compartilhadas no navegador/servidor e migração dos validadores SQL aplicadas. Quatorze testes passaram; regras SQL conferidas para os cargos e módulos; build OK. Não testei com login.

- [x] Adicionar dashboard no cadastro I0 com totais por tabela, mês e ano, usando todos os registros carregados e preservando o cadastro na aba Registros. Quatro testes passaram; filtros, totais e consulta por período conferidos visualmente com dados de teste; build OK. Não testei com login.

- [x] Adicionar Baixar PDF na grade e nos detalhes para notas emitidas/canceladas; representação local identificada como distinta do DANFSe oficial, número fiscal extraído do XML sem confundir com DPS. Doze testes passaram e build OK. PDF normal e duas páginas de descrição longa conferidos visualmente, sem cortes ou sobreposição. Não testei com login e nenhuma nota emitida.

- [x] Ajustar a data de emissão da DPS ao formato YYYY-MM-DD documentado pela Brasil NFe e ao dia de São Paulo, sem avanço na virada UTC; competência explícita preservada. Quinze testes passaram e build OK. Não testei com login; nenhuma nota reenviada e emissão real não verificada.

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