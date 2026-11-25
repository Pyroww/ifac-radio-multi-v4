/* CONCT&T IFAC • Radinho Multi-ID Vercel 1.0 + administração na nuvem.
   Fila e comandos: API serverless na Vercel + persistência no Supabase.
   Tutorial Radinho: simulação isolada no navegador para explicar os passos.
   Integração física fora do tutorial; estados por telemetria USB. */
'use strict';
const $ = id => document.getElementById(id);
const DEMO_MODE = false;
let latestSharedState = null;
const inTour = () => Boolean(window.__ifacTourActive);
const state = { status:null, sending:false, flashUntil:0, selectedTarget:'SEM-001' };
const TARGETS = Object.freeze({
  'SEM-001': {name:'Localização A',short:'A',prefix:'a'},
  'SEM-002': {name:'Localização B',short:'B',prefix:'b'},
});
const time = seconds => {
  const s=Math.max(0,Math.floor(Number(seconds)||0));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
const emptyLights = () => ({red:false,yellow:false,green:false});
const makeReceiver = id => ({
  id, payload:'', lights:emptyLights(), mode:'manual', phase:'',
  command:{state:null}, timers:[], autoTimer:null, sequence:0,
});
const demo = {
  status:'idle', userName:'Visitante', requestedAt:0, activeAt:0,
  waitingTotal:300, activeTotal:90, waitingTimer:null,
  receivers:{'SEM-001':makeReceiver('SEM-001'),'SEM-002':makeReceiver('SEM-002')},
  lastOperation:null,
};
function notify(message,error=false){
  const el=$('toast'); if (!el) return;
  el.textContent=message;
  el.classList.toggle('error',error);
  state.flashUntil=Date.now()+6500;
}
function clearReceiverTimers(rx){
  rx.sequence++;
  rx.timers.forEach(clearTimeout);rx.timers=[];
  if(rx.autoTimer!==null){clearTimeout(rx.autoTimer);rx.autoTimer=null;}
}
function clearAllTimers(){
  if(demo.waitingTimer!==null){clearTimeout(demo.waitingTimer);demo.waitingTimer=null;}
  Object.values(demo.receivers).forEach(clearReceiverTimers);
}
function resetDemo(){
  clearAllTimers();
  demo.status='idle';demo.requestedAt=0;demo.activeAt=0;demo.lastOperation=null;
  for(const id of Object.keys(TARGETS))demo.receivers[id]=makeReceiver(id);
  selectTarget('SEM-001',false);
  refresh();
}
function scheduleDemoActivation(){
  if(demo.waitingTimer!==null)clearTimeout(demo.waitingTimer);
  demo.waitingTimer=setTimeout(()=>{
    demo.waitingTimer=null;
    if(demo.status==='waiting' && !window.__ifacTourActive){
      activateNow();
      notify('O expositor aprovou seu acesso (simulação). Você pode escolher o destino A ou B!');
    }
  },3500);
}
function activateNow(){
  if(demo.waitingTimer!==null){clearTimeout(demo.waitingTimer);demo.waitingTimer=null;}
  demo.status='active';demo.activeAt=Date.now();refresh();
}
function getDemoState(){
  let waiting_left=demo.waitingTotal,control_left=demo.activeTotal;
  if(demo.status==='waiting'){
    waiting_left=Math.max(0,demo.waitingTotal-Math.floor((Date.now()-demo.requestedAt)/1000));
    if(waiting_left===0){demo.status='expired';clearAllTimers();}
  }
  if(demo.status==='active'){
    if(window.__ifacTourActive){control_left=demo.activeTotal;}
    else {
      control_left=Math.max(0,demo.activeTotal-Math.floor((Date.now()-demo.activeAt)/1000));
      if(control_left===0){demo.status='finished';clearAllTimers();}
    }
  }
  return {status:demo.status,position:demo.status==='waiting'?1:null,
    waiting_left,control_left,
    receivers:demo.receivers,lastOperation:demo.lastOperation};
}
function lightsFromKind(kind){
  return {red:kind==='red',yellow:kind==='yellow',green:kind==='green'};
}
function colorPayload(kind){
  return ({red:'000011',yellow:'001100',green:'110000',off:'000000'})[kind];
}
function startAutomaticCycle(rx,values,token){
  const phases=[
    {color:'green',sec:values.green},
    {color:'yellow',sec:values.yellow},
    {color:'red',sec:values.red},
  ];
  let index=0;
  function tick(){
    if(rx.sequence!==token||demo.status!=='active')return;
    const p=phases[index++%3];
    rx.mode='auto';rx.phase=p.color;rx.lights=lightsFromKind(p.color);
    if(inTour())update(getDemoState());
    rx.autoTimer=setTimeout(tick,p.sec*1000);
  }
  tick();
}
function simulateTargetDelivery(id,payload,lights,cycle=null){
  const rx=demo.receivers[id];
  clearReceiverTimers(rx);
  const token=rx.sequence;
  rx.command={id,payload,state:'pending',target_id:id};
  rx.mode=cycle?'auto':'manual';rx.phase='';
  demo.lastOperation={target_id:id,payload,state:'pending',sequence:token};
  const schedule=(delay,fn)=>rx.timers.push(setTimeout(()=>{
    if(rx.sequence!==token||demo.status!=='active')return;
    fn();if(inTour())update(getDemoState());
  },delay));
  schedule(600,()=>{
    rx.command.state='ack';
    if(demo.lastOperation?.target_id===id&&demo.lastOperation.sequence===token)demo.lastOperation.state='ack';
  });
  schedule(1450,()=>{
    rx.command.state='received';rx.payload=payload;
    if(cycle)startAutomaticCycle(rx,cycle,token);
    else rx.lights={...lights};
    if(demo.lastOperation?.target_id===id&&demo.lastOperation.sequence===token)demo.lastOperation.state='received';
  });
}
async function previewApi(path,body={}){
  // Fluxo isolado do Radinho: a aprovação é fictícia e não entra na fila do administrador.
  switch(path){
    case '/api/state':return getDemoState();
    case '/api/request':
      if(!['idle','finished','expired','rejected','cancelled','revoked','disconnected'].includes(demo.status))throw Error('Você já está na fila ou controlando a estação.');
      clearAllTimers();
      demo.userName=String(body.name||'Visitante').slice(0,30);
      demo.status='waiting';demo.requestedAt=Date.now();
      if(!window.__ifacTourActive)scheduleDemoActivation();
      return {ok:true};
    case '/api/cancel':
      clearAllTimers();demo.status='cancelled';return {ok:true};
    case '/api/command':{
      if(demo.status!=='active')throw Error('Aguarde a aprovação da sessão antes de enviar comandos.');
      const id=body.target_id;
      if(!Object.hasOwn(TARGETS,id))throw Error('Identificador do destino inválido.');
      let payload,lights=emptyLights(),cycle=null;
      if(body.kind==='auto'){
        cycle={};
        for(const c of ['green','yellow','red']){
          const n=Number(body[c]);
          if(!Number.isInteger(n)||n<2||n>30)throw Error('Os tempos devem estar entre 2 e 30 segundos.');
          cycle[c]=n;
        }
        payload=`t${String(cycle.green).padStart(2,'0')}${String(cycle.yellow).padStart(2,'0')}${String(cycle.red).padStart(2,'0')}`;
      }else{
        payload=colorPayload(body.kind);
        if(!payload)throw Error('Comando não reconhecido.');
        lights=lightsFromKind(body.kind);
      }
      simulateTargetDelivery(id,payload,lights,cycle);
      return {payload,target_id:id,simulation:true};
    }
    default:throw Error('Operação desconhecida no simulador local.');
  }
}
async function api(path,body={}){
  if(inTour())return previewApi(path,body);
  const options={cache:'no-store',credentials:'same-origin'};
  if(path!=='/api/state'){
    options.method='POST';
    options.headers={'Content-Type':'application/json'};
    options.body=JSON.stringify(body);
  }
  let response;
  try {response=await fetch(path,options);}
  catch(_) {throw Error('Não foi possível acessar o serviço na Vercel. Verifique a conexão.');}
  const data=await response.json().catch(()=>({error:'Resposta inesperada do servidor na Vercel.'}));
  if(!response.ok)throw Error(data.error||'Falha na comunicação com a nuvem.');
  return data;
}
function selectTarget(id,showNotice=true){
  if(!Object.hasOwn(TARGETS,id))return;
  state.selectedTarget=id;
  const meta=TARGETS[id];
  document.querySelectorAll('.target-btn').forEach(btn=>{
    const selected=btn.dataset.target===id;
    btn.classList.toggle('selected',selected);
    btn.setAttribute('aria-pressed',String(selected));
  });
  document.querySelectorAll('.station-card').forEach(card=>card.classList.toggle('selected',card.dataset.station===id));
  $('selected-target-label').textContent=`${meta.name.toUpperCase()} • ${id}`;
  $('command-target').textContent=`${meta.name.toUpperCase()} • ${id}`;
  $('frame-target').textContent=id;
  const rx=(inTour()?demo.receivers:latestSharedState?.receivers)?.[id];
  $('frame-command').textContent=rx?.payload||'—';
  updateControls();
  if(showNotice)notify(`Destino selecionado: ${meta.name} (${id}). O próximo comando será destinado somente a ele.`);
}
function renderReceiver(id,rx){
  const prefix=TARGETS[id].prefix;
  const colors=['red','yellow','green'];
  for(const color of colors){
    $(prefix+'-'+color).classList.toggle('lit',Boolean(rx.lights[color]));
  }
  const label=rx.mode==='auto'&&rx.phase?`Ciclo · ${({red:'vermelho',yellow:'amarelo',green:'verde'})[rx.phase]}`:
    rx.lights.red?'Vermelho aceso':rx.lights.yellow?'Amarelo aceso':rx.lights.green?'Verde aceso':rx.payload?'Luzes desligadas':'Aguardando comando';
  $(prefix+'-state').textContent=inTour()||rx.known?label:(rx.recovering?'Recuperando rádio':'Estado desconhecido');
  document.querySelector(`.station-card[data-station="${id}"] .station-health`).textContent=inTour()?'● SIMULADO':rx.recovering?'◷ RESET':rx.online?'● ONLINE':'○ OFFLINE';
  $(prefix+'-payload').textContent='RDS · '+(rx.payload||'—');
  const status=({pending:'NA FILA DE TRANSMISSÃO',ack:inTour()?'TRANSMISSOR SIMULADO':'CARREGADO NO TX',received:inTour()?'RECEBIDO NA SIMULAÇÃO':'CONFIRMADO PELO RX',failed:'FALHA / TEMPO LIMITE'})[rx.command.state]||'AGUARDANDO';
  const el=$(prefix+'-delivery');el.textContent=status;el.classList.toggle('received',rx.command.state==='received');
  $(prefix+'-mode').textContent=rx.mode==='auto'?'CICLO AUTOMÁTICO':'MODO MANUAL';
}
function update(j){
  state.status=j.status;
  const waiting=j.status==='waiting',active=j.status==='active';
  const resolved=['expired','rejected','finished','disconnected','cancelled','revoked'].includes(j.status);
  $('idle-area').hidden=waiting||active||resolved;
  $('wait-area').hidden=!waiting;
  $('active-area').hidden=!active;
  $('result-area').hidden=!resolved;
  const titles={idle:'Solicite seu acesso',waiting:'Você está na fila',active:'Controle liberado!',expired:'Tempo de espera expirado',rejected:'Solicitação recusada',finished:'Sua experiência terminou',cancelled:'Solicitação cancelada',disconnected:'Sessão encerrada',revoked:'Sessão encerrada pelo expositor'};
  $('status-title').textContent=titles[j.status]||'Experiência FM-RDS';
  const badge=$('state-badge');
  badge.textContent=active?'● LIBERADO':waiting?'◷ AGUARDANDO':resolved?'CONCLUÍDO':'● DISPONÍVEL';
  badge.classList.toggle('state-active',active);
  badge.classList.toggle('state-wait',waiting);
  badge.classList.toggle('state-end',resolved);
  if(waiting){
    $('position').textContent=j.position??'—';
    $('waiting-left').textContent=time(j.waiting_left);
    $('wait-message').textContent=inTour()?'No tutorial, o Radinho simulará a aprovação na próxima etapa.':`Sua posição atual é ${j.position||'—'}. Aguarde o expositor aprovar pelo painel administrativo.`;
    $('waiting-progress').style.width=`${Math.max(0,Math.min(100,(Number(j.waiting_left)||0)/300*100))}%`;
  }
  if(active)$('control-left').textContent=time(j.control_left);
  if(resolved){
    const messages={expired:'Seu pedido saiu automaticamente da fila após cinco minutos.',rejected:'Solicitação recusada.',finished:'Obrigado por participar! Você participou da experiência FM-RDS.',cancelled:'Solicitação ou sessão cancelada.',disconnected:'Sessão encerrada por desconexão.',revoked:'O expositor encerrou a sessão.'};
    $('result-text').textContent=messages[j.status]||'';
  }
  $('join').disabled=false;
  $('mode-badge').textContent=inTour()?'TUTORIAL GUIADO':'FM-RDS ONLINE + ADMIN';
  $('tx-health').textContent=inTour()?'● SIMULADO':j.hardware?.tx_online?'● ONLINE':'○ OFFLINE';
  $('rx-health').textContent=inTour()?'● A + B SIMULADOS':`A: ${j.receivers['SEM-001'].online?'ON':'OFF'} · B: ${j.receivers['SEM-002'].online?'ON':'OFF'}`;
  updateControls();
  for(const id of Object.keys(TARGETS))renderReceiver(id,j.receivers[id]);
  const op=j.lastOperation;
  const labels={pending:'aguardando transmissor',ack:'entregue ao transmissor',received:'recebido pelo destino',failed:'falha / tempo limite'};
  $('delivery-state').textContent=op?`${op.target_id}: ${labels[op.state]||'em processamento'}${inTour()?' (simulado)':''}`:'Nenhum comando enviado';
  $('frame-command').textContent=j.receivers[state.selectedTarget].payload||'—';
  if(Date.now()>state.flashUntil)$('toast').textContent='';
}
async function refresh(){
  const wasTour=inTour();
  try{
    const data=await api('/api/state');
    if(wasTour!==inTour())return;
    if(!wasTour)latestSharedState=data;
    update(data);
  }catch(e){if(wasTour===inTour()){if(!wasTour){latestSharedState=null;updateControls();$('tx-health').textContent='○ NUVEM OFFLINE';$('rx-health').textContent='ESTADO DESCONHECIDO';}notify(e.message,true);}}
}
async function act(path,body={}){
  try{await api(path,body);await refresh()}catch(e){notify(e.message,true)}
}
function updateControls(){
  const ready=inTour()?demo.status==='active':latestSharedState?.status==='active'&&latestSharedState.hardware?.tx_online&&latestSharedState.receivers?.[state.selectedTarget]?.online&&!latestSharedState.hardware?.busy;
  document.querySelectorAll('.command').forEach(el=>el.disabled=state.sending||!ready);
  $('auto').disabled=state.sending||!inTour()||!ready;
}
async function sendCommand(body){
  if(state.sending)return;
  if(!inTour() && body.kind==='auto'){notify('Ciclo disponível somente no tutorial.',true);return;}
  state.sending=true;
  // Captura o destinatário no momento do clique, não após alguma atualização da tela.
  const dest=body.target_id||state.selectedTarget;
  const command={...body,target_id:dest};
  document.querySelectorAll('.command,#auto').forEach(el=>el.disabled=true);
  try{
    const res=await api('/api/command',command);
    notify(`${inTour()?'TUTORIAL':'COMANDO ENFILEIRADO'}: comando ${res.payload} destinado a ${res.target_id}. A outra localização não será alterada.`);
    await refresh();
  }catch(e){notify(e.message,true)}
  finally{state.sending=false;updateControls()}
}
$('join').onclick=()=>act('/api/request',{name:$('name').value||'Visitante'});
$('name').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click()});
$('cancel').onclick=()=>act('/api/cancel');
$('finish').onclick=()=>act('/api/cancel');
$('again').onclick=()=>act('/api/request',{name:$('name').value||'Visitante'});
document.querySelectorAll('.target-btn').forEach(btn=>btn.addEventListener('click',()=>selectTarget(btn.dataset.target)));
document.querySelectorAll('.station-card').forEach(card=>card.addEventListener('click',()=>selectTarget(card.dataset.station)));
document.querySelectorAll('.command').forEach(btn=>btn.onclick=()=>sendCommand({kind:btn.dataset.kind}));
$('auto').onclick=()=>{
  const body={kind:'auto'};
  for(const k of ['green','yellow','red']){
    const el=$(`${k}-sec`),n=Number(el.value);
    if(!Number.isInteger(n)||n<2||n>30){notify('Informe tempos inteiros entre 2 e 30 segundos.',true);el.focus();return;}
    body[k]=n;
  }
  sendCommand(body);
};
window.__ifacDemo = {
  enabled:true,
  reset:resetDemo,
  activateNow,
  continueWithoutTour(){clearAllTimers();refresh();},
  request(){return act('/api/request',{name:$('name').value||'Visitante'});},
  selectTarget,
  send(kind,id){return sendCommand({kind,target_id:id||state.selectedTarget});},
  sendAuto(){ $('auto').click();},
  sendCycle(green,yellow,red,id){return sendCommand({kind:'auto',green,yellow,red,target_id:id||state.selectedTarget});},
  getState:getDemoState,
  refresh,
};
selectTarget('SEM-001',false);
refresh();
setInterval(refresh,1000);
