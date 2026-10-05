// Installation diagnostics only: matching versions is not a functional test.
export const OWN_MODULES = ['oprpg-system-fixes','oprpg-chat-modifiers','oprpg-antifraude','oprpg-detector-fraude','enhancedcombathud-oprpg-system'];
export function moduleCompatibility(gameState=game) {
  const modules=gameState.modules;
  const active=id=>!!modules?.get(id)?.active;
  const own=OWN_MODULES.map(id=>({id,installed:!!modules?.get(id),active:active(id),version:modules?.get(id)?.version??null}));
  const issues=[];
  const add=(id,detail,category='attention')=>issues.push({id,detail,category});
  if(active('oprpg-antifraude')&&!active('socketlib'))add('socketlib','Anti-fraude precisa do socketlib ativo.','dependency');
  if(active('enhancedcombathud-oprpg-system')&&!active('enhancedcombathud'))add('enhancedcombathud','A integração OPRPG precisa do Argon Core.','dependency');
  if(active('enhancedcombathud-oprpg-system')&&active('enhancedcombathud-dnd5e'))add('enhancedcombathud-dnd5e','Duas integrações para o mesmo HUD: manter a integração OPRPG.','duplicate');
  if(active('oprpg-system-fixes'))for(const id of ['oprpg-diable-jambe','oprpg-automacoes-efeitos','oprpg-haki-automations','oprpg-haki-unificado'])if(active(id))add(id,'Automação antiga sobrepõe funções integradas ao Fixes. Revisar as opções antes de desativar.','duplicate');
  if(active('midi-qol'))add('midi-qol','OPRPG usa integração parcial de flags e macros. O fluxo D&D5e completo não é compatível.','partial');
  return {functionalValidation:false,own,issues,externalSeparate:true};
}
export function compatibilityHTML(report) {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<h3>Módulos próprios</h3><table><thead><tr><th>Módulo</th><th>Versão</th><th>Estado</th></tr></thead><tbody>${report.own.map(m=>`<tr><td>${esc(m.id)}</td><td>${esc(m.version??'—')}</td><td>${m.active?'Ativo':m.installed?'Instalado, desativado':'Não instalado'}</td></tr>`).join('')}</tbody></table><p>Esta conferência identifica instalação e possíveis conflitos. Não substitui testes de funcionamento.</p>${report.issues.length?`<ul>${report.issues.map(i=>`<li><strong>${esc(i.id)}</strong>: ${esc(i.detail)}</li>`).join('')}</ul>`:'<p>Nenhuma sobreposição conhecida detectada nesta configuração.</p>'}`;
}
