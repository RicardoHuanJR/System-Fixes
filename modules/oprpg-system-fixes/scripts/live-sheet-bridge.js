// Bind against the sheet actually rendered/registered by Foundry. Importing a
// second copy of a source class is insufficient when the live sheet differs.
export function connectLiveSheets(accept,connect){
  const visit=app=>{if(app?.actor && accept(app))connect(app)};
  for(const event of ['renderApplicationV2','renderActorSheetV2','renderActorSheet','renderCharacterActorSheet'])Hooks.on(event,visit);
  for(const app of foundry.applications?.instances?.values?.() ?? [])visit(app);
  for(const app of Object.values(ui.windows ?? {}))visit(app);
  for(const actor of game.actors ?? [])for(const app of Object.values(actor.apps ?? {}))visit(app);
}

export function registeredCharacterSheets(){
  const entries=CONFIG.Actor?.sheetClasses?.character ?? {};
  return [...new Set(Object.values(entries).map(e=>e.cls).filter(cls=>typeof cls==='function'))];
}
