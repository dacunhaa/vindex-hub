# Vindex Hub — Arquitetura e plano de implementação

Este documento explica **o que existe hoje** (o protótipo) e **o que precisa ser construído** para o Vindex Hub virar um sistema real, com login, banco de dados, upload de vídeos, aprovações registradas e uma área de clientes segura.

---

## 1. O que é protótipo e o que é real

| Parte | No protótipo (hoje) | No sistema real |
|---|---|---|
| Telas e navegação | Funcionam de verdade | Mesmas telas, reaproveitadas |
| Dados (conteúdos, tarefas) | Fictícios, gerados no navegador | Banco de dados na nuvem |
| Salvar alterações | Só **neste navegador** (localStorage). Outra pessoa não vê | Salvo no servidor, todos veem na hora |
| "Visualizar como" Equipe / CEO / Cliente | Um seletor de demonstração. **Não é login** e não protege nada | Login individual com senha e verificação em duas etapas |
| Aprovar / pedir ajustes | Muda o status só na sua tela | Registro permanente com quem aprovou, quando e qual versão |
| Vídeo | Um vídeo institucional de exemplo incluído no projeto. Outros arquivos só podem ser **pré-visualizados** no seu computador, nada é enviado | Upload para armazenamento privado com link temporário |
| Área de clientes | Demonstrativa, materiais não baixam | Cada cliente só vê o que foi liberado para ele |
| Notificações | Não existem | E-mail e aviso dentro do sistema |

O protótipo **não tem nenhuma chave, senha ou credencial** no código. Ele é um site estático (HTML, CSS e JavaScript) que não conversa com nenhum servidor.

---

## 2. Arquitetura recomendada

```
 Navegador (equipe, CEO, clientes)
        │  HTTPS
        ▼
 ┌──────────────────────────────┐
 │  Aplicação web (Next.js)      │  hospedada na Vercel
 │  - páginas do Hub             │
 │  - rotas de servidor (API)    │  ← única parte que guarda chaves secretas
 └──────────┬───────────────────┘
            │
   ┌────────┼─────────────────────────────┐
   ▼        ▼                             ▼
 Supabase Auth   Supabase Postgres      Armazenamento de arquivos
 (login, MFA,    (dados + regras de     - Supabase Storage (roteiros, imagens,
  convites)       acesso por linha/RLS)    vídeos brutos para revisão)
                                         - Mux ou Cloudflare Stream (vídeos da
                                           área de clientes, com streaming)
            │
            ▼
 Resend (e-mails: "tem conteúdo esperando sua aprovação")
```

**Por que essa combinação**

- **Next.js** é o padrão de mercado para aplicações web modernas. As telas do protótipo são reescritas como componentes, sem mudar o visual.
- **Supabase** junta banco de dados (Postgres), login e armazenamento num só serviço, com regras de segurança aplicadas **dentro do banco** (Row Level Security). Mesmo que alguém mexa na tela, o banco recusa o que a pessoa não pode ver.
- **Vercel** publica o site com HTTPS automático e um ambiente de teste para cada mudança.
- **Mux / Cloudflare Stream** entregam vídeo com qualidade adaptada à internet de quem assiste e links que expiram, o que é importante para material exclusivo de clientes.

Alternativas equivalentes: Firebase (Google) ou AWS (Cognito + RDS + S3). A recomendação acima é a que exige menos manutenção para uma equipe pequena.

---

## 3. Perfis e permissões

Existem dois "mundos" separados: a **operação interna da Vindex** e o **portal de cada cliente**.

| Perfil | Quem é | Pode |
|---|---|---|
| `admin` | Responsável técnico / gestor do Hub | Tudo, inclusive convidar pessoas e mudar perfis |
| `ceo` | Diretoria | Ver tudo da operação, **aprovar** ou pedir ajustes, comentar, ver tarefas que dependem dela |
| `equipe` | Marketing, roteiro, edição, social | Criar e mover conteúdos, subir arquivos, criar tarefas, comentar. **Não aprova** a própria entrega |
| `cliente` | Usuário de uma empresa atendida | Só o portal: vídeos e materiais liberados para **a empresa dele**. Nunca vê a operação interna nem outros clientes |

Regras importantes:

