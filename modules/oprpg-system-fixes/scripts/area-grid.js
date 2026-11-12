// Alvos em áreas seguem CASAS do tabuleiro, não a interseção de pixels do molde.
// No Foundry 14, o modo "coverage" das Regiões destaca casas conforme seus centros.
export function regionDocument(area) {
  const doc=area?.document??area;
  return doc?.documentName==='Region'?doc:null;
}

function finiteRectangle(token) {
  const doc=token?.document??token;
  const grid=canvas?.grid;
  const size=Number(grid?.size??canvas?.dimensions?.size??100);
  const x=Number(doc?.x??token?.x),y=Number(doc?.y??token?.y);
  const width=Number(token?.w??Number(doc?.width??1)*size);
  const height=Number(token?.h??Number(doc?.height??1)*size);
  if(![x,y,width,height,size].every(Number.isFinite)||width<=0||height<=0||size<=0)return null;
  return {x,y,width,height,size};
}

function usableGrid() {
  const grid=canvas?.grid;
  if(!grid||grid.isGridless===true||grid.type===0)return false;
  // Some systems expose the grid without isSquare/isHexagonal, but with size.
  return Number.isFinite(Number(grid.size))&&Number(grid.size)>0;
}

// Returns the squares occupied by the token. A 2x2 creature supplies four centers.
// Foundry's grid helpers handle padded scenes and hex grids; the arithmetic
// fallback supports older square-grid integrations.
export function tokenGridCells(token) {
  if(!usableGrid())return null;
  const bounds=finiteRectangle(token);
  if(!bounds)return [];
  const {x,y,width,height,size}=bounds,grid=canvas.grid;
  const range=typeof grid.getOffsetRange==='function'
    ?grid.getOffsetRange({x,y,width,height})
    :[Math.floor(x/size),Math.floor(y/size),Math.ceil((x+width)/size),Math.ceil((y+height)/size)];
  if(!Array.isArray(range)||range.length!==4||range.some(v=>!Number.isFinite(v)))return [];
  const [i0,j0,i1,j1]=range;
  const results=[];
  // Protect the UI against unreasonably large/invalid token dimensions.
  if(i1<=i0||j1<=j0||(i1-i0)*(j1-j0)>4096)return results;
  const epsilon=Math.max(1e-6,size*1e-7);
  for(let i=i0;i<i1;i++)for(let j=j0;j<j1;j++){
    const center=typeof grid.getCenterPoint==='function'
      ?grid.getCenterPoint({i,j}):{x:(i+0.5)*size,y:(j+0.5)*size};
    if(!center||![center.x,center.y].every(Number.isFinite))continue;
    if(center.x>=x-epsilon&&center.x<x+width+epsilon&&center.y>=y-epsilon&&center.y<y+height+epsilon)
      results.push({i,j,x:center.x,y:center.y});
  }
  // Sub-grid-size tokens still occupy a grid square, even if no cell center
  // falls inside their tiny footprint.
  if(!results.length&&width<size&&height<size){
    const middle={x:x+width/2,y:y+height/2};
    const offset=typeof grid.getOffset==='function'?grid.getOffset(middle)
      :{i:Math.floor(middle.x/size),j:Math.floor(middle.y/size)};
    if(Number.isFinite(offset?.i)&&Number.isFinite(offset?.j)){
      const center=typeof grid.getCenterPoint==='function'?grid.getCenterPoint(offset)
        :{x:(offset.i+0.5)*size,y:(offset.j+0.5)*size};
      if(center&&[center.x,center.y].every(Number.isFinite))results.push({i:offset.i,j:offset.j,x:center.x,y:center.y});
    }
  }
  return results;
}

// In the legacy OPRPG template implementation, Foundry may already have
// calculated the exact grid-highlight cells. Preserve them when available.
export function readTemplateHighlights(template) {
  if(typeof template?._getGridHighlightPositions!=='function')return null;
  try {
    const points=template._getGridHighlightPositions();
    if(!Array.isArray(points))return null;
    const result=points.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y))
      .map(p=>({x:p.x,y:p.y}));
    return result.length===points.length?result:null;
  }catch(_error){return null;}
}

function pointInPolygon(points,x,y){
  let inside=false;
  for(let i=0,j=points.length-2;i<points.length;j=i,i+=2){
    const xi=points[i],yi=points[i+1],xj=points[j],yj=points[j+1];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

function shapeContains(shape,x,y){
  if(typeof shape?.contains==='function')return shape.contains(x,y);
  if(!shape)return false;
  if(Number.isFinite(shape.radius))return (x-Number(shape.x??0))**2+(y-Number(shape.y??0))**2<=shape.radius**2;
  if(shape.points?.length>=6)return pointInPolygon(shape.points,x,y);
  if(Number.isFinite(shape.width)&&Number.isFinite(shape.height)){
    const sx=Number(shape.x??0),sy=Number(shape.y??0);
    return x>=sx&&x<sx+shape.width&&y>=sy&&y<sy+shape.height;
  }
  return false;
}

export function areaAffectedTokenCells(area,token) {
  const cells=tokenGridCells(token);
  if(cells===null)return null; // Gridless scenes use the old true-shape geometry.
  const region=regionDocument(area);
  if(region){
    if(typeof region.testPoint!=='function')return [];
    const elevation=Number(token?.document?.elevation??0);
    return cells.filter(p=>region.testPoint({x:p.x,y:p.y,elevation}));
  }
  const shape=area?.shape??area?.object?.shape;
  const origin=area?.document??area;
  if(!shape)return [];
  const highlights=area?.gridHighlights??readTemplateHighlights(area);
  if(Array.isArray(highlights)){
    const grid=canvas.grid,size=Number(grid.size);
    const selected=new Set(highlights.map(({x,y})=>{
      const offset=typeof grid.getOffset==='function'
        ?grid.getOffset({x:x+size/2,y:y+size/2})
        :{i:Math.floor((x+size/2)/size),j:Math.floor((y+size/2)/size)};
      return `${offset.i},${offset.j}`;
    }));
    return cells.filter(p=>selected.has(`${p.i},${p.j}`));
  }
  const ox=Number(origin?.x??0),oy=Number(origin?.y??0);
  return cells.filter(p=>shapeContains(shape,p.x-ox,p.y-oy));
}
