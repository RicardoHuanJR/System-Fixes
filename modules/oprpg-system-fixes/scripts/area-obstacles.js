import { areaAffectedTokenCells } from './area-grid.js';

export function heightMatches(token,{bottom=0,top=0}={}){
  const low=Number(bottom),high=Number(top),z=Number(token?.document?.elevation??0);
  if(![low,high,z].every(Number.isFinite))return false;
  // Only 0/0 means height is disabled. An explicit slice (5/5, for
  // example) must not accidentally select creatures on every elevation.
  return low===0&&high===0||low<=z&&z<=high;
}
export function wallAllows(template,token,config={}){
  if(!config.walls)return true;
  const region=(template.document??template).documentName==='Region'?(template.document??template):null;
  const attached=region?.attachment?.token&&canvas.scene?.tokens?.get(region.attachment.token);
  const bounds=region?.bounds;
  const origin=region
    ? (attached?{x:attached.x+(attached.width??1)*canvas.grid.size/2,y:attached.y+(attached.height??1)*canvas.grid.size/2}:(bounds?{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}:null))
    : {x:template.document.x,y:template.document.y};
  if(!origin||![origin.x,origin.y].every(Number.isFinite))throw Error('Origem da área indisponível para testar paredes.');
  const backend=CONFIG.Canvas?.polygonBackends?.sight;
  if(!backend?.testCollision)throw Error('O Foundry não disponibilizou o teste de paredes.');
  const d=token.document??token,x=Number(d.x),y=Number(d.y),w=token.w??d.width*canvas.grid.size,h=token.h??d.height*canvas.grid.size;
  const affected=areaAffectedTokenCells(template,token);
  // Wall checks must use the SAME affected grid squares as target selection.
  // Otherwise a silhouette-only point could reintroduce a false target.
  if(affected!==null)return affected.some(p=>!backend.testCollision(origin,{x:p.x,y:p.y},{type:'sight',mode:'any'}));
  const points=[{x:Math.max(x,Math.min(x+w,origin.x)),y:Math.max(y,Math.min(y+h,origin.y))},{x:x+w/2,y:y+h/2},{x:x+1,y:y+1},{x:x+w-1,y:y+1},{x:x+1,y:y+h-1},{x:x+w-1,y:y+h-1}];
  return points.some(p=>(region?region.testPoint({...p,elevation:Number(d.elevation??0)}):template.shape.contains(p.x-origin.x,p.y-origin.y))&&!backend.testCollision(origin,p,{type:'sight',mode:'any'}));
}