1. **Sem cadastro aberto.** Ninguém cria conta sozinho. Pessoas entram por convite enviado pelo `admin`.
2. **Cliente é sempre vinculado a uma empresa** (`organization`). Toda consulta do portal é filtrada pela empresa no banco, não na tela.
3. **Equipe interna usa verificação em duas etapas** (aplicativo autenticador).
4. A tela esconder um botão é só conforto visual. **A proteção de verdade fica no banco e no servidor.**

---

## 4. Modelo de dados (tabelas principais)

```
organizations      id, nome, tipo ('interna' | 'cliente'), criado_em
profiles           id (= usuário do Auth), nome, papel, organization_id, avatar
contents           id, titulo, formato, canal, etapa, responsavel_id,
                   prazo_etapa, data_publicacao, pilar, prioridade, criado_por
content_versions   id, content_id, numero, roteiro (texto), legenda, criado_por, criado_em
media_assets       id, content_id, version_id, tipo, caminho_storage, tamanho,
                   duracao, status_processamento, enviado_por
approvals          id, content_id, version_id, decisao ('aprovado' | 'ajustes'),
                   decidido_por, decidido_em, observacao          ← nunca é apagado
comments           id, content_id, version_id, autor_id, texto, minuto_do_video, criado_em
tasks              id, titulo, descricao, responsavel_id, prazo, prioridade, status,
                   depende_ceo (sim/não), content_id (opcional)
stage_history      id, content_id, de, para, por, em
library_items      id, titulo, tipo ('video' | 'material'), categoria, caminho/arquivo,
                   publicado (sim/não)
library_access     library_item_id, organization_id     ← o que cada cliente pode ver
audit_log          id, quem, acao, alvo, quando, ip
```

As 10 etapas do Kanban (Pauta → Publicado) ficam numa lista fixa no banco (`enum`), assim nenhum conteúdo cai numa etapa inexistente.

---

## 5. Segurança: como cada parte é protegida

### 5.1 Login (autenticação)
- Supabase Auth com e-mail + senha forte, ou link mágico por e-mail.
- MFA obrigatório para `admin`, `ceo` e `equipe`.
- Sessão guardada em cookie seguro (`HttpOnly`, `Secure`, `SameSite`), não acessível por scripts.
- Bloqueio após tentativas erradas e registro de acessos no `audit_log`.

### 5.2 Permissões no banco (RLS)
Exemplo das regras, em linguagem do banco:

```sql
-- Equipe interna e CEO veem todos os conteúdos
create policy "interno le conteudos" on contents for select
  using ( exists (select 1 from profiles p
                  where p.id = auth.uid() and p.papel in ('admin','ceo','equipe')) );

-- Só CEO ou admin registram aprovação
create policy "ceo aprova" on approvals for insert
  with check ( exists (select 1 from profiles p
                       where p.id = auth.uid() and p.papel in ('admin','ceo')) );

-- Cliente só vê itens liberados para a empresa dele
create policy "cliente le biblioteca" on library_items for select
  using ( publicado and exists (
            select 1 from library_access a join profiles p
              on p.organization_id = a.organization_id
            where a.library_item_id = library_items.id and p.id = auth.uid()) );
```

Clientes simplesmente **não têm nenhuma regra** que libere `contents`, `tasks`, `comments` ou `approvals`. Para eles essas tabelas aparecem vazias.

### 5.3 Chaves e segredos
- O navegador recebe apenas a chave **pública** do Supabase (feita para ser pública; quem protege os dados é o RLS).
- A chave de serviço do Supabase, as chaves do Mux e do Resend ficam **só no servidor**, em variáveis de ambiente da Vercel. Nunca no código do navegador nem no repositório.
- Arquivo `.env.local` fica fora do controle de versão (`.gitignore`).

### 5.4 Arquivos e vídeos
- Buckets **privados**. Nada tem link público permanente.
- Para enviar: o servidor confere a permissão e devolve um **link de envio assinado** de uso único. O navegador envia o arquivo direto para o armazenamento (sem passar pelo servidor), com upload retomável para vídeos grandes.
- Para assistir: o servidor gera um **link temporário** (ex.: 1 hora) só para quem tem permissão.
- Limites de tipo (mp4, mov, pdf, png, jpg, xlsx) e tamanho (ex.: 2 GB por vídeo).

