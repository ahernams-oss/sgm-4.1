# Editor do e-mail de assinatura

## Objetivo
Permitir editar, salvar e visualizar o e-mail que envia o código de assinatura eletrônica.

## Alterações
- Criar uma página “E-mail de assinatura” acessível pelo menu de Cadastros.
- Disponibilizar edição do assunto, nome da empresa, subtítulo, mensagem principal, validade, aviso de segurança e rodapé.
- Mostrar uma pré-visualização ao lado usando dados de exemplo, preservando automaticamente nome, documento, função e código reais nos envios.
- Incluir ações para salvar e restaurar o texto padrão.
- Armazenar a configuração no banco para que seja compartilhada entre usuários autorizados.
- Aplicar o conteúdo salvo ao envio real do código de assinatura.

## Segurança e acesso
- Permitir leitura somente a usuários autenticados.
- Permitir alteração somente a usuários com acesso total ou permissão de edição dos dados da empresa.
- Manter o código, destinatário e demais dados dinâmicos protegidos e não editáveis no modelo.

## Validação
- Confirmar funcionamento em computador e celular.
- Confirmar que a página não apresenta sobreposição com o menu lateral.
- Confirmar que o projeto continua compilando sem erros.
