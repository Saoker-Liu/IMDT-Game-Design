const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const root=document.documentElement;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
const storedMotion=(()=>{try{return localStorage.getItem('fogbound-site-motion');}catch{return null;}})();
let motionOn=storedMotion===null?!reducedMotion.matches:storedMotion==='on';
let demoPlaying=motionOn,demoVisible=false,demoTimer=null,currentStage=0,impactTimer=null;
let demoHovered=false,demoFocused=false;
root.classList.add('enhanced');

function setMotion(enabled,persist=false) {
  motionOn=enabled;
  root.dataset.motion=enabled?'on':'off';
  $('#motion-toggle').setAttribute('aria-pressed',String(enabled));
  $('#motion-toggle').setAttribute('aria-label',enabled?'关闭动态效果':'开启动态效果');
  $('#motion-toggle').title=enabled?'关闭动态效果':'开启动态效果';
  $('#motion-label').textContent=`动态 ${enabled?'开':'关'}`;
  if(persist)try{localStorage.setItem('fogbound-site-motion',enabled?'on':'off');}catch{}
  if(!enabled){$('#hero-media').style.removeProperty('--pointer-x');$('#hero-media').style.removeProperty('--pointer-y');}
  scheduleDemo();
}

const stageContent=[
  {name:'拨开迷雾',label:'侦察照亮局部海域，发现敌方巡洋舰',event:'CONTACT DETECTED'},
  {name:'虚实之间',label:'巡洋舰机动，原来的位置留下过期情报',event:'POSITION CHANGED'},
  {name:'一击定局',label:'主炮轰击命中巡洋舰三个部位，出现火焰与残骸',event:'TARGET NEUTRALIZED'},
];
function setStage(index,manual=false) {
  currentStage=(index+stageContent.length)%stageContent.length;
  const content=stageContent[currentStage],display=$('#tactical-display');
  display.classList.remove('impacting');
  display.dataset.stage=String(currentStage);
  display.setAttribute('aria-labelledby',['tab-recon','tab-move','tab-strike'][currentStage]);
  $('#demo-board').setAttribute('aria-label',content.label);
  $('#demo-event').textContent=content.event;
  $$('.tactic-tab').forEach((button,i)=>{
    const active=i===currentStage;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  });
  $$('.demo-card').forEach((button,i)=>{button.classList.toggle('selected',i===currentStage);button.setAttribute('aria-pressed',String(i===currentStage));});
  clearTimeout(impactTimer);
  if(currentStage===2&&motionOn){requestAnimationFrame(()=>display.classList.add('impacting'));impactTimer=setTimeout(()=>display.classList.remove('impacting'),1700);}
  if(manual){demoPlaying=false;$('#demo-announcement').textContent=`${content.name}：${content.label}`;}
  scheduleDemo();
}
function scheduleDemo() {
  clearTimeout(demoTimer);demoTimer=null;
  const active=motionOn&&demoPlaying&&demoVisible&&!document.hidden&&!demoHovered&&!demoFocused;
  $('#demo-play').setAttribute('aria-pressed',String(demoPlaying&&motionOn));
  $('#demo-play').setAttribute('aria-label',demoPlaying&&motionOn?'暂停自动演示':'播放自动演示');
  $('#demo-play').textContent=demoPlaying&&motionOn?'Ⅱ':'▷';
  document.body.classList.toggle('demo-paused',!active);
  if(active)demoTimer=setTimeout(()=>setStage(currentStage+1),6200);
}

$$('[data-stage]').filter(node=>node.matches('button')).forEach(button=>button.addEventListener('click',()=>setStage(Number(button.dataset.stage),true)));
$('.tactic-tabs').addEventListener('keydown',event=>{
  const offset={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
  if(offset===undefined&&!['Home','End'].includes(event.key))return;
  event.preventDefault();setStage(event.key==='Home'?0:event.key==='End'?2:currentStage+offset,true);$$('.tactic-tab')[currentStage].focus();
});
$('#demo-play').addEventListener('click',()=>{
  if(!motionOn){setMotion(true,true);demoPlaying=true;}else demoPlaying=!demoPlaying;
  scheduleDemo();
});
$('#motion-toggle').addEventListener('click',()=>{const enabled=!motionOn;demoPlaying=enabled;setMotion(enabled,true);});
$('#tactical-display').addEventListener('pointerenter',()=>{demoHovered=true;scheduleDemo();});
$('#tactical-display').addEventListener('pointerleave',()=>{demoHovered=false;scheduleDemo();});
$('#tactical-display').addEventListener('focusin',()=>{demoFocused=true;scheduleDemo();});
$('#tactical-display').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget)){demoFocused=false;scheduleDemo();}});
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.hidden);scheduleDemo();});
reducedMotion.addEventListener('change',event=>{demoPlaying=!event.matches;setMotion(!event.matches);});

