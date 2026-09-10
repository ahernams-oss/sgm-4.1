# Observações nas fotos das Ordens de Serviço

## Objetivo
Permitir uma observação opcional, com até 200 caracteres, em cada foto anexada à Ordem de Serviço e exibi-la abaixo da respectiva imagem no Relatório Fotográfico.

## Alterações
- Incluir o campo de observação no registro de cada foto, mantendo compatibilidade com fotos já salvas.
- Adicionar um campo de texto e contador de caracteres abaixo de cada foto na edição da Ordem de Serviço.
- Limitar a entrada a 200 caracteres e validar o limite antes de salvar.
- Mostrar a observação também na visualização da Ordem de Serviço.
- Reservar espaço abaixo de cada imagem no PDF e quebrar páginas corretamente quando houver observações.
- Manter o funcionamento nos formatos Retrato e Paisagem.

## Detalhes técnicos
- A observação será persistida dentro do JSON já usado pela coluna `fotos` da Ordem de Serviço; nenhuma alteração no banco será necessária.
- Fotos antigas, sem observação, continuarão funcionando normalmente.
- A geração do PDF considerará a altura da legenda ao calcular a grade e a paginação.

## Validação
- Verificar compilação e erros da prévia.
- Testar cadastro/edição com observações curtas e com o limite de 200 caracteres.
- Confirmar a associação correta entre foto e observação no relatório.
