# Vindex Hub

Centro de operações de marketing e conteúdo da Vindex: produção (Kanban), aprovação da CEO, calendário editorial, tarefas e área de clientes.

**Endereço:** https://dacunhaa.github.io/vindex-hub/
**Demonstração com dados fictícios:** https://dacunhaa.github.io/vindex-hub/demo/

## Como entrar

1. Abra o endereço acima.
2. Clique em **Entrar com Google**.
3. Use exatamente o e-mail que foi cadastrado na tela **Acessos**.

Quem não está cadastrado vê a mensagem "Acesso não liberado".

## Perfis

| Perfil | Pode |
|---|---|
| **CEO** | Ver tudo, aprovar ou pedir ajustes, comentar, gerenciar acessos |
| **Administrador** | Tudo da equipe + gerenciar acessos |
| **Equipe** | Criar e mover conteúdos, tarefas e itens da biblioteca, comentar |
| **Cliente** | Só a área do cliente: vídeos e materiais marcados como publicados |

## Como dar acesso a alguém (equipe ou cliente)

1. Entre como CEO ou Administrador.
2. Menu **Acessos** → **Adicionar pessoa**.
3. Preencha nome, e-mail da conta Google e perfil → **Liberar acesso**.
4. Mande o endereço do Hub para a pessoa. Ela entra com "Entrar com Google".

Para tirar o acesso: botão **Bloquear** na mesma tela.

## Imagens (carrossel, post)

Abra o conteúdo e use **Adicionar imagens**. Dá para escolher várias de uma vez. A ordem segue o nome do arquivo (slide_1, slide_2…). O Hub reduz cada imagem para caber no banco gratuito, e a CEO vê os slides na Central de aprovação. Para ver em tamanho grande, basta clicar na imagem.

## Vídeos

Por enquanto o Hub não guarda arquivos de vídeo. Suba o vídeo no **Google Drive** (compartilhado como "Qualquer pessoa com o link") ou no **YouTube como "não listado"** e cole o link no campo **Link do vídeo** do conteúdo. Ele toca dentro do Hub.

## Onde ficam os dados

No Firebase (Google), projeto **vindex-hub**, conta danyellevieiracc04@gmail.com. As regras de segurança estão no arquivo `firestore.rules` e também publicadas no Firebase. Detalhes técnicos em [ARQUITETURA.md](ARQUITETURA.md).
