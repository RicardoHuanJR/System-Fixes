/** Viewport geometry only. Does not move or hide Foundry UI. */
export function panelPlacement({anchor, portrait, viewport, width=380, sidebar, hotbar, cap=380}) {
  let minLeft=8, maxRight=viewport.width-8;
  if (sidebar?.width>0 && sidebar.height>0) {
    if (sidebar.right>=viewport.width-8) maxRight=Math.min(maxRight,sidebar.left-8);
    else if (sidebar.left<=8) minLeft=Math.max(minLeft,sidebar.right+8);
  }
  if (maxRight-minLeft<160) {minLeft=8;maxRight=viewport.width-8;}
  width=Math.max(0,Math.min(width,viewport.width-40,maxRight-minLeft));
  const left=Math.max(minLeft,Math.min(anchor.left,maxRight-width));
  const overlapsPortrait=portrait && left<portrait.right && left+width>portrait.left;
  let edge=Math.max(8,Math.min(anchor.top,overlapsPortrait?portrait.top:anchor.top)-8);
  if (hotbar?.width>0 && hotbar.height>0 && left<hotbar.right && left+width>hotbar.left && hotbar.top<edge && hotbar.bottom>8) edge=Math.max(8,hotbar.top-8);
  return {left,width,bottom:viewport.height-edge,maxHeight:Math.max(0,Math.min(cap,edge-8)),narrow:width<320};
}
