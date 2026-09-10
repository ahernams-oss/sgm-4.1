# Busca de fornecedores nas cotações

## Objetivo
Substituir a lista simples por um seletor pesquisável, mais rápido e organizado.

## Alterações
- Criar um campo reutilizável de fornecedor com pesquisa por razão social, nome fantasia, CNPJ e código.
- Ignorar acentos, maiúsculas e pontuação do CNPJ durante a busca.
- Mostrar identificação complementar nos resultados e destacar a opção escolhida.
- Manter fornecedores suspensos e fornecedores que já enviaram proposta fora da lista.
- Aplicar a mesma melhoria ao envio individual da cotação.
- Exibir mensagens claras quando não houver resultados ou fornecedores disponíveis.

## Validação
- Conferir seleção, busca, limpeza e fechamento pelo teclado e mouse.
- Verificar a tela em desktop e celular e confirmar que o projeto continua sem erros.

## Detalhes técnicos
- Reutilizar os controles visuais existentes (`Popover` e `Command`) e os dados já carregados, sem alterar banco de dados ou regras de suspensão.
