import { MODULE_ID } from './shared.js';

export const FEATURES = {
  characteristics:'Características configuráveis: Diable Jambe e bônus de dano',
  techniqueEffects:'Condições automáticas por resultado de técnicas',
  persistentAreas:'Áreas persistentes: movimento e turnos',
  periodicEffects:'Efeitos periódicos e adaptação de OverTime',
  externalCompatibility:'Compatibilidade parcial: efeitos DAE e flags/macros Midi-QOL',
  bookRules:'Livro 2.1: lendárias, descanso e registro de PV negativos',
  targets:'Aplicar dano nos alvos e solicitar alvos/áreas das técnicas',
  privacy:'Proteção adicional das chamadas legadas de dados 3D',
  multiActivity:'Múltiplas atividades: acerto, dano e identificação',
  sustained:'Duração, manutenção e cura por turno',
  fruit:'Técnicas e controles da aba Fruta',
  training:'Escolha de pagamento e histórico de treinamentos',
  shield:'Camadas de dano, escudo e resistências',
  haki:'Integração de Haki e despertar',
  formulas:'Normalização de fórmulas',
  healing:'Correções de cura e PV temporários',
  npc:'Correções de apresentação da ficha NPC',
  workspace:'Painel de efeitos, histórico, prévias e backups'
};
export function featureEnabled(key) {
  try { return game.settings.get(MODULE_ID,'enable_'+key)!==false; } catch (_) { return true; }
}
export function registerFeatureSettings() {
  for(const [key,name] of Object.entries(FEATURES)) game.settings.register(MODULE_ID,'enable_'+key,{
    name,hint:'Aplicado após recarregar o mundo. Desativar permite comparar o comportamento nativo do sistema.',scope:'world',config:true,type:Boolean,default:true,requiresReload:true
  });
}
