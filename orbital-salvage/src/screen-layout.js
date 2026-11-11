// Place navigation labels around occupied screen space, including the craft.
// Keep the closest clear position to the target's original edge marker.
export function placeEdgeMarker(ideal, bounds, obstacles, labelWidth, screenWidth) {
  const candidates=[ideal];
  for(let i=0;i<=20;i++){
    const x=bounds.left+(bounds.right-bounds.left)*i/20;
    const y=bounds.top+(bounds.bottom-bounds.top)*i/20;
    candidates.push({x,y:bounds.top},{x,y:bounds.bottom},{x:bounds.left,y},{x:bounds.right,y});
  }
  let best,score=Infinity;
  for(const point of candidates){
    const rightAligned=point.x>screenWidth/2;
    const box={left:rightAligned?point.x-labelWidth:point.x-8,right:rightAligned?point.x+8:point.x+labelWidth,top:point.y-12,bottom:point.y+12};
    let overlap=0;
    for(const obstacle of obstacles){
      overlap+=Math.max(0,Math.min(box.right,obstacle.right+8)-Math.max(box.left,obstacle.left-8))
        *Math.max(0,Math.min(box.bottom,obstacle.bottom+8)-Math.max(box.top,obstacle.top-8));
    }
    const cost=overlap*1e6+(point.x-ideal.x)**2+(point.y-ideal.y)**2;
    if(cost<score){best={...point,box};score=cost;}
  }
  return best;
}
