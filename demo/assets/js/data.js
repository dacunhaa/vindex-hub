/*
  Vindex Hub — dados FICTÍCIOS de demonstração.
  Nenhum nome, número ou empresa aqui é real. As datas são relativas ao dia de hoje
  (d = dias a partir de hoje), para o protótipo sempre parecer atual.
  No sistema real, este arquivo vira o "seed" do banco de testes.
*/
window.VINDEX_SEED = (function () {
  const STAGES = [
    { id: 'pauta', label: 'Pauta' },
    { id: 'roteiro', label: 'Roteiro' },
    { id: 'aguardando_gravacao', label: 'Aguardando gravação' },
    { id: 'gravado', label: 'Gravado' },
    { id: 'em_edicao', label: 'Em edição' },
    { id: 'aguardando_aprovacao', label: 'Aguardando aprovação' },
    { id: 'ajustes', label: 'Ajustes solicitados' },
    { id: 'aprovado', label: 'Aprovado' },
    { id: 'agendado', label: 'Agendado' },
    { id: 'publicado', label: 'Publicado' }
  ];

  const PEOPLE = [
    { id: 'ceo', name: 'Diretoria', role: 'CEO', initials: 'CEO', color: '#0A0F1F' },
    { id: 'marina', name: 'Marina Duarte', role: 'Estratégia e roteiro', initials: 'MD', color: '#1F56FF' },
    { id: 'rafael', name: 'Rafael Souto', role: 'Edição de vídeo', initials: 'RS', color: '#6B4CE6' },
    { id: 'julia', name: 'Júlia Prado', role: 'Social media', initials: 'JP', color: '#0E9F8A' },
    { id: 'bruno', name: 'Bruno Teles', role: 'Gravação e design', initials: 'BT', color: '#C9721C' }
  ];

  const FORMATS = ['Reels', 'Carrossel', 'Vídeo YouTube', 'Stories', 'Post LinkedIn'];
  const CHANNELS = ['Instagram', 'YouTube', 'LinkedIn', 'TikTok'];

  const S = (t) => t.trim().split('\n').map((l) => l.trim()).join('\n');

  const CONTENTS = [
    {
      id: 'C-101', title: 'Faturou muito e o lucro sumiu? Os 4 ralos do e-commerce',
      format: 'Reels', channel: 'Instagram', stage: 'aguardando_aprovacao', owner: 'marina',
      due: 0, publish: 3, pillar: 'Lucro', video: 'assets/media/video_institucional.mp4', version: 2,
      script: S(`GANCHO (0-3s): Você vendeu R$ 300 mil no mês. Quanto sobrou?
      CONTEXTO: Muito lojista olha só o faturamento. Mas entre vender e lucrar existem quatro ralos.
      1. Taxas de marketplace e gateway que ninguém soma.
      2. Frete grátis que sai do seu bolso.
      3. Devoluções e chargebacks.
      4. Imposto calculado errado na precificação.
      VIRADA: Quando o financeiro está organizado, cada ralo vira um número na tela.
      CTA: Comenta "LUCRO" que a gente te manda o checklist dos 4 ralos.`),
      comments: [
        { by: 'marina', d: -2, text: 'Versão 2 com o gancho mais curto, como combinado.' },
        { by: 'rafael', d: -1, text: 'Legendas revisadas. Vídeo exportado em 1080x1920.' }
      ]
    },
    {
      id: 'C-102', title: 'Quanto o marketplace realmente leva da sua venda',
      format: 'Carrossel', channel: 'Instagram', stage: 'aguardando_aprovacao', owner: 'julia',
      due: -1, publish: 2, pillar: 'Marketplaces', version: 1,
      script: S(`CAPA: R$ 100 vendidos no marketplace. Quanto chega na sua conta?
      SLIDE 2: Comissão da categoria (exemplo: 14%).
      SLIDE 3: Tarifa fixa por item abaixo do valor mínimo.
      SLIDE 4: Frete subsidiado pelo vendedor.
      SLIDE 5: Taxa de antecipação, se você antecipa.
      SLIDE 6: Resultado do exemplo: dos R$ 100, sobram R$ 71 antes do produto e do imposto.
      SLIDE 7: A Vindex concilia cada repasse para você saber o número real.
      CTA: Salve para conferir no fechamento do mês.`),
      comments: [{ by: 'julia', d: -1, text: 'Valores do exemplo são ilustrativos, sem dado de cliente.' }]
    },
    {
      id: 'C-103', title: 'ROAS bonito, lucro feio: o erro de olhar só o anúncio',
      format: 'Reels', channel: 'Instagram', stage: 'aguardando_aprovacao', owner: 'marina',
      due: 1, publish: 5, pillar: 'Lucro', version: 1,
      script: S(`GANCHO: Seu ROAS é 8. Parabéns. Agora desconta o resto.
      PONTO 1: ROAS mede receita sobre anúncio, não lucro.
      PONTO 2: Some custo do produto, taxas, frete e imposto.
      PONTO 3: O número que importa é a margem de contribuição depois do anúncio.
      CTA: Quer calcular o seu? Link na bio.`),
      comments: []
    },
    {
      id: 'C-104', title: 'DRE de e-commerce explicado em 3 minutos',
      format: 'Vídeo YouTube', channel: 'YouTube', stage: 'ajustes', owner: 'rafael',
      due: 0, publish: 6, pillar: 'Gestão', version: 2,
      script: S(`ABERTURA: O que é DRE e por que ele responde "estou ganhando dinheiro?".
      BLOCO 1: Receita bruta, deduções e receita líquida.
      BLOCO 2: Custo da mercadoria vendida.
      BLOCO 3: Despesas variáveis do e-commerce (taxas, frete, mídia).
      BLOCO 4: Despesas fixas e resultado.
      FECHAMENTO: Mostrar um DRE fictício preenchido.`),
      comments: [
        { by: 'ceo', d: -1, text: 'Aos 1:20 o gráfico passa rápido demais. Deixar 2 segundos a mais e trocar "lucro bruto" por "margem bruta".', decision: 'ajustes' },
        { by: 'rafael', d: 0, text: 'Ajustando hoje à tarde.' }
      ]
    },
    {
      id: 'C-105', title: 'Frete grátis: estratégia de venda ou prejuízo escondido?',
      format: 'Reels', channel: 'TikTok', stage: 'em_edicao', owner: 'rafael',
      due: 1, publish: 7, pillar: 'Lucro', version: 1,
      script: S(`GANCHO: Frete grátis não existe. Alguém paga.
      DESENVOLVIMENTO: Como calcular o frete médio por pedido e embutir no preço.
      CTA: Comenta "FRETE" que mandamos a planilha modelo.`),
      comments: []
    },
    {
      id: 'C-106', title: 'Fluxo de caixa para a Black Friday: prepare o caixa antes da venda',
      format: 'Reels', channel: 'Instagram', stage: 'gravado', owner: 'bruno',
      due: 2, publish: 9, pillar: 'Fluxo de caixa',
      script: S(`GANCHO: A Black Friday pode quebrar quem vende bem.
      PONTO 1: Estoque é pago antes, o repasse chega depois.
      PONTO 2: Simule o caixa semana a semana até janeiro.
      PONTO 3: Defina um limite de antecipação.
      CTA: Salve e mande para o seu sócio.`),
      comments: []
    },
    {
      id: 'C-107', title: 'Conciliação de repasses: por que o saldo nunca bate',
      format: 'Vídeo YouTube', channel: 'YouTube', stage: 'aguardando_gravacao', owner: 'bruno',
      due: -2, publish: 12, pillar: 'Gestão',
      script: S(`ROTEIRO: Explicar a diferença entre venda, repasse previsto e repasse recebido.
      Mostrar os motivos mais comuns de diferença: estornos, taxas retroativas, frete.
      Mostrar como a conciliação diária evita surpresas no fim do mês.`),
      comments: []
    },
    {
      id: 'C-108', title: 'Margem de contribuição por produto: descubra quem dá lucro',
      format: 'Carrossel', channel: 'Instagram', stage: 'roteiro', owner: 'marina',
      due: 1, publish: 10, pillar: 'Lucro',
      script: S(`ESBOÇO: 6 slides. Fórmula simples. Exemplo com 3 produtos fictícios.
      Mensagem central: nem todo produto que vende muito dá lucro.`),
      comments: []
    },
    {
      id: 'C-109', title: 'Precificação com imposto: o erro de quem está no Simples',
      format: 'Carrossel', channel: 'Instagram', stage: 'roteiro', owner: 'marina',
      due: 3, publish: 13, pillar: 'Impostos',
      script: S(`ESBOÇO: Mostrar que a alíquota muda com a faixa de faturamento.
      Exemplo de preço calculado com alíquota antiga versus atual.`),
      comments: []
    },
    {
      id: 'C-110', title: 'Antecipação de recebíveis: quando vale a pena',
      format: 'Reels', channel: 'Instagram', stage: 'pauta', owner: 'julia',
      due: 4, publish: 16, pillar: 'Fluxo de caixa', script: '', comments: []
    },
    {
      id: 'C-111', title: 'Chargeback: o custo que não aparece no painel de vendas',
      format: 'Stories', channel: 'Instagram', stage: 'pauta', owner: 'julia',
      due: 5, publish: 15, pillar: 'Gestão', script: '', comments: []
    },
    {
      id: 'C-112', title: 'Devolução e logística reversa: quanto custa cada troca',
      format: 'Carrossel', channel: 'Instagram', stage: 'pauta', owner: 'marina',
      due: 6, publish: 19, pillar: 'Lucro', script: '', comments: []
    },
    {
      id: 'C-113', title: '3 sinais de que seu financeiro precisa de ajuda especializada',
      format: 'Post LinkedIn', channel: 'LinkedIn', stage: 'aprovado', owner: 'julia',
      due: 1, publish: 1, pillar: 'Institucional', version: 1,
      script: S(`TEXTO: 1. Você não sabe o lucro do mês passado. 2. O saldo do banco não bate com o painel.
      3. Decisões de estoque e mídia são feitas no escuro. Entre vender e lucrar, existe a Vindex.`),
      comments: [{ by: 'ceo', d: -1, text: 'Aprovado. Bom texto.', decision: 'aprovado' }]
    },
    {
      id: 'C-114', title: 'Mito: "vendi muito, então lucrei"',
      format: 'Reels', channel: 'Instagram', stage: 'agendado', owner: 'julia',
      due: 0, publish: 0, pillar: 'Lucro', version: 1,
      script: S(`GANCHO: Vender muito e lucrar são coisas diferentes.
      Exemplo fictício de duas lojas com o mesmo faturamento e lucros opostos.`),
      comments: [{ by: 'ceo', d: -3, text: 'Aprovado.', decision: 'aprovado' }]
    },
    {
      id: 'C-115', title: 'Calendário fiscal de novembro para lojistas',
      format: 'Stories', channel: 'Instagram', stage: 'agendado', owner: 'julia',
      due: 2, publish: 2, pillar: 'Impostos', version: 1, script: 'Sequência de 5 stories com as datas de impostos do mês.', comments: []
    },
    {
      id: 'C-116', title: 'Bastidores: como fechamos o mês de um e-commerce',
      format: 'Reels', channel: 'Instagram', stage: 'publicado', owner: 'rafael',
      due: -3, publish: -2, pillar: 'Institucional', version: 1, script: 'Bastidores da rotina de fechamento, sem mostrar dados de clientes.', comments: []
    },
    {
      id: 'C-117', title: 'Vindex, o financeiro do seu e-commerce (vídeo institucional)',
      format: 'Reels', channel: 'Instagram', stage: 'publicado', owner: 'marina',
      due: -6, publish: -5, pillar: 'Institucional', video: 'assets/media/video_institucional.mp4', version: 3,
      script: 'Entre vender e lucrar, existe a Vindex.', comments: []
    },
    {
      id: 'C-118', title: 'Taxa de gateway: compare antes de assinar',
      format: 'Carrossel', channel: 'Instagram', stage: 'publicado', owner: 'julia',
      due: -4, publish: -1, pillar: 'Marketplaces', version: 1, script: 'Comparativo ilustrativo de taxas.', comments: []
    },
    {
      id: 'C-119', title: 'Estoque parado é dinheiro parado',
      format: 'Post LinkedIn', channel: 'LinkedIn', stage: 'em_edicao', owner: 'bruno',
      due: -1, publish: 4, pillar: 'Fluxo de caixa', script: 'Texto curto + imagem com giro de estoque fictício.', comments: []
    },
    {
      id: 'C-120', title: 'Pró-labore x retirada: pare de misturar as contas',
      format: 'Reels', channel: 'TikTok', stage: 'aguardando_gravacao', owner: 'bruno',
      due: 3, publish: 11, pillar: 'Gestão', script: S(`GANCHO: O caixa da loja não é a sua carteira.
      Explicar pró-labore definido versus retiradas aleatórias.`), comments: []
    }
  ];

  const TASKS = [
    { id: 'T-01', title: 'Aprovar roteiro e vídeo "4 ralos do e-commerce"', owner: 'ceo', due: 0, priority: 'Alta', status: 'A fazer', ceo: true, content: 'C-101' },
    { id: 'T-02', title: 'Validar números do carrossel de taxas de marketplace', owner: 'ceo', due: -1, priority: 'Alta', status: 'A fazer', ceo: true, content: 'C-102' },
    { id: 'T-03', title: 'Gravar participação da CEO no vídeo de Black Friday', owner: 'ceo', due: 2, priority: 'Média', status: 'A fazer', ceo: true, content: 'C-106' },
    { id: 'T-04', title: 'Definir verba de impulsionamento de novembro', owner: 'ceo', due: 4, priority: 'Média', status: 'A fazer', ceo: true },
    { id: 'T-05', title: 'Aplicar ajustes do DRE em 3 minutos (aos 1:20)', owner: 'rafael', due: 0, priority: 'Alta', status: 'Em andamento', content: 'C-104' },
    { id: 'T-06', title: 'Editar Reels "Frete grátis"', owner: 'rafael', due: 1, priority: 'Média', status: 'Em andamento', content: 'C-105' },
    { id: 'T-07', title: 'Gravar vídeo de conciliação de repasses', owner: 'bruno', due: -2, priority: 'Alta', status: 'Bloqueada', content: 'C-107', note: 'Aguardando cenário com tela do sistema' },
    { id: 'T-08', title: 'Arte do post "Estoque parado"', owner: 'bruno', due: -1, priority: 'Média', status: 'Em andamento', content: 'C-119' },
    { id: 'T-09', title: 'Roteiro do carrossel de margem de contribuição', owner: 'marina', due: 1, priority: 'Média', status: 'Em andamento', content: 'C-108' },
    { id: 'T-10', title: 'Pesquisa de pautas para dezembro (fechamento anual)', owner: 'marina', due: 5, priority: 'Baixa', status: 'A fazer' },
    { id: 'T-11', title: 'Responder comentários da semana no Instagram', owner: 'julia', due: 0, priority: 'Média', status: 'Em andamento' },
    { id: 'T-12', title: 'Relatório mensal de alcance e seguidores', owner: 'julia', due: 3, priority: 'Baixa', status: 'A fazer' },
    { id: 'T-13', title: 'Atualizar destaques do perfil @vindex.ecomm', owner: 'julia', due: -3, priority: 'Baixa', status: 'A fazer' },
    { id: 'T-14', title: 'Publicar "Bastidores do fechamento"', owner: 'julia', due: -2, priority: 'Média', status: 'Concluída', content: 'C-116' },
    { id: 'T-15', title: 'Exportar versão final do vídeo institucional', owner: 'rafael', due: -6, priority: 'Alta', status: 'Concluída', content: 'C-117' }
  ];

  const LIBRARY = [
    { id: 'L-1', type: 'video', title: 'Como ler o seu DRE mensal', cat: 'DRE e resultado', dur: '12:40', level: 'Essencial', video: 'assets/media/video_institucional.mp4' },
    { id: 'L-2', type: 'video', title: 'Fluxo de caixa semana a semana', cat: 'Fluxo de caixa', dur: '09:15', level: 'Essencial' },
    { id: 'L-3', type: 'video', title: 'Entendendo os repasses dos marketplaces', cat: 'Marketplaces', dur: '14:02', level: 'Intermediário' },
    { id: 'L-4', type: 'video', title: 'Margem de contribuição por produto', cat: 'DRE e resultado', dur: '11:28', level: 'Intermediário' },
    { id: 'L-5', type: 'video', title: 'Planejando o caixa para datas sazonais', cat: 'Fluxo de caixa', dur: '08:50', level: 'Avançado' },
    { id: 'L-6', type: 'video', title: 'Impostos no e-commerce: visão geral', cat: 'Impostos', dur: '16:05', level: 'Essencial' },
    { id: 'L-7', type: 'material', title: 'Planilha modelo de fluxo de caixa', cat: 'Fluxo de caixa', file: 'XLSX' },
    { id: 'L-8', type: 'material', title: 'Checklist de fechamento mensal', cat: 'DRE e resultado', file: 'PDF' },
    { id: 'L-9', type: 'material', title: 'Guia de taxas de marketplace', cat: 'Marketplaces', file: 'PDF' },
    { id: 'L-10', type: 'material', title: 'Calendário fiscal do trimestre', cat: 'Impostos', file: 'PDF' }
  ];

  return { STAGES, PEOPLE, FORMATS, CHANNELS, CONTENTS, TASKS, LIBRARY };
})();
