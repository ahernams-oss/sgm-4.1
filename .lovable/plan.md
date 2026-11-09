# PMOC — Operação SMART

## Nova tela
- Adicionar **Operação SMART** ao menu PMOC, mantendo as telas atuais.
- Usar cartões inspirados na segunda imagem: equipamento, serviço, cliente, local/setor, periodicidade, prazo, responsável e quantidade de fotos.
- No tablet/computador, apresentar colunas por etapa; no celular, abas por etapa e cartões em uma coluna, com botões grandes.
- Incluir busca e filtros de cliente, local e periodicidade, respeitando os clientes autorizados.

## Manutenção por toque
- Mostrar atividades disponíveis e permitir **Iniciar**, **Continuar manutenção** e **Enviar para confirmação**.
- Salvar o início da manutenção imediatamente, permitindo fechar e retomar depois.
- Dentro da manutenção, exibir os dados do equipamento, observações e fotos; observações são salvas automaticamente após uma breve pausa na digitação.
- Mostrar estados claros de salvamento, sucesso e falha, com opção de tentar novamente; não indicar sucesso antes da gravação.
- Ao finalizar, encaminhar ao fluxo atual de confirmação. A confirmação continua dependendo da permissão existente, e os valores não aparecem para o técnico.

## Fotos pelo celular
- Disponibilizar **Tirar foto** e **Anexar fotos**, com miniaturas e envio automático após a captura/seleção.
- Preservar os limites atuais de seis fotos e oito MB por foto.
- Gravar as fotos em armazenamento privado e recuperá-las com acesso autenticado.
- Impedir finalização enquanto houver envio ou alteração não salva; manter fotos e observações ao retomar a manutenção.

## Detalhes técnicos
- Reutilizar atividades, equipamentos, execuções e ordens PMOC existentes; adicionar o estado **Em execução** ao fluxo sem tratá-lo como manutenção pendente de confirmação.
- Fazer gravações autenticadas com validação de permissão e cliente no servidor; evitar ordens/execuções duplicadas em cliques repetidos e sincronizar execução e O.S. no banco.
- Reutilizar a confirmação atual e o gatilho de faturamento somente após **Confirmada**, sem alterar preços ou gerar cobrança ao iniciar.
- Permitir atividades gerais do plano nos equipamentos vinculados, preservando as regras de periodicidade existentes.
- Reutilizar permissões PMOC existentes, sem liberar acesso a outros clientes.

## Verificação
- Testar transições, salvamento, limites de fotos, cliente autorizado e prevenção de duplicidade.
- Conferir a apresentação em celular e tablet sem alterar as telas atuais.
- Não realizar login no Supabase externo; informar que o fluxo autenticado e a câmera em aparelho físico não foram testados.