import { createGame, stepGame, toggleBeam, nearestCargo, observe, clamp, dockingZone, length, MISSIONS, BEAM_RANGE, DT } from './simulation.js';
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';

const $=id=>document.getElementById(id);
const renderer=new Renderer($('space'),$('radar'));
const audio=new AudioEngine();
const keys=new Set();
const evaluationMode=new URLSearchParams(location.search).get('evaluation')==='1';
let selected='first',game=createGame(selected),screen='menu',beforeManual='menu';
let agentAction={turn:0,thrust:0},agentEnabled=false,acc=0,last=performance.now(),notifyUntil=0,resultShown=false;
let lastVisual=last;
let hudTimer=0,lastFocus=null;
const clock=seconds=>`${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
const format=n=>Math.round(n).toLocaleString('en-US');
function readRecords(){try{return JSON.parse(localStorage.getItem('orbital-salvage-records-v1')||'{}');}catch{return {};}}
let records=readRecords();
try{audio.setMuted(localStorage.getItem('orbital-salvage-muted')!=='false');}catch{}
function soundButton(){const b=$('sound-button');b.setAttribute('aria-pressed',String(audio.muted));b.setAttribute('aria-label',audio.muted?'Unmute sound':'Mute sound');}
soundButton();
function selectMission(id){
  selected=id;
  document.querySelectorAll('.mission-card').forEach(b=>{const is=b.dataset.mission===id;b.classList.toggle('selected',is);b.setAttribute('aria-pressed',String(is));});
  const m=MISSIONS.find(m=>m.id===id);$('launch-button').querySelector('small').textContent=`${m.name.toUpperCase()} · ${clock(m.time)}`;
  if(screen==='menu'){game=createGame(id);renderer.reset(game,true);}
}
function renderMissions(){
  $('contract-range').textContent=`01 — ${String(MISSIONS.length).padStart(2,'0')}`;
  $('mission-list').replaceChildren(...MISSIONS.map(m=>{
    const button=document.createElement('button');button.className='mission-card';button.dataset.mission=m.id;button.setAttribute('aria-pressed',String(m.id===selected));button.setAttribute('aria-label',`${m.name}. ${m.difficulty}. ${m.description}`);
    const number=document.createElement('span');number.className='mission-number';number.textContent=m.label;
    const copy=document.createElement('div'),title=document.createElement('h3'),sub=document.createElement('p');title.textContent=m.name;sub.textContent=`${m.difficulty} · ${m.count} CONTAINERS`;copy.append(title,sub);
    const check=document.createElement('span');check.className='mission-check';check.textContent=m.id===selected?'◉':'○';check.setAttribute('aria-hidden','true');
    if(records[m.id]){const best=document.createElement('span');best.className='mission-best';best.textContent=`BEST ${format(records[m.id])}`;button.append(number,copy,best,check);}else button.append(number,copy,check);
    button.addEventListener('click',()=>{selectMission(m.id);document.querySelectorAll('.mission-check').forEach(el=>el.textContent=el.parentElement.dataset.mission===selected?'◉':'○');});return button;
  }));
  selectMission(selected);
}
function releaseInput(){keys.clear();agentAction={turn:0,thrust:0};agentEnabled=false;}
function show(next){
  screen=next;
  document.body.dataset.screen=next;
  $('menu').hidden=next!=='menu';$('flight-ui').hidden=next==='menu';
  $('pause-screen').hidden=next!=='paused';$('result-screen').hidden=next!=='result';$('manual-screen').hidden=next!=='manual';
  $('pause-button').hidden=evaluationMode||!['playing','paused'].includes(next);
  $('help-button').hidden=evaluationMode&&next==='playing';
  $('pause-button').textContent=next==='paused'?'▷':'Ⅱ';$('pause-button').setAttribute('aria-label',next==='paused'?'Resume mission':'Pause mission');
  $('top-status-text').textContent=next==='menu'?'AEGIS SECTOR · LINK ESTABLISHED':next==='playing'?'TELEMETRY LIVE · AEGIS SECTOR':'TELEMETRY HOLD · AEGIS SECTOR';
  if(next!=='playing')releaseInput();
  if(next==='playing')document.activeElement?.blur();
  if(next==='paused')$('resume-button').focus();
  else if(next==='result')$('retry-button').focus();
  else if(next==='menu')$('launch-button').focus({preventScroll:true});
}
function launch(id=selected,seed){
  if(id==='practice'&&seed===undefined&&!evaluationMode)seed=Math.floor(Math.random()*0x100000000);
  selected=MISSIONS.some(m=>m.id===id)?id:'first';game=createGame(selected,seed);acc=0;last=performance.now();resultShown=false;notifyUntil=0;
  releaseInput();renderer.reset(game);audio.unlock();$('notification').classList.remove('visible');$('wind-banner').hidden=true;
  $('cargo-total').textContent=` / ${game.mission.count}`;
  show('playing');updateHud();return observe(game);
}
function toMenu(){show('menu');game=createGame(selected);renderer.reset(game,true);renderMissions();}
function pause(){if(evaluationMode)return;if(screen==='playing'){advanceSimulation();if(screen!=='playing')return;show('paused');audio.update(0,false);}else if(screen==='paused'){last=performance.now();acc=0;show('playing');}}
function openManual(){
  if(screen==='manual'||(evaluationMode&&screen==='playing'))return;advanceSimulation();beforeManual=screen;lastFocus=document.activeElement;show('manual');$('close-manual').focus();audio.update(0,false);
}
function closeManual(){show(beforeManual);last=performance.now();acc=0;lastFocus?.focus();}
function notify(text,seconds=1.5){$('notification').textContent=text;$('notification').classList.add('visible');notifyUntil=renderer.time+seconds;}
function results(){
  if(resultShown)return;resultShown=true;
  const complete=game.status==='complete',partial=game.delivered>0&&game.status==='timeout';
  $('result-eyebrow').textContent=complete?'CONTRACT FULFILLED':partial?'CONTRACT CLOSED':'FLIGHT REPORT / RETURN TO BASE';
  $('result-title').innerHTML=complete?'Good<br><em>haul.</em>':partial?'A little<br><em>goes far.</em>':game.status==='destroyed'?'Lost<br><em>contact.</em>':'Out of<br><em>time.</em>';
  $('result-description').textContent=complete?'Every piece has a way home. Nice flying.':partial?'Your recovered cargo is secure. There’s more out there.':game.status==='destroyed'?'The debris field got the better of us. Your next run starts fresh.':'The recovery window has closed. Try a shorter approach.';
  $('result-score').textContent=format(game.score);const unit=document.createElement('small');unit.textContent=' CR';$('result-score').append(unit);
  $('result-cargo').textContent=`${String(game.delivered).padStart(2,'0')} / ${String(game.mission.count).padStart(2,'0')}`;
  $('result-fuel').textContent=`${Math.round(game.ship.fuel/game.mission.fuel*100)}%`;$('result-time').textContent=clock(game.elapsed);
  $('result-route').textContent=`${game.mission.name} · route seed ${game.seed}`;
  const best=Number(records[selected])||0,isBest=!evaluationMode&&game.score>best;
  if(isBest){records[selected]=game.score;try{localStorage.setItem('orbital-salvage-records-v1',JSON.stringify(records));}catch{}}
  $('best-label').textContent=evaluationMode?'EVALUATION RUN':isBest?'✧ NEW PERSONAL BEST':best?`PERSONAL BEST / ${format(best)} CR`:'YOUR NEXT CONTRACT IS WAITING';
  $('result-bonus').textContent=complete?`+${format(game.bonus)} CR · completion, time & efficiency bonus`:game.delivered? 'Delivered cargo remains credited.':'Tip: use short thrusts and leave room to slow down.';
  $('next-mission').hidden=selected===MISSIONS.at(-1).id;show('result');
}
function handleEvents(){
  for(const e of game.events){
    renderer.event(e);audio.event(e.type);
    if(e.type==='range')notify('Get closer to cargo');
    else if(e.type==='delivery')notify(`Delivered · +${format(e.points)} CR`);
    else if(e.type==='fuel')notify('Fuel low',2);
  }
  game.events.length=0;
  if(game.status!=='playing'&&screen==='playing')results();
}
function updateHud(){
  const s=game.ship,remaining=Math.max(0,game.mission.time-game.elapsed),fuel=s.fuel/game.mission.fuel*100;
  $('cargo-count').textContent=game.delivered;
  $('time-value').textContent=clock(Math.ceil(remaining));$('time-value').parentElement.classList.toggle('low',remaining<30);
  $('fuel-value').textContent=`${Math.ceil(fuel)}%`;$('fuel-fill').style.width=fuel+'%';$('fuel-fill').style.background=fuel<20?'#eeb576':'';
  $('hull-value').textContent=`${Math.ceil(s.integrity)}%`;$('hull-fill').style.width=s.integrity+'%';$('hull-fill').style.background=s.integrity<35?'#e78880':'';
  const speed=length(s),dock=dockingZone(game),safe=speed<dock.speed;
  $('speed-value').textContent=`${Math.floor(speed)} m/s`;
  $('dock-state').textContent=safe?`Dock ready · below ${dock.speed} m/s`:`Slow down · below ${dock.speed} m/s to dock`;
  $('dock-state').classList.toggle('too-fast',!safe);
  const near=nearestCargo(game),distance=near?Math.hypot(near.x-s.x,near.y-s.y):Infinity,linked=game.attachedId!==null,ready=distance<=BEAM_RANGE;
  const panel=$('beam-state').parentElement;panel.classList.toggle('ready',ready&&!linked);panel.classList.toggle('linked',linked);
  $('beam-state').textContent=linked?'Cargo aboard · Fly home':ready?'Space · Pick up':'WASD fly · Space pick up';
  const g=game.gust;$('wind-banner').hidden=!(g.warning||g.active);
  if(g.warning||g.active){$('wind-title').textContent=g.active?'Solar wind':`Wind in ${Math.ceil(game.nextGust-game.elapsed)}s`;$('wind-arrow').style.transform=`rotate(${Math.atan2(g.y,g.x)*180/Math.PI+45}deg)`;}
}
function keyboardInput(){
  const held=control=>keys.has(control)||Object.entries(mappings).some(([code,action])=>action===control&&keys.has(code));
  return {turn:(held('right')?1:0)-(held('left')?1:0),thrust:held('reverse')?-.55:held('forward')?1:0};
}
const mappings={KeyW:'forward',ArrowUp:'forward',KeyS:'reverse',ArrowDown:'reverse',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
window.addEventListener('keydown',event=>{
  const buttonTarget=event.target instanceof Element&&!!event.target.closest('button,a,input,textarea,select');
  if(event.code==='Space'&&buttonTarget)return;
  if((screen==='playing'&&(mappings[event.code]||event.code==='Space'))||['Escape','KeyP','KeyR'].includes(event.code))event.preventDefault();
  audio.unlock();
  advanceSimulation();
  if(mappings[event.code]){if(screen==='playing'){keys.add(event.code);agentEnabled=false;}return;}
  if(event.repeat)return;
  if(event.code==='Space'){if(screen==='playing'){toggleBeam(game);handleEvents();}else if(screen==='menu'&&event.target===document.body)launch();}
  else if(event.code==='Escape'||event.code==='KeyP'){if(screen==='manual')closeManual();else pause();}
  else if(event.code==='KeyR'&&['playing','paused','result'].includes(screen))launch();
  else if(event.code==='KeyM')toggleSound();
  else if(event.code==='KeyH')screen==='manual'?closeManual():openManual();
});
window.addEventListener('keyup',e=>{if(mappings[e.code]){advanceSimulation();keys.delete(e.code);}});
window.addEventListener('blur',()=>{if(evaluationMode){advanceSimulation();keys.clear();}else{pause();releaseInput();}});
document.addEventListener('visibilitychange',()=>{if(evaluationMode)advanceSimulation();else if(document.hidden&&screen==='playing')pause();});
window.addEventListener('resize',()=>renderer.resize());
function toggleSound(){audio.setMuted(!audio.muted);soundButton();try{localStorage.setItem('orbital-salvage-muted',String(audio.muted));}catch{}}
$('sound-button').addEventListener('click',toggleSound);
$('launch-button').addEventListener('click',()=>launch());$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',pause);
$('retry-button').addEventListener('click',()=>launch());$('restart-paused').addEventListener('click',()=>launch());
$('exit-paused').addEventListener('click',toMenu);$('result-menu').addEventListener('click',toMenu);
$('next-mission').addEventListener('click',()=>launch(MISSIONS[Math.min(MISSIONS.length-1,MISSIONS.findIndex(m=>m.id===selected)+1)].id));
$('brand').addEventListener('click',e=>{e.preventDefault();if(screen==='playing')pause();else toMenu();});
for(const id of ['help-button','manual-link'])$(id).addEventListener('click',openManual);
for(const id of ['close-manual','manual-ready'])$(id).addEventListener('click',closeManual);
document.querySelectorAll('[data-control]').forEach(button=>{
  const control=button.dataset.control;
  button.addEventListener('pointerdown',e=>{if(screen!=='playing')return;e.preventDefault();advanceSimulation();button.setPointerCapture(e.pointerId);keys.add(control);agentEnabled=false;audio.unlock();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{advanceSimulation();keys.delete(control);});
});
$('touch-beam').addEventListener('click',()=>{advanceSimulation();if(screen==='playing'){toggleBeam(game);handleEvents();}});
// Keep keyboard focus inside modal dialogs without trapping normal flight input.
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const dialog=screen==='manual'?$('manual-screen'):screen==='paused'?$('pause-screen'):screen==='result'?$('result-screen'):null;
  if(!dialog)return;const buttons=[...dialog.querySelectorAll('button:not([hidden]):not(:disabled)')],first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});

// An optional controller seam; no learning, networking, or training machinery.
// act() sets held analog controls. Tractor is an edge action, never auto-repeated.
window.orbitalSalvage=Object.freeze({
  version:2,
  observe:()=>{advanceSimulation();return {...observe(game),screen,mode:evaluationMode?'evaluation':'practice'};},
  act(action={}){advanceSimulation();if(screen!=='playing')return;agentEnabled=true;agentAction={turn:clamp(Number(action.turn)||0,-1,1),thrust:clamp(Number(action.thrust)||0,-.55,1)};if(action.tractor){toggleBeam(game);handleEvents();}},
  reset:(mission='first',seed)=>launch(mission,seed),
  pause:()=>{if(screen==='playing')pause();},
  resume:()=>{if(screen==='paused')pause();},
});
function advanceSimulation(now=performance.now()){
  const elapsed=Math.max(0,(now-last)/1000);last=Math.max(last,now);
  if(screen==='playing'){
    acc+=elapsed;
    while(acc+1e-10>=DT&&screen==='playing'){stepGame(game,agentEnabled?agentAction:keyboardInput(),DT);acc=Math.max(0,acc-DT);handleEvents();}
    hudTimer+=elapsed;if(hudTimer>.08){hudTimer=0;updateHud();}
  }
}
function frame(now){
  // Physics catches up all elapsed time; only visual effects cap their delta.
  advanceSimulation(performance.now());
  const delta=Math.min(.1,Math.max(0,(now-lastVisual)/1000));lastVisual=now;
  if(screen==='menu'){
    // Attract scene: the debris keeps moving while the contracts are displayed.
    for(const a of game.asteroids){a.x+=a.vx*delta;a.y+=a.vy*delta;a.angle+=a.spin*delta;}
    for(const c of game.cargo){c.x+=c.vx*delta;c.y+=c.vy*delta;c.angle+=c.spin*delta;}
  }
  const animated=screen==='playing'||screen==='menu';renderer.update(game,animated?delta:0,screen==='menu');renderer.render(game,screen==='menu',!animated);
  if(notifyUntil&&renderer.time>notifyUntil){$('notification').classList.remove('visible');notifyUntil=0;}
  audio.update(game.ship.thrust,screen==='playing');
  requestAnimationFrame(frame);
}
// Hidden tabs may throttle this timer. observe()/act() also catch up before use,
// charging suspended time to the previous held action rather than the new one.
if(evaluationMode)setInterval(()=>advanceSimulation(),50);
renderMissions();renderer.reset(game,true);document.body.dataset.screen='menu';requestAnimationFrame(frame);
