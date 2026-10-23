# Vindex Hub — protótipo

Centro de operações de marketing e conteúdo da Vindex. Esta versão é um **protótipo navegável com dados fictícios**: dá para clicar em tudo, mas não há login, banco de dados nem upload real. O plano para virar sistema de verdade está em [ARQUITETURA.md](ARQUITETURA.md).

## Como abrir (Windows)

1. Abra a pasta `vindex-hub`.
2. Dê **dois cliques** em `iniciar.bat`.
3. Vai abrir uma janela preta e, em seguida, o navegador em `http://localhost:8080`.
4. **Deixe a janela preta aberta** enquanto usa o Hub. Para encerrar, é só fechar essa janela.

Se o navegador não abrir sozinho, digite `localhost:8080` na barra de endereço.

> Precisa ter o Python instalado (já está neste computador). Abrir o `index.html` direto com dois cliques também funciona, mas pelo `iniciar.bat` é o jeito recomendado.

## O que tem em cada tela

| Tela | Para que serve |
|---|---|
| **Dashboard** | Resumo do dia: produção da semana, pendências, tarefas atrasadas, aprovações e próximos prazos |
| **Produção** | Kanban com as 10 etapas (Pauta → Publicado). Arraste os cards ou clique para editar |
| **Central de aprovação** | Ver roteiro e vídeo, comentar, aprovar ou pedir ajustes |
| **Calendário editorial** | Conteúdos por data de publicação, em visão de mês ou lista |
| **Tarefas** | Responsável, prazo, prioridade, status e o marcador "Depende da CEO" |
| **Área de clientes** | Como o cliente vê a biblioteca de vídeos e materiais |

## Dicas para a apresentação

- No topo, **Visualizar como** troca entre **Equipe**, **CEO** e **Cliente**. Isso é só demonstração, não é login.
- Para mostrar uma aprovação: mude para **CEO**, abra a **Central de aprovação** e clique em **Aprovar**. O primeiro conteúdo da fila tem o vídeo institucional da Vindex.
- Como **Equipe**, o botão de aprovar fica bloqueado: só a CEO aprova.
- Como **Cliente**, a tela muda inteira: o cliente não vê nada da operação interna.
- Clique na etiqueta amarela **Protótipo · dados fictícios** para ver o que é real e para **restaurar os dados de exemplo** depois de testar.

## O que é real e o que não é

- As alterações (mover cards, aprovar, comentar, criar tarefas) ficam salvas **só no navegador onde foram feitas**. Outra pessoa não vê.
- Todos os nomes, empresas e números são **fictícios**.
- Não há nenhuma senha ou chave secreta no código.

## Arquivos

```
vindex-hub/
  index.html            página principal
  iniciar.bat           abre o Hub no navegador
  ARQUITETURA.md        arquitetura e plano para o sistema real
  assets/css/app.css    visual (cores, fontes, componentes)
  assets/js/data.js     dados fictícios
  assets/js/app.js      telas e interações
  assets/img/           logos da Vindex
  assets/media/         vídeo institucional usado como exemplo
```
