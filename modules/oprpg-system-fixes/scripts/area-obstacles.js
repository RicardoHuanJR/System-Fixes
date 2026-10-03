export function heightMatches(token,{bottom=0,top=0}={}){
  const z=Number(token.document?.elevation??0);return bottom===top||Number.isFinite(z)&&z>=bottom&&z<=top;
}
export function wallAllows(template,token,config={}){
  if(!config.walls)return true;
  const origin={x:template.document.x,y:template.document.y},backend=CONFIG.Canvas?.polygonBackends?.sight;
  if(!backend?.testCollision)throw Error('O Foundry não disponibilizou o teste de paredes.');
  const d=token.document??token,x=Number(d.x),y=Number(d.y),w=token.w??d.width*canvas.grid.size,h=token.h??d.height*canvas.grid.size;
  const points=[{x:Math.max(x,Math.min(x+w,origin.x)),y:Math.max(y,Math.min(y+h,origin.y))},{x:x+w/2,y:y+h/2},{x:x+1,y:y+1},{x:x+w-1,y:y+1},{x:x+1,y:y+h-1},{x:x+w-1,y:y+h-1}];
  return points.some(p=>template.shape.contains(p.x-origin.x,p.y-origin.y)&&!backend.testCollision(origin,p,{type:'sight',mode:'any'}));
}