### 5.5 LGPD
- Dados pessoais mínimos (nome, e-mail, empresa).
- Registro de consentimento no primeiro acesso de clientes.
- Possibilidade de exportar e excluir dados de um usuário.
- Backups diários do banco (incluídos no plano pago do Supabase).

---

## 6. Como funciona a aprovação no sistema real

```
Em edição ──(equipe envia versão + vídeo)──► Aguardando aprovação
                                                 │
                         ┌───────────────────────┴──────────────────┐
                         ▼                                          ▼
                    CEO aprova                              CEO pede ajustes
              (registro em approvals)                (comentário obrigatório)
                         │                                          │
                         ▼                                          ▼
                     Aprovado ──► Agendado ──► Publicado     Ajustes solicitados
                                                                    │
                                                    equipe sobe nova versão (v2)
                                                                    │
                                                                    ▼
                                                          Aguardando aprovação
```

- Cada aprovação fica presa a **uma versão específica**. Se o vídeo mudar depois de aprovado, volta para aprovação.
- Comentários podem marcar o minuto do vídeo ("aos 0:42, trocar a legenda").
- A CEO recebe um e-mail resumido por dia com o que espera por ela, em vez de um e-mail por item.

---

## 7. Plano de implementação em fases

Cada fase termina com algo que já pode ser usado.

| Fase | Entrega | O que envolve | Duração estimada* |
|---|---|---|---|
| 0. Fundação | Projeto Next.js + Supabase + Vercel no ar | Criar contas, repositório, ambientes de teste e produção, migrar o visual do protótipo | 1 semana |
| 1. Login e perfis | Equipe e CEO entram com conta própria | Convites, MFA, perfis, menu muda conforme o papel, regras RLS básicas | 1 semana |
| 2. Dados reais | Kanban, calendário e tarefas salvando no banco | Tabelas, telas lendo e gravando no banco, histórico de etapas, atualização em tempo real | 2 semanas |
| 3. Arquivos e vídeos | Subir roteiro, imagens e vídeos para revisão | Buckets privados, upload retomável, links temporários, player | 1–2 semanas |
| 4. Aprovações | Central de aprovação oficial | Versões, aprovações registradas, comentários por minuto, e-mails | 1–2 semanas |
| 5. Área de clientes | Portal com vídeos e materiais | Empresas clientes, convites, biblioteca por cliente, streaming (Mux/Cloudflare) | 2 semanas |
| 6. Revisão de segurança | Pronto para clientes externos | Testes de permissão (cliente tentando ver dado interno), backups, LGPD, monitoramento de erros | 1 semana |

\* Estimativa para 1 desenvolvedor experiente em tempo integral. Total aproximado de 9 a 11 semanas.

### Custos mensais aproximados (confirmar valores atuais antes de contratar)
- Supabase: plano gratuito para testes; plano Pro (~US$ 25/mês) em produção, com backups.
- Vercel: gratuito para começar; plano Pro (~US$ 20/mês por pessoa que publica).
- Vídeo para clientes (Mux ou Cloudflare Stream): cobrança por minutos armazenados e assistidos; para uma biblioteca pequena, poucas dezenas de dólares por mês.
- Resend (e-mails): gratuito até alguns milhares de e-mails por mês.

---

## 8. Do protótipo para o sistema real: o que é reaproveitado

| Arquivo do protótipo | Vira |
|---|---|
| `assets/css/app.css` | Base do tema visual (cores, fontes, componentes) |
| `assets/js/data.js` | Dados de exemplo para o ambiente de teste (seed do banco) |
| Cada tela em `assets/js/app.js` | Uma página do Next.js |
| `state` em memória / localStorage | Consultas ao Supabase |
| Seletor "Visualizar como" | **Removido.** O perfil passa a vir do login |

---

## 9. Próximos passos sugeridos

1. Apresentar o protótipo e validar as telas e etapas com a CEO.
2. Decidir quem será o responsável técnico (interno ou freelancer/agência).
3. Criar as contas (Supabase, Vercel) **no nome da Vindex**, não de uma pessoa.
4. Começar pela Fase 0 e Fase 1 e usar o Hub internamente antes de abrir para clientes.
