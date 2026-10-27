/*
  Vindex Hub — listas fixas do sistema (etapas, formatos, canais...).
  Os dados reais (conteúdos, tarefas, pessoas) ficam no banco Firebase.
*/
window.VINDEX_CONST = {
  STAGES: [
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
  ],
  FORMATS: ['Reels', 'Carrossel', 'Post estático', 'Stories', 'Vídeo YouTube', 'Post LinkedIn'],
  CHANNELS: ['Instagram', 'YouTube', 'LinkedIn', 'TikTok'],
  PILLARS: ['Lucro', 'Fluxo de caixa', 'Marketplaces', 'Impostos', 'Gestão', 'Institucional'],
  LIB_CATS: ['DRE e resultado', 'Fluxo de caixa', 'Marketplaces', 'Impostos', 'Gestão'],
  LEVELS: ['Essencial', 'Intermediário', 'Avançado'],
  ROLES: [
    { id: 'admin', label: 'Administrador (equipe)' },
    { id: 'ceo', label: 'CEO' },
    { id: 'equipe', label: 'Equipe' },
    { id: 'cliente', label: 'Cliente' }
  ]
};
