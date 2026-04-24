import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

/* ── constants ── */
const MAP = 3200;
const SPEED = 230;
const BOT_N = 29;
const BOT_NAMES = [
  "SnipKing","ZeroGrip","LegendPNM","GhostShot","NikoFr","SkyFall","BlazeX",
  "MrParis","LordStorm","AceHunter","DarkWave","CryptoKid","QuickFire","IronFox",
  "ShadowBr","ToxicAim","NinjaGold","StormRush","ColdBlood","RedPeak","WildCard",
  "DeathCall","PhantomX","GrindMode","BulletX","NightOwl","SilentKill","RageBot","ProLegend",
];

type WType = "pistol"|"rifle"|"shotgun";
const WEAPONS: Record<WType,{dmg:number;rate:number;range:number;ammo:number;spread:number;auto:boolean}> = {
  pistol:  {dmg:35, rate:700,  range:420, ammo:12, spread:0.04, auto:false},
  rifle:   {dmg:22, rate:140,  range:700, ammo:30, spread:0.06, auto:true},
  shotgun: {dmg:18, rate:900,  range:220, ammo:5,  spread:0.25, auto:false},
};
const STORM_PHASES = [
  {dur:90,  r:1500, dmg:0},
  {dur:70,  r:1000, dmg:1},
  {dur:55,  r:650,  dmg:2},
  {dur:40,  r:350,  dmg:4},
  {dur:30,  r:100,  dmg:8},
];

/* ── types ── */
interface Bot {x:number;y:number;angle:number;hp:number;shield:number;alive:boolean;
  name:string;weapon:WType;ammo:number;lastShot:number;state:"wander"|"engage"|"flee";
  tx:number;ty:number;stateTimer:number;skin:string;}
interface Bullet {x:number;y:number;vx:number;vy:number;dmg:number;range:number;
  traveled:number;owner:number;w:WType;}
interface Loot {x:number;y:number;w:WType;ammo:number;taken:boolean;}
interface MapObj {x:number;y:number;w:number;h:number;type:"building"|"tree"|"rock";r?:number;}
interface KFeed {killer:string;victim:string;t:number;}

