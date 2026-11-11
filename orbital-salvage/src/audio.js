export class AudioEngine {
  constructor(){this.context=null;this.muted=true;this.engine=null;this.engineGain=null;}
  unlock(){
    if(this.muted)return;
    try{
      if(!this.context){
        this.context=new (window.AudioContext||window.webkitAudioContext)();
        const osc=this.context.createOscillator(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
        osc.type='sawtooth';osc.frequency.value=48;filter.type='lowpass';filter.frequency.value=220;gain.gain.value=0;
        osc.connect(filter);filter.connect(gain);gain.connect(this.context.destination);osc.start();this.engine=osc;this.engineGain=gain;
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch{/* Sound is optional; unavailable audio never prevents flight. */}
  }
  setMuted(muted){this.muted=muted;if(!muted)this.unlock();if(this.engineGain&&muted)this.engineGain.gain.setTargetAtTime(0,this.context.currentTime,.03);}
  update(thrust,playing){if(!this.context)return;const t=this.context.currentTime;this.engineGain.gain.setTargetAtTime(!this.muted&&playing?Math.abs(thrust)*.035:0,t,.06);this.engine.frequency.setTargetAtTime(42+Math.abs(thrust)*28,t,.06);}
  tone(freq,duration=.12,type='sine',volume=.06,delay=0,endFreq=freq){
    if(this.muted||!this.context)return;const ctx=this.context,t=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duration+.03);
  }
  event(type){
    if(type==='attach'){this.tone(220,.2,'sine',.07,0,660);this.tone(440,.15,'sine',.025,.08,880);}
    else if(type==='release'||type==='snap')this.tone(440,.17,'sine',.04,0,140);
    else if(type==='delivery'){[523,659,784,1047].forEach((f,i)=>this.tone(f,.24,'sine',.05,i*.08));}
    else if(type==='collision')this.tone(95,.17,'triangle',.11,0,28);
    else if(type==='gust-warning'){this.tone(330,.18,'sine',.03);this.tone(330,.18,'sine',.03,.3);}
    else if(type==='end'){[392,523,659,784].forEach((f,i)=>this.tone(f,.4,'sine',.045,i*.13));}
  }
}
