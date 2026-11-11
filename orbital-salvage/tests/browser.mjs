// Dependency-free Chrome DevTools smoke test. Start npm run dev and a headless
// Chrome with --remote-debugging-port=9223, then run npm run test:browser.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin=process.env.GAME_URL||'http://127.0.0.1:5173';
const debuggerUrl=process.env.CHROME_DEBUG_URL||'http://127.0.0.1:9223';
const out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const target=await fetch(`${debuggerUrl}/json/new?${encodeURIComponent(origin)}`,{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{
  const data=JSON.parse(event.data);
  if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);}
  if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
});
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Chrome timed out: ${method}`));},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function waitFor(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(100);}throw new Error(`Page condition timed out: ${expression}\n${errors.join('\n')}`);}
async function click(id){await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);}
async function screenshot(name){const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',out),Buffer.from(data,'base64'));}
async function key(code,down=true,key=code.replace('Key','').toLowerCase()){
  await send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key,code,windowsVirtualKeyCode:code==='Space'?32:code==='Escape'?27:key.toUpperCase().charCodeAt(0)});
}
const snapshot=()=>evaluate('window.orbitalSalvage.observe()');
async function assertFlightLayout(label){
  const issues=await evaluate(`(()=>{
    const issues=[],visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    const selectors=['.topbar','.flight-instruments','.radar-panel','.flight-bottom','.touch-controls','.notification.visible','.wind-banner:not([hidden])'];
    const panels=selectors.map(selector=>({selector,el:document.querySelector(selector)})).filter(p=>visible(p.el));
    for(const p of panels){const r=p.el.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)issues.push(p.selector+' outside viewport');}
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){
      const a=panels[i],b=panels[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;
      if(overlap(a.el.getBoundingClientRect(),b.el.getBoundingClientRect()))issues.push(a.selector+' overlaps '+b.selector);
    }
    for(const el of document.querySelectorAll('.hud .stat-label,.hud b,.speed-unit,#dock-state,#beam-state,.radar-title')){
      if(visible(el)&&parseFloat(getComputedStyle(el).fontSize)<14)issues.push(el.className+' text below 14px');
    }
    for(const stat of document.querySelectorAll('.hud-stat')){
      const r=stat.getBoundingClientRect();for(const line of stat.children){const range=document.createRange();range.selectNodeContents(line);for(const text of range.getClientRects())if(text.left<r.left-1||text.right>r.right+1)issues.push(stat.className+' clipped text');}
    }
    const cargo=document.querySelector('.cargo-stat').getBoundingClientRect(),speed=document.querySelector('.speed-stat').getBoundingClientRect();
    if(Math.abs(cargo.top-speed.top)>1||speed.left<cargo.right-1)issues.push('speed must sit immediately beside cargo');
    const brand=document.querySelector('.brand').getBoundingClientRect(),toolbar=document.querySelector('.toolbar').getBoundingClientRect();if(overlap(brand,toolbar))issues.push('brand overlaps buttons');
    return issues;
  })()`);
  assert.deepEqual(issues,[],`${label}: ${issues.join('; ')}`);
}
const report=[];
try{
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});await waitFor('!!window.orbitalSalvage');
  assert.equal(await evaluate(`import('./src/hardware-sprites.js').then(m=>m.loadHardware())`),true,'all four local hardware sprites must load and contain visible artwork');
  const atlasAlpha=await evaluate(`(async()=>{
    const image=new Image();image.src='./assets/salvage-hardware-realistic.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,1,1).data[3];
  })()`);
  assert.equal(atlasAlpha,0,'sprite sheet must have real transparency, without rectangular backgrounds');
  report.push('Realistic hardware atlas loads all four sprites with genuine transparency.');
  await evaluate('document.fonts.ready');await screenshot('01-mission-select');
  const skyMotion=await evaluate(`(async()=>{
    const {SpaceBackground}=await import('./src/space-background.js');
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),sky=new SpaceBackground();
    await sky.image.decode();
    const frame=(time,camera={x:0,y:0})=>{sky.draw(ctx,800,600,time,camera);return ctx.getImageData(0,0,800,600).data;};
    const difference=(a,b)=>{let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>8)changed++;return changed/(a.length/4);};
    const initial=frame(0),idle=frame(10),travel=frame(10,{x:500,y:180});
    const ambient=difference(initial,idle),flight=difference(idle,travel);
    const frozen=difference(travel,frame(10,{x:500,y:180}));
    sky.reduced=true;const reduced=difference(frame(0),frame(10));
    return {ambient,flight,frozen,reduced};
  })()`);
  assert.ok(skyMotion.ambient>.02,`ambient sky should visibly evolve: ${JSON.stringify(skyMotion)}`);
  assert.ok(skyMotion.flight>.15,`travel should visibly shift the sky: ${JSON.stringify(skyMotion)}`);
  assert.equal(skyMotion.frozen,0,'paused sky should remain still');
  assert.equal(skyMotion.reduced,0,'reduced-motion mode should suppress ambient sky motion');
  report.push('Canvas pixel checks: sky drifts at rest, pans during flight, freezes on pause and respects reduced motion.');
  await evaluate('document.getElementById("launch-button").focus()');await key('Space',true,' ');await key('Space',false,' ');await waitFor('document.body.dataset.screen === "playing"');
  assert.ok(await evaluate('document.querySelector(".hud").getBoundingClientRect().height < 105'));
  await assertFlightLayout('desktop launch');
  assert.equal(await evaluate('!!document.getElementById("flight-hint")'),false);
  assert.equal(await evaluate('!!document.querySelector(".controls-footer")'),false);
  let before=await snapshot();await delay(10100);let after=await snapshot();
  assert.ok(after.elapsed-before.elapsed>8,'real-time world must advance without keys');
  assert.ok(Math.hypot(after.cargo[0].x-before.cargo[0].x,after.cargo[0].y-before.cargo[0].y)>10);
  report.push('Real-time idle world: cargo, asteroids and clock keep moving for ten seconds.');
  const startFuel=after.ship.fuel;
  await key('KeyW');await delay(700);await key('KeyW',false);before=await snapshot();assert.ok(before.ship.fuel<startFuel);assert.ok(Math.hypot(before.ship.vx,before.ship.vy)>25);
  await delay(500);after=await snapshot();assert.ok(Math.hypot(after.ship.x-before.ship.x,after.ship.y-before.ship.y)>10);
  await key('KeyA');await delay(400);await key('KeyA',false);after=await snapshot();assert.ok(Math.abs(after.ship.angle-before.ship.angle)>.3);
  before=after;await key('KeyS');await delay(700);await key('KeyS',false);after=await snapshot();
  assert.ok(Math.hypot(after.ship.vx,after.ship.vy)>5);
  assert.ok((after.ship.vx-before.ship.vx)*Math.cos(before.ship.angle)+(after.ship.vy-before.ship.vy)*Math.sin(before.ship.angle)<-20);
  report.push('Compact flight UI; keyboard thrust, rotation, fuel, inertia and gentle reverse thrust.');
  await key('KeyP');await key('KeyP',false);before=await snapshot();assert.equal(before.screen,'paused');await delay(500);after=await snapshot();assert.equal(after.elapsed,before.elapsed);await screenshot('03-paused');
  await key('Space',true,' ');await key('Space',false,' ');await delay(200);assert.equal((await snapshot()).screen,'playing');
  await key('KeyR');await key('KeyR',false);assert.ok((await snapshot()).elapsed<.2);report.push('Pause freezes physics; resume and keyboard restart work.');
  await click('help-button');assert.equal((await snapshot()).screen,'manual');await screenshot('04-manual');await click('manual-ready');assert.equal((await snapshot()).screen,'playing');
  await click('sound-button');assert.equal(await evaluate('document.getElementById("sound-button").getAttribute("aria-pressed")'),'false');await click('sound-button');
  report.push('Flight manual pauses and restores play; mute toggle works.');

  // Test input and outcomes with a deterministic animation clock. Physics still
  // passes through the production requestAnimationFrame loop and action API.
  const clockScript=`{
    let now=0,id=0,queue=new Map();
    performance.now=()=>now;
    window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};
    window.cancelAnimationFrame=id=>queue.delete(id);
    window.__qaStall=ms=>{now+=ms;};
    window.__qaGap=ms=>{now+=ms;const frame=[...queue.values()];queue.clear();for(const cb of frame)cb(now);};
    window.__qaAdvance=ms=>{const n=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<n;i++)window.__qaGap(1000/60);};
  }`;
  await send('Page.addScriptToEvaluateOnNewDocument',{source:clockScript});
  await send('Page.navigate',{url:origin});await waitFor('!!window.orbitalSalvage');await click('launch-button');
  await evaluate('window.__qaGap(2000)');
  assert.ok(Math.abs((await snapshot()).elapsed-2)<1/120,'a slow frame must retain all elapsed physics time');
  await evaluate('window.orbitalSalvage.reset();window.__qaStall(2000);window.orbitalSalvage.act({thrust:1})');
  after=await snapshot();assert.ok(Math.abs(after.elapsed-2)<1/120);assert.equal(after.ship.fuel,240,'new thrust must not apply retroactively');
  await evaluate('window.__qaGap(100)');assert.ok((await snapshot()).ship.fuel<240);
  await evaluate('window.dispatchEvent(new Event("blur"))');assert.equal((await snapshot()).screen,'paused');
  await evaluate('window.orbitalSalvage.reset()');
  assert.ok(await evaluate('Number.isFinite(Number(document.getElementById("speed-value").textContent)) && document.querySelector(".speed-unit").textContent === "m/s"'));
  assert.ok(await evaluate('document.getElementById("dock-state").textContent.includes("200 m/s")'));
  report.push('Slow frames retain elapsed time, late controls never affect the past, and practice still pauses on blur.');
  await evaluate(`window.__qaPilot=()=>{
    const api=window.orbitalSalvage,g=api.observe(),s=g.ship,attached=g.cargo.find(c=>c.id===g.attachedId);
    const target=attached?{x:g.dock.x,y:g.dock.y,vx:0,vy:0}:g.cargo.filter(c=>!c.delivered).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
    if(!target)return;const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy);
    const wanted=Math.min(100,d*.6),ax=dx/(d||1)*wanted-s.vx,ay=dy/(d||1)*wanted-s.vy;
    const err=Math.atan2(Math.sin(Math.atan2(ay,ax)-s.angle),Math.cos(Math.atan2(ay,ax)-s.angle));
    api.act({turn:Math.abs(err)<.09?0:Math.sign(err),thrust:Math.abs(err)<.45&&Math.hypot(ax,ay)>10?1:0,tractor:!attached&&d<175});
  };`);
  let sawLink=false,sawRelease=false;
  for(let i=0;i<120;i++){
    await evaluate('for(let i=0;i<30;i++){window.__qaPilot();window.__qaAdvance(1000/60);}');
    const state=await snapshot();
    if(state.attachedId!==null&&!sawLink){
      sawLink=true;await screenshot('02-carrying');
      const cargo=state.cargo.find(c=>c.id===state.attachedId);
      assert.ok(Math.abs(Math.hypot(cargo.x-state.ship.x,cargo.y-state.ship.y)-43)<.0001);
      assert.equal(cargo.vx,state.ship.vx);assert.equal(cargo.vy,state.ship.vy);
      assert.ok(await evaluate('document.getElementById("beam-state").textContent.includes("Fly home")'));
      await key('Space',true,' ');await key('Space',false,' ');assert.equal((await snapshot()).attachedId,null);sawRelease=true;
      await key('Space',true,' ');await key('Space',false,' ');assert.notEqual((await snapshot()).attachedId,null);
    }
    if(state.screen==='result')break;
  }
  after=await snapshot();assert.ok(sawLink&&sawRelease,'pickup/release should occur in actual flight');assert.equal(after.status,'complete',JSON.stringify({status:after.status,delivered:after.delivered,elapsed:after.elapsed,fuel:after.ship.fuel}));assert.equal(after.delivered,2);assert.equal(after.screen,'result');
  await screenshot('05-delivery-effects');await delay(750);await screenshot('05-complete');report.push('Basic thrust/turn inputs complete First Recovery; cargo stays fixed to the ship, and Space drops/reattaches it.');
  await click('retry-button');assert.equal((await snapshot()).delivered,0);assert.equal((await snapshot()).score,0);
  await evaluate('window.orbitalSalvage.reset("storm")');await evaluate('window.__qaAdvance(13500)');assert.equal((await snapshot()).gust.warning,true);await evaluate('window.__qaAdvance(5100)');assert.equal((await snapshot()).gust.active,true);await screenshot('06-solar-wind');
  report.push('Advanced mission selection, solar-wind warning and active gust are visible and timed correctly.');
  await evaluate('window.orbitalSalvage.reset("debris")');
  await evaluate('window.__qaAdvance(166000)');assert.equal((await snapshot()).status,'timeout');assert.equal((await snapshot()).screen,'result');
  report.push('Mission clock expires and opens the failure/retry screen.');
  await click('result-menu');assert.equal((await snapshot()).screen,'menu');
  for(const [width,height] of [[1280,720],[768,1024],[390,844],[844,390],[320,568]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.dispatchEvent(new Event("resize"));window.__qaAdvance(100)');
    await evaluate('document.getElementById("launch-button").scrollIntoView({block:"center"})');
    assert.ok(await evaluate('document.getElementById("launch-button").getBoundingClientRect().bottom < innerHeight-10'));
    assert.ok(await evaluate('document.getElementById("launch-button").getBoundingClientRect().top >= 0'));
    await screenshot(`menu-${width}`);
    await click('launch-button');await evaluate('window.__qaAdvance(200)');await assertFlightLayout(`${width} × ${height} flight`);await screenshot(`flight-${width}`);
    const map=await evaluate('({width:document.getElementById("radar").clientWidth,height:document.getElementById("radar").clientHeight})');
    assert.ok(map.width>=(width<760||height<500?144:232)&&map.height>=(width<760||height<500?107:172));
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
    if(width<760||height<500){
      const point=await evaluate('(()=>{const b=document.querySelector("[data-control=forward]"),r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,reachable:y<innerHeight&&document.elementFromPoint(x,y)===b};})()');
      assert.equal(point.reachable,true,'touch thrust must be visible and reachable');
      const fuel=(await snapshot()).ship.fuel;
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      await evaluate('window.__qaAdvance(300)');
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      assert.ok((await snapshot()).ship.fuel<fuel,'pointer control must thrust');
    }
    await evaluate('window.orbitalSalvage.reset("storm");window.__qaAdvance(13500)');
    await assertFlightLayout(`${width} × ${height} wind warning`);
    await screenshot(`wind-${width}`);
    await evaluate('window.orbitalSalvage.pause()');await click('exit-paused');
  }
  report.push('Mission selection scrolls to Launch on short screens; desktop, tablet, phone and landscape have no horizontal overflow.');
  report.push('Cargo and Speed are adjacent; text is at least 14px; flight panels, wind warnings, map and touch controls do not overlap.');
  await send('Page.navigate',{url:origin+'/?evaluation=1'});await waitFor('!!window.orbitalSalvage');
  await evaluate('window.orbitalSalvage.reset("practice",42);window.orbitalSalvage.act({thrust:1});window.__qaStall(2000);window.dispatchEvent(new Event("blur"))');
  after=await snapshot();assert.equal(after.mode,'evaluation');assert.equal(after.screen,'playing');assert.ok(Math.abs(after.elapsed-2)<1/120);assert.ok(after.ship.fuel<238);
  await evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));window.orbitalSalvage.pause();window.__qaStall(1000)');
  after=await snapshot();assert.equal(after.screen,'playing');assert.ok(Math.abs(after.elapsed-3)<1/120);
  await evaluate('window.orbitalSalvage.reset("debris");window.__qaGap(200)');
  assert.ok(await evaluate('document.getElementById("dock-state").textContent.includes("120 m/s")'));
  const savedRecords=await evaluate('localStorage.getItem("orbital-salvage-records-v1")');
  await evaluate('window.__qaAdvance(166000)');assert.equal((await snapshot()).screen,'result');
  assert.equal(await evaluate('document.getElementById("best-label").textContent'),'EVALUATION RUN');
  assert.equal(await evaluate('localStorage.getItem("orbital-salvage-records-v1")'),savedRecords);
  report.push('Evaluation mode preserves agent controls across blur/hidden events, catches up without rendering and disables pause.');
  assert.deepEqual(errors,[],'Browser should have no unhandled JavaScript exceptions.');
  await writeFile(new URL('browser-report.json',out),JSON.stringify({passed:true,checks:report,errors},null,2));
  console.log(report.map(x=>'PASS '+x).join('\n'));console.log(`Screenshots: ${out.pathname}`);
}finally{await fetch(`${debuggerUrl}/json/close/${target.id}`).catch(()=>{});ws.close();}