/* ── map gen ── */
function rng(seed:number){let s=seed;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
function genMap(){
  const r=rng(42);
  const objs:MapObj[]=[];
  for(let i=0;i<18;i++) objs.push({x:200+r()*2800,y:200+r()*2800,w:80+r()*200,h:80+r()*180,type:"building"});
  for(let i=0;i<28;i++) objs.push({x:r()*MAP,y:r()*MAP,w:0,h:0,type:"tree",r:18+r()*22});
  for(let i=0;i<20;i++) objs.push({x:r()*MAP,y:r()*MAP,w:0,h:0,type:"rock",r:12+r()*18});
  const loots:Loot[]=[];
  const wlist:WType[]=["pistol","rifle","shotgun"];
  for(let i=0;i<40;i++){
    const w=wlist[Math.floor(r()*3)] as WType;
    loots.push({x:80+r()*(MAP-160),y:80+r()*(MAP-160),w,ammo:WEAPONS[w].ammo*2,taken:false});
  }
  return {objs,loots};
}
function collidesRect(x:number,y:number,o:MapObj):boolean{
  if(o.type==="building") return x>o.x-16&&x<o.x+o.w+16&&y>o.y-16&&y<o.y+o.h+16;
  const rr=(o.r||20)+16;return Math.hypot(x-o.x,y-o.y)<rr;
}
function safePos(objs:MapObj[],r2:()=>number):{x:number;y:number}{
  for(let t=0;t<100;t++){
    const x=200+r2()*(MAP-400),y=200+r2()*(MAP-400);
    if(objs.every(o=>!collidesRect(x,y,o))) return{x,y};
  }
  return{x:MAP/2,y:MAP/2};
}
const {objs:MAP_OBJS,loots:MAP_LOOTS}=genMap();
const SPAWN_RNG=rng(99);

/* ── init bots ── */
function makeBots(playerName:string,pSkin:string):Bot[]{
  const skins=["beige","medium","tan","brown","dark","light","ebony"];
  return BOT_NAMES.slice(0,BOT_N).map((name,i)=>{
    const {x,y}=safePos(MAP_OBJS,SPAWN_RNG);
    return{x,y,angle:Math.random()*Math.PI*2,hp:100,shield:0,alive:true,name,
      weapon:"pistol",ammo:12,lastShot:0,state:"wander",tx:x,ty:y,stateTimer:0,
      skin:skins[i%skins.length]};
  });
}

/* ── skin hex ── */
const SKINS:Record<string,string>={
  beige:"#F5C9A0",light:"#FFE0BD",medium:"#D4956A",tan:"#C68642",
  brown:"#8D5524",dark:"#5C3317",ebony:"#3B1F0A"};
const toHex=(s:string)=>SKINS[s]||s;

/* ── draw character (top-down circle) ── */
function drawEntity(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,
  skin:string,hp:number,shield:number,name:string,isPlayer:boolean){
  const r=14;const sc=toHex(skin);
  ctx.save();ctx.translate(x,y);
  // shadow
  ctx.beginPath();ctx.ellipse(2,4,r,r*0.6,0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.2)";ctx.fill();
  // body circle
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle=isPlayer?"#2979ff":sc;ctx.fill();
  ctx.strokeStyle=isPlayer?"#90caf9":"rgba(0,0,0,0.4)";ctx.lineWidth=2;ctx.stroke();
  // direction indicator
  ctx.beginPath();ctx.moveTo(0,0);
  ctx.lineTo(Math.cos(angle)*r*1.3,Math.sin(angle)*r*1.3);
  ctx.strokeStyle=isPlayer?"#fff":"rgba(255,255,255,0.7)";ctx.lineWidth=3;ctx.stroke();
  // gun tip
  ctx.beginPath();ctx.arc(Math.cos(angle)*r*1.3,Math.sin(angle)*r*1.3,3,0,Math.PI*2);
  ctx.fillStyle="#888";ctx.fill();
  ctx.restore();
  // health bar
  if(!isPlayer){
    const bw=28,bh=4,bx=x-bw/2,by=y-r-10;
    ctx.fillStyle="#1a1a1a";ctx.fillRect(bx,by,bw,bh);
    if(shield>0){ctx.fillStyle="#4fc3f7";ctx.fillRect(bx,by,bw*(shield/50),bh);}
    else{ctx.fillStyle=hp>60?"#4caf50":hp>30?"#ff9800":"#f44336";ctx.fillRect(bx,by,bw*(hp/100),bh);}
    ctx.strokeStyle="#000";ctx.lineWidth=0.5;ctx.strokeRect(bx,by,bw,bh);
  }
  // name
  if(!isPlayer){
    ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(x-22,y-r-22,44,12);
    ctx.fillStyle="#eee";ctx.font="9px sans-serif";ctx.textAlign="center";
    ctx.fillText(name.slice(0,8),x,y-r-13);
  }
}

export default function BattleRoyale(){
  const [,navigate]=useLocation();
  const {player}=useAuth();
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<{
    px:number;py:number;pAngle:number;php:number;pShield:number;pAlive:boolean;
    pWeapon:WType;pAmmo:number;pLastShot:number;pReloading:boolean;pReloadAt:number;
    kills:number;bots:Bot[];bullets:Bullet[];loots:Loot[];
    storm:{cx:number;cy:number;r:number;tr:number;phase:number;phaseT:number;dmg:number};
    kfeed:KFeed[];keys:Set<string>;mouseX:number;mouseY:number;mouseDown:boolean;
    lastTime:number;gamePhase:"playing"|"dead"|"win";
  }|null>(null);
  const [ui,setUi]=useState({hp:100,shield:0,weapon:"pistol" as WType,ammo:12,
    kills:0,alive:1+BOT_N,stormT:STORM_PHASES[0].dur,phase:"playing" as "playing"|"dead"|"win",
    kfeed:[] as KFeed[]});

  const pName=player?.username||"Joueur";
  const pSkin=(player as any)?.skinColor||"beige";

  const init=useCallback(()=>{
    const bots=makeBots(pName,pSkin);
    const sp=safePos(MAP_OBJS,rng(77));
    stateRef.current={
      px:sp.x,py:sp.y,pAngle:0,php:100,pShield:0,pAlive:true,
      pWeapon:"pistol",pAmmo:12,pLastShot:0,pReloading:false,pReloadAt:0,
      kills:0,bots,bullets:[],loots:[...MAP_LOOTS.map(l=>({...l,taken:false}))],
      storm:{cx:MAP/2,cy:MAP/2,r:STORM_PHASES[0].r,tr:STORM_PHASES[0].r,phase:0,
        phaseT:STORM_PHASES[0].dur*1000,dmg:0},
      kfeed:[],keys:new Set(),mouseX:400,mouseY:300,mouseDown:false,lastTime:0,
      gamePhase:"playing",
    };
  },[pName,pSkin]);

  useEffect(()=>{
    init();
    const canvas=canvasRef.current;if(!canvas)return;
    const onKey=(e:KeyboardEvent,down:boolean)=>{
      const g=stateRef.current;if(!g)return;
      if(down) g.keys.add(e.key.toLowerCase());
      else g.keys.delete(e.key.toLowerCase());
      if(down&&e.key.toLowerCase()==="r"&&!g.pReloading){
        const w=WEAPONS[g.pWeapon];
        g.pReloading=true;g.pReloadAt=performance.now()+(w.rate*3);
      }
      if(down){
        if(e.key==="1") g.pWeapon="pistol";
        if(e.key==="2") g.pWeapon="rifle";
        if(e.key==="3") g.pWeapon="shotgun";
      }
    };
    const onMM=(e:MouseEvent)=>{
      const g=stateRef.current;if(!g)return;
      const rect=canvas.getBoundingClientRect();
      g.mouseX=e.clientX-rect.left;g.mouseY=e.clientY-rect.top;
    };
    const onMD=(e:MouseEvent)=>{const g=stateRef.current;if(g)g.mouseDown=e.button===0;};
    const onMU=(e:MouseEvent)=>{const g=stateRef.current;if(g&&e.button===0)g.mouseDown=false;};
    window.addEventListener("keydown",e=>onKey(e,true));
    window.addEventListener("keyup",e=>onKey(e,false));
    canvas.addEventListener("mousemove",onMM);
    canvas.addEventListener("mousedown",onMD);
    canvas.addEventListener("mouseup",onMU);

    let raf:number;
    function loop(ts:number){
      raf=requestAnimationFrame(loop);
      const g=stateRef.current;if(!g)return;
      const dt=g.lastTime?(ts-g.lastTime)/1000:0.016;
      g.lastTime=ts;
      if(g.gamePhase!=="playing")return;
      update(g,dt,ts,canvas!);
      render(g,canvas!,pName,pSkin);
    }
    raf=requestAnimationFrame(loop);
    return()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown",e=>onKey(e,true));
      window.removeEventListener("keyup",e=>onKey(e,false));
    };
  },[init,pName,pSkin]);

  function update(g:NonNullable<typeof stateRef.current>,dt:number,ts:number,canvas:HTMLCanvasElement){
    const cw=canvas.width,ch=canvas.height;
    // player aim
    const camX=g.px-cw/2,camY=g.py-ch/2;
    const wx=g.mouseX+camX,wy=g.mouseY+camY;
    g.pAngle=Math.atan2(wy-g.py,wx-g.px);

    // player move
    let dx=0,dy=0;
    if(g.keys.has("w")||g.keys.has("arrowup"))dy=-1;
    if(g.keys.has("s")||g.keys.has("arrowdown"))dy=1;
    if(g.keys.has("a")||g.keys.has("arrowleft"))dx=-1;
    if(g.keys.has("d")||g.keys.has("arrowright"))dx=1;
    if(dx||dy){const m=Math.hypot(dx,dy);dx/=m;dy/=m;}
    const nx=g.px+dx*SPEED*dt,ny=g.py+dy*SPEED*dt;
    const blocked=MAP_OBJS.filter(o=>o.type==="building").some(o=>collidesRect(nx,ny,o));
    if(!blocked){g.px=Math.max(16,Math.min(MAP-16,nx));g.py=Math.max(16,Math.min(MAP-16,ny));}

    // reload
    if(g.pReloading&&ts>=g.pReloadAt){
      g.pAmmo=WEAPONS[g.pWeapon].ammo;g.pReloading=false;
    }

    // player shoot
    const pw=WEAPONS[g.pWeapon];
    if(g.mouseDown&&!g.pReloading&&g.pAmmo>0&&ts-g.pLastShot>=pw.rate){
      g.pLastShot=ts;g.pAmmo--;
      const shots=g.pWeapon==="shotgun"?6:1;
      for(let i=0;i<shots;i++){
        const sp2=(Math.random()-0.5)*pw.spread;
        const ang=g.pAngle+sp2;
        g.bullets.push({x:g.px,y:g.py,vx:Math.cos(ang)*600,vy:Math.sin(ang)*600,
          dmg:pw.dmg,range:pw.range,traveled:0,owner:-1,w:g.pWeapon});
      }
      if(g.pAmmo<=0&&!g.pReloading){g.pReloading=true;g.pReloadAt=ts+pw.rate*3;}
    }

    // loot pickup
    for(const l of g.loots){
      if(!l.taken&&Math.hypot(g.px-l.x,g.py-l.y)<28){
        l.taken=true;g.pWeapon=l.w;g.pAmmo=l.ammo;g.pReloading=false;
      }
    }

    // storm update
    const st=g.storm;
    st.phaseT-=dt*1000;
    if(st.phaseT<=0){
      st.phase=Math.min(st.phase+1,STORM_PHASES.length-1);
      const np=STORM_PHASES[st.phase];
      st.tr=np.r;st.phaseT=np.dur*1000;st.dmg=np.dmg;
    }
    const shrinkSpeed=(st.r-st.tr)/(Math.max(st.phaseT,1)/1000)*dt;
    if(st.r>st.tr)st.r=Math.max(st.tr,st.r-Math.abs(shrinkSpeed));

    // storm damage player
    if(Math.hypot(g.px-st.cx,g.py-st.cy)>st.r&&st.dmg>0){
      g.php=Math.max(0,g.php-st.dmg*dt*20);
      if(g.php<=0&&g.pAlive){g.pAlive=false;g.gamePhase="dead";}
    }

    // bot update
    for(const bot of g.bots){
      if(!bot.alive)continue;
      bot.stateTimer-=dt;

      // state machine
      const distToPlayer=Math.hypot(bot.x-g.px,bot.y-g.py);
      if(bot.stateTimer<=0){
        if(distToPlayer<380) bot.state="engage";
        else if(bot.hp<25) bot.state="flee";
        else bot.state="wander";
        bot.stateTimer=1.5+Math.random()*2;

        if(bot.state==="wander"){
          // move toward storm center + random offset
          const offX=(Math.random()-0.5)*600,offY=(Math.random()-0.5)*600;
          bot.tx=st.cx+offX;bot.ty=st.cy+offY;
        }
      }

      let bDx=0,bDy=0;
      if(bot.state==="engage"){
        const toP=Math.atan2(g.py-bot.y,g.px-bot.x);
        bot.angle=toP;
        // strafe
        const perp=toP+Math.PI/2;
        bDx=Math.cos(perp)*0.5+Math.cos(toP)*0.3;
        bDy=Math.sin(perp)*0.5+Math.sin(toP)*0.3;
        // bot shoot
        const bw=WEAPONS[bot.weapon];
        if(distToPlayer<bw.range*1.1&&ts-bot.lastShot>=bw.rate&&bot.ammo>0){
          bot.lastShot=ts;bot.ammo--;
          const spread=(Math.random()-0.5)*0.18;
          g.bullets.push({x:bot.x,y:bot.y,vx:Math.cos(toP+spread)*560,
            vy:Math.sin(toP+spread)*560,dmg:bw.dmg,range:bw.range,
            traveled:0,owner:g.bots.indexOf(bot),w:bot.weapon});
          if(bot.ammo<=0)bot.ammo=bw.ammo;
        }
      } else if(bot.state==="flee"){
        const awayAngle=Math.atan2(bot.y-g.py,bot.x-g.px);
        bDx=Math.cos(awayAngle);bDy=Math.sin(awayAngle);
        bot.angle=awayAngle+Math.PI;
      } else {
        const toTx=bot.tx-bot.x,toTy=bot.ty-bot.y;
        const dist=Math.hypot(toTx,toTy);
        if(dist>20){bDx=toTx/dist;bDy=toTy/dist;bot.angle=Math.atan2(toTy,toTx);}
      }

      // storm avoidance
      const stormDist=Math.hypot(bot.x-st.cx,bot.y-st.cy);
      if(stormDist>st.r*0.85){
        const toC=Math.atan2(st.cy-bot.y,st.cx-bot.x);
        bDx+=Math.cos(toC)*2;bDy+=Math.sin(toC)*2;
        const m=Math.hypot(bDx,bDy)||1;bDx/=m;bDy/=m;
      }

      const bnx=bot.x+bDx*SPEED*0.75*dt,bny=bot.y+bDy*SPEED*0.75*dt;
      const bBlocked=MAP_OBJS.filter(o=>o.type==="building").some(o=>collidesRect(bnx,bny,o));
      if(!bBlocked){bot.x=Math.max(16,Math.min(MAP-16,bnx));bot.y=Math.max(16,Math.min(MAP-16,bny));}

      // bot loot pickup
      for(const l of g.loots){
        if(!l.taken&&Math.hypot(bot.x-l.x,bot.y-l.y)<28){l.taken=true;bot.weapon=l.w;bot.ammo=l.ammo;}
      }

      // storm damage bot
      if(stormDist>st.r&&st.dmg>0) bot.hp=Math.max(0,bot.hp-st.dmg*dt*25);
      if(bot.hp<=0&&bot.alive){
        bot.alive=false;
        g.kfeed.push({killer:"Storm",victim:bot.name,t:Date.now()});
      }
    }

    // bullet update
    for(let i=g.bullets.length-1;i>=0;i--){
      const b=g.bullets[i];
      const spd=Math.hypot(b.vx,b.vy)*dt;
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.traveled+=spd;

      // map bounds
      if(b.x<0||b.x>MAP||b.y<0||b.y>MAP){g.bullets.splice(i,1);continue;}
      if(b.traveled>=b.range){g.bullets.splice(i,1);continue;}

      // hit building
      if(MAP_OBJS.filter(o=>o.type==="building").some(o=>collidesRect(b.x,b.y,o))){
        g.bullets.splice(i,1);continue;
      }

      let hit=false;
      if(b.owner>=0&&g.pAlive){
        // bot bullet hits player
        if(Math.hypot(b.x-g.px,b.y-g.py)<16){
          if(g.pShield>0){g.pShield=Math.max(0,g.pShield-b.dmg);}
          else{g.php=Math.max(0,g.php-b.dmg);}
          if(g.php<=0&&g.pAlive){g.pAlive=false;g.gamePhase="dead";}
          hit=true;
        }
      } else if(b.owner===-1){
        // player bullet hits bot
        for(const bot of g.bots){
          if(!bot.alive)continue;
          if(Math.hypot(b.x-bot.x,b.y-bot.y)<16){
            if(bot.shield>0) bot.shield=Math.max(0,bot.shield-b.dmg);
            else bot.hp=Math.max(0,bot.hp-b.dmg);
            if(bot.hp<=0&&bot.alive){
              bot.alive=false;g.kills++;
              g.kfeed.push({killer:pName,victim:bot.name,t:Date.now()});
            }
            hit=true;break;
          }
        }
      }
      if(hit) g.bullets.splice(i,1);
    }

    // win check
    const alive=g.bots.filter(b=>b.alive).length;
    if(alive===0&&g.pAlive) g.gamePhase="win";

    // trim kill feed
    const now2=Date.now();
    g.kfeed=g.kfeed.filter(k=>now2-k.t<6000).slice(-6);

    // update UI every frame
    setUi({hp:g.php,shield:g.pShield,weapon:g.pWeapon,ammo:g.pAmmo,kills:g.kills,
      alive:alive+(g.pAlive?1:0),stormT:Math.ceil(st.phaseT/1000),
      phase:g.gamePhase,kfeed:[...g.kfeed]});
  }

  function render(g:NonNullable<typeof stateRef.current>,canvas:HTMLCanvasElement,
    pName:string,pSkin:string){
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const cw=canvas.width,ch=canvas.height;
    const camX=g.px-cw/2,camY=g.py-ch/2;
    ctx.clearRect(0,0,cw,ch);
    ctx.save();ctx.translate(-camX,-camY);

    // ground
    ctx.fillStyle="#3a7d44";ctx.fillRect(0,0,MAP,MAP);
    // grid
    ctx.strokeStyle="rgba(0,0,0,0.07)";ctx.lineWidth=1;
    for(let x=0;x<=MAP;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,MAP);ctx.stroke();}
    for(let y=0;y<=MAP;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(MAP,y);ctx.stroke();}
    // map border
    ctx.strokeStyle="#2d6235";ctx.lineWidth=8;ctx.strokeRect(0,0,MAP,MAP);

    // map objects
    for(const o of MAP_OBJS){
      if(o.type==="building"){
        ctx.fillStyle="#6b7280";ctx.fillRect(o.x,o.y,o.w,o.h);
        ctx.fillStyle="#9ca3af";ctx.fillRect(o.x+4,o.y+4,o.w-8,o.h-8);
        ctx.fillStyle="#4b5563";
        for(let wx=o.x+12;wx<o.x+o.w-12;wx+=20){
          for(let wy=o.y+12;wy<o.y+o.h-12;wy+=20){
            ctx.fillRect(wx,wy,10,10);
          }
        }
        ctx.strokeStyle="#374151";ctx.lineWidth=2;ctx.strokeRect(o.x,o.y,o.w,o.h);
      } else if(o.type==="tree"){
        const rr=o.r||20;
        ctx.beginPath();ctx.arc(o.x,o.y,rr*1.1,0,Math.PI*2);
        ctx.fillStyle="#1b4d2e";ctx.fill();
        ctx.beginPath();ctx.arc(o.x,o.y,rr,0,Math.PI*2);
        ctx.fillStyle="#2d7a3e";ctx.fill();
        ctx.beginPath();ctx.arc(o.x-rr*0.2,o.y-rr*0.2,rr*0.4,0,Math.PI*2);
        ctx.fillStyle="#3a9b52";ctx.fill();
      } else {
        const rr=o.r||15;
        ctx.beginPath();ctx.arc(o.x,o.y,rr,0,Math.PI*2);
        ctx.fillStyle="#9ca3af";ctx.fill();
        ctx.beginPath();ctx.arc(o.x-rr*0.2,o.y-rr*0.2,rr*0.3,0,Math.PI*2);
        ctx.fillStyle="#d1d5db";ctx.fill();
      }
    }

    // loot crates
    for(const l of g.loots){
      if(l.taken)continue;
      const icon=l.w==="pistol"?"🔫":l.w==="rifle"?"🪖":"💥";
      ctx.fillStyle="#92400e";ctx.fillRect(l.x-10,l.y-10,20,20);
      ctx.fillStyle="#fbbf24";ctx.fillRect(l.x-8,l.y-8,16,16);
      ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(icon,l.x,l.y+4);
    }

    // bullets
    for(const b of g.bullets){
      ctx.save();ctx.translate(b.x,b.y);
      ctx.rotate(Math.atan2(b.vy,b.vx));
      ctx.fillStyle=b.owner===-1?"#ffd700":"#ff6b6b";
      ctx.fillRect(-6,-1.5,12,3);
      ctx.restore();
    }

    // bots
    for(const bot of g.bots){
      if(!bot.alive)continue;
      drawEntity(ctx,bot.x,bot.y,bot.angle,bot.skin,bot.hp,bot.shield,bot.name,false);
    }

    // player
    if(g.pAlive) drawEntity(ctx,g.px,g.py,g.pAngle,pSkin,g.php,g.pShield,pName,true);

    // storm overlay
    const st=g.storm;
    ctx.save();
    ctx.beginPath();ctx.rect(0,0,MAP,MAP);
    ctx.arc(st.cx,st.cy,st.r,0,Math.PI*2,true);
    ctx.fillStyle="rgba(80,40,180,0.45)";ctx.fill();
    // storm border glow
    ctx.beginPath();ctx.arc(st.cx,st.cy,st.r,0,Math.PI*2);
    ctx.strokeStyle="rgba(150,100,255,0.8)";ctx.lineWidth=4;ctx.stroke();
    ctx.restore();

    ctx.restore();

    // minimap
    const mm=80,mmx=cw-mm-12,mmy=12;
    ctx.fillStyle="rgba(0,0,0,0.6)";ctx.fillRect(mmx,mmy,mm,mm);
    ctx.strokeStyle="#555";ctx.lineWidth=1;ctx.strokeRect(mmx,mmy,mm,mm);
    const scl=mm/MAP;
    // storm on minimap
    ctx.beginPath();ctx.arc(mmx+st.cx*scl,mmy+st.cy*scl,st.r*scl,0,Math.PI*2);
    ctx.strokeStyle="rgba(150,100,255,0.9)";ctx.lineWidth=1.5;ctx.stroke();
    // buildings
    for(const o of MAP_OBJS){
      if(o.type==="building"){ctx.fillStyle="#6b7280";ctx.fillRect(mmx+o.x*scl,mmy+o.y*scl,o.w*scl,o.h*scl);}
    }
    // bots
    for(const b2 of g.bots){
      if(!b2.alive)continue;
      ctx.beginPath();ctx.arc(mmx+b2.x*scl,mmy+b2.y*scl,2,0,Math.PI*2);
      ctx.fillStyle="#f44336";ctx.fill();
    }
    // player
    ctx.beginPath();ctx.arc(mmx+g.px*scl,mmy+g.py*scl,3,0,Math.PI*2);
    ctx.fillStyle="#4fc3f7";ctx.fill();
  }

  return (
    <div style={{position:"relative",width:"100vw",height:"100vh",overflow:"hidden",background:"#0a0a0a",cursor:"crosshair"}}>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight}
        style={{display:"block",width:"100%",height:"100%"}} />

      {/* HUD */}
      {ui.phase==="playing"&&(
        <>
          {/* Health bar */}
          <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",
            display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {/* Shield */}
              <div style={{width:180,height:12,background:"#1a1a2e",borderRadius:6,overflow:"hidden",border:"1px solid #555"}}>
                <div style={{height:"100%",width:`${ui.shield/50*100}%`,background:"#4fc3f7",borderRadius:6,
                  transition:"width 0.1s",boxShadow:"0 0 8px #4fc3f7"}} />
              </div>
              <span style={{color:"#4fc3f7",fontSize:12,fontWeight:"bold"}}>🛡 {ui.shield}</span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {/* Health */}
              <div style={{width:180,height:16,background:"#1a1a2e",borderRadius:8,overflow:"hidden",border:"1px solid #555"}}>
                <div style={{height:"100%",width:`${ui.hp}%`,borderRadius:8,transition:"width 0.1s",
                  background:ui.hp>60?"#4caf50":ui.hp>30?"#ff9800":"#f44336",
                  boxShadow:`0 0 10px ${ui.hp>60?"#4caf50":ui.hp>30?"#ff9800":"#f44336"}`}} />
              </div>
              <span style={{color:"#eee",fontSize:13,fontWeight:"bold"}}>❤️ {Math.ceil(ui.hp)}</span>
            </div>
          </div>

          {/* Weapon HUD */}
          <div style={{position:"absolute",bottom:20,right:20,background:"rgba(0,0,0,0.7)",
            padding:"10px 16px",borderRadius:10,border:"1px solid #333",color:"#eee",textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:"bold",textTransform:"capitalize"}}>{ui.weapon}</div>
            <div style={{fontSize:14,color:ui.ammo<=3?"#f44336":"#ffd700"}}>
              {ui.ammo} / {WEAPONS[ui.weapon].ammo}
            </div>
            <div style={{fontSize:11,color:"#888",marginTop:4}}>1·Pistol 2·Rifle 3·Shotgun R·Recharge</div>
          </div>

          {/* Top left: kills + alive */}
          <div style={{position:"absolute",top:12,left:12,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{background:"rgba(0,0,0,0.7)",padding:"6px 12px",borderRadius:6,
              color:"#ffd700",fontWeight:"bold",fontSize:13}}>
              ⚔️ {ui.kills} kills
            </div>
            <div style={{background:"rgba(0,0,0,0.7)",padding:"6px 12px",borderRadius:6,
              color:"#eee",fontSize:12}}>
              👥 {ui.alive} en vie
            </div>
            <div style={{background:"rgba(0,0,0,0.7)",padding:"6px 12px",borderRadius:6,
              color:ui.stormT<15?"#f44336":"#4fc3f7",fontSize:12}}>
              🌀 Tempête: {ui.stormT}s
            </div>
          </div>

          {/* Kill feed */}
          <div style={{position:"absolute",top:12,right:mm+24,display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
            {ui.kfeed.slice(-4).map((k,i)=>(
              <div key={i} style={{background:"rgba(0,0,0,0.65)",padding:"4px 10px",
                borderRadius:4,fontSize:12,color:"#eee",borderLeft:k.killer===pName?"3px solid #ffd700":"3px solid #f44336"}}>
                <span style={{color:k.killer===pName?"#ffd700":"#f44336"}}>{k.killer}</span>
                <span style={{color:"#888"}}> → </span>
                <span style={{color:k.victim===pName?"#f44336":"#eee"}}>{k.victim}</span>
              </div>
            ))}
          </div>

          {/* Movement hint */}
          <div style={{position:"absolute",bottom:20,left:20,color:"rgba(255,255,255,0.4)",fontSize:11}}>
            WASD — Déplacer · Clic — Tirer · R — Recharger
          </div>
        </>
      )}

      {/* Death screen */}
      {ui.phase==="dead"&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",
          alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
          <div style={{fontSize:52,fontWeight:900,color:"#f44336",textShadow:"0 0 40px #f44336"}}>
            ÉLIMINÉ
          </div>
          <div style={{color:"#aaa",fontSize:18}}>Tu as survécu avec {ui.kills} kills</div>
          <button style={{padding:"14px 40px",background:"#1565c0",color:"#fff",fontSize:18,
            fontWeight:"bold",borderRadius:8,border:"none",cursor:"pointer",marginTop:8}}
            onClick={()=>navigate("/lobby")}>
            Retour au Lobby
          </button>
          <button style={{padding:"10px 30px",background:"#333",color:"#fff",fontSize:14,
            borderRadius:8,border:"none",cursor:"pointer"}}
            onClick={init}>
            Rejouer
          </button>
        </div>
      )}

      {/* Win screen */}
      {ui.phase==="win"&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",
          alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
          <div style={{fontSize:42,fontWeight:900,color:"#ffd700",textShadow:"0 0 60px #ffd700",
            animation:"pulse 1s infinite",textAlign:"center"}}>
            🏆 VICTOIRE ROYALE 🏆
          </div>
          <div style={{color:"#fff",fontSize:22,fontWeight:"bold"}}>{pName}</div>
          <div style={{color:"#ffd700",fontSize:16}}>Kills : {ui.kills}</div>
          <button style={{padding:"14px 40px",background:"#ffd700",color:"#000",fontSize:18,
            fontWeight:"bold",borderRadius:8,border:"none",cursor:"pointer",marginTop:8}}
            onClick={()=>navigate("/lobby")}>
            Retour au Lobby
          </button>
        </div>
      )}

      {/* Back button */}
      <button style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,0.6)",
        color:"#aaa",border:"1px solid #444",borderRadius:6,padding:"6px 14px",
        cursor:"pointer",fontSize:13}}
        onClick={()=>navigate("/lobby")}>
        ✕ Quitter
      </button>
    </div>
  );
}