const fleet={
  carrier:{name:'航空母舰',code:'CV',category:'AIRCRAFT CARRIER',line:'掌握天空，照亮未知。',alt:'航空母舰俯视微缩模型，木质飞行甲板与舰载机',width:1024,height:352},
  battleship:{name:'战列舰',code:'BB',category:'BATTLESHIP',line:'主炮所指，胜负所在。',alt:'战列舰俯视微缩模型，厚重装甲与多座主炮',width:512,height:92},
  cruiser:{name:'巡洋舰',code:'CG',category:'CRUISER',line:'进退有度，攻守兼备。',alt:'巡洋舰俯视微缩模型，木甲板与金属舰桥',width:512,height:102},
  destroyer:{name:'驱逐舰',code:'DD',category:'DESTROYER',line:'转进之间，鱼雷出鞘。',alt:'驱逐舰俯视微缩模型，修长舰体与鱼雷武装',width:384,height:86},
  frigate:{name:'护卫舰',code:'FF',category:'FRIGATE',line:'身形轻巧，落子有声。',alt:'护卫舰俯视微缩模型，紧凑舰体与小型舰桥',width:256,height:99},
};
let fleetRequest=0,selectedFleet='carrier';
async function selectFleet(type) {
  if(!fleet[type])return;
  const request=++fleetRequest,info=fleet[type],image=$('#fleet-hero-ship');
  if(selectedFleet===type){image.classList.remove('changing');return;}
  const next=new Image();next.src=`../assets/fleet-${type}.webp`;
  try{await next.decode();}catch{if(request===fleetRequest)image.classList.remove('changing');return;}
  if(request!==fleetRequest)return;
  image.classList.add('changing');
  if(motionOn)await new Promise(resolve=>setTimeout(resolve,170));
  if(request!==fleetRequest)return;
  selectedFleet=type;
  $('.fleet-stage').dataset.ship=type;image.src=next.src;image.alt=info.alt;image.width=info.width;image.height=info.height;
  $('#fleet-monogram').textContent=info.code;$('#fleet-class').textContent=`${info.code} / ${info.category}`;
  $('#fleet-name').textContent=info.name;$('#fleet-line').textContent=info.line;
  $$('[data-fleet]').forEach(button=>{const selected=button.dataset.fleet===type;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
  requestAnimationFrame(()=>image.classList.remove('changing'));
}
$$('[data-fleet]').forEach(button=>button.addEventListener('click',()=>selectFleet(button.dataset.fleet)));
$$('[data-map]').forEach(link=>link.addEventListener('click',()=>{try{localStorage.setItem('fogbound-map',link.dataset.map);}catch{}}));

function setMenu(open) {
  $('#site-header').classList.toggle('menu-open',open);$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#menu-toggle').setAttribute('aria-label',open?'收起导航':'展开导航');
}
$('#menu-toggle').addEventListener('click',()=>setMenu($('#menu-toggle').getAttribute('aria-expanded')!=='true'));
$('#main-nav').addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const wasOpen=$('#menu-toggle').getAttribute('aria-expanded')==='true';setMenu(false);if(wasOpen)$('#menu-toggle').focus();}});
document.addEventListener('click',event=>{if(!$('#site-header').contains(event.target))setMenu(false);});

if('IntersectionObserver' in window) {
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');reveal.unobserve(entry.target);}},{threshold:.12});
  $$('[data-reveal]').forEach(element=>{if(element.getBoundingClientRect().top<innerHeight*.92)element.classList.add('is-visible');else element.classList.add('will-reveal');reveal.observe(element);});
  const activity=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target.id==='tactical-display'){demoVisible=entry.isIntersecting;scheduleDemo();}if(entry.target.id==='home')document.body.classList.toggle('hero-out-of-view',!entry.isIntersecting);}},{threshold:.12});
  activity.observe($('#tactical-display'));activity.observe($('#home'));
  const sectionObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){$$('#main-nav a').forEach(link=>{if(link.hash===`#${entry.target.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}},{rootMargin:'-15% 0px -55% 0px'});
  $$('main>section[id]').forEach(section=>sectionObserver.observe(section));
}else{$$('[data-reveal]').forEach(element=>element.classList.add('is-visible'));demoVisible=true;}

let scrollFrame=0;
function updateScroll(){scrollFrame=0;const y=scrollY;$('#site-header').classList.toggle('scrolled',y>32);const maximum=document.documentElement.scrollHeight-innerHeight;$('#reading-progress').style.transform=`scaleX(${maximum>0?Math.max(0,Math.min(1,y/maximum)):0})`;}
addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScroll);},{passive:true});
addEventListener('resize',()=>{updateScroll();if(innerWidth>600)setMenu(false);},{passive:true});
let pointerFrame=0,pointerX=0,pointerY=0;
$('#home').addEventListener('pointermove',event=>{
  if(!motionOn||!finePointer.matches)return;
  const bounds=event.currentTarget.getBoundingClientRect();pointerX=(event.clientX/bounds.width-.5)*-10;pointerY=((event.clientY-bounds.top)/bounds.height-.5)*-7;
  if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;$('#hero-media').style.setProperty('--pointer-x',`${pointerX.toFixed(2)}px`);$('#hero-media').style.setProperty('--pointer-y',`${pointerY.toFixed(2)}px`);});
});
$('#home').addEventListener('pointerleave',()=>{$('#hero-media').style.setProperty('--pointer-x','0px');$('#hero-media').style.setProperty('--pointer-y','0px');});
updateScroll();setMotion(motionOn);setStage(0);
