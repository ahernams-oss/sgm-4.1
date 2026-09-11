# Corrigir falha de carregamento dinâmico

## Objetivo
Eliminar a tela em branco causada pelo carregamento dinâmico das rotas principais e da rota curinga.

## Alterações
- Desativar a divisão automática apenas nas duas rotas que carregam o aplicativo completo (`/` e rota curinga), evitando o módulo intermediário `?tsr-split=component` que está falhando na prévia.
- Manter o carregamento interno sob demanda das páginas do sistema já existente.
- Validar a rota `/compras/requisicoes`, os módulos envolvidos e os registros de erro após a alteração.

## Detalhes técnicos
A aplicação já faz divisão interna das páginas em `App.tsx`. Remover a segunda divisão nas rotas externas evita uma camada redundante e instável sem transformar todas as páginas em um único arquivo.
