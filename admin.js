/* Painel Multi-ID • Vercel 1.0 com aprovação manual • Sem firmware. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const nodes = {login:$('login-section'), dashboard:$('dashboard'), error:$('login-error'), toast:$('action-toast')};
  const time = n => {n=Math.max(0,Math.floor(Number(n)||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  let latest=null, running=false, errorUntil=0;

  async function api(path, body){
    const options = {cache:'no-store',credentials:'same-origin'};
    if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
    const res=await fetch(path,options);
    let data={};try{data=await res.json();}catch(_){throw Error('Resposta inválida da API.');}
    if(!res.ok)throw Error(data.error||'Erro de comunicação com o servidor.');
    return data;
  }
  function notify(msg,error=false){nodes.toast.textContent=msg;nodes.toast.classList.toggle('error',error);errorUntil=Date.now()+4500;}
  function setLogged(logged){nodes.login.hidden=logged;nodes.dashboard.hidden=!logged;}
  function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;}
  function statusLabel(s){return ({pending:'PENDENTE',ack:'NO TRANSMISSOR',received:'RECEBIDO',superseded:'SUBSTITUÍDO',failed:'FALHA'})[s]||'AGUARDANDO';}
  function colorName(rx){return rx.mode==='auto'&&rx.phase?'Ciclo · '+({green:'verde',yellow:'amarelo',red:'vermelho'}[rx.phase]||rx.phase):rx.lights.red?'Vermelho aceso':rx.lights.yellow?'Amarelo aceso':rx.lights.green?'Verde aceso':rx.payload?'Luzes desligadas':'Aguardando comando';}

  function queueItem(q){
    const item=el('div','queue-item');
    const who=el('div','queue-user');
    who.append(el('div','queue-rank',String(q.position)));
    const meta=el('div');meta.append(el('b','',q.name),el('small','',`Tempo restante na fila: ${time(q.waiting_left)}`));who.append(meta);
    const actions=el('div','queue-actions');
    const btnApprove=el('button','btn-approve','Aprovar');btnApprove.type='button';btnApprove.dataset.action='approve';btnApprove.dataset.id=q.id;
    btnApprove.disabled=Boolean(latest?.active);
    const btnReject=el('button','btn-reject','Recusar');btnReject.type='button';btnReject.dataset.action='reject';btnReject.dataset.id=q.id;
    actions.append(btnApprove,btnReject);item.append(who,actions);
    return item;
  }
  function renderLog(entry){
    const row=el('div','history-row');
    const person=el('div');person.append(el('strong','',entry.visitor),el('span','',entry.at));
    const target=el('div');target.append(el('strong','',entry.target_id),el('code','',entry.payload));
    const state=el('div');state.append(el('span','history-status',statusLabel(entry.state)));
    row.append(person,target,state);return row;
  }
  function station(prefix,targetId,rx){
    const card=document.querySelector(`.admin-station[data-id="${targetId}"]`);
    if(!card)return;
    for(const c of ['red','yellow','green'])card.querySelector('.admin-lamp.'+c).classList.toggle('lit',Boolean(rx.lights[c]));
    $('station-'+prefix+'-state').textContent=rx.known?colorName(rx):'Estado desconhecido';
    card.querySelector('.status-micro').textContent=rx.recovering?'RESET':rx.online?'ONLINE':'OFFLINE';
    $('station-'+prefix+'-mode').textContent=rx.mode==='auto'?'CICLO AUTOMÁTICO':'MODO MANUAL';
    $('station-'+prefix+'-payload').textContent='RDS · '+(rx.payload||'—');
    $('station-'+prefix+'-delivery').textContent=statusLabel(rx.command.state)+' · RSSI '+(rx.rssi??'—')+' · RESETS '+(rx.resets??'—');
  }
  function render(data){
    latest=data;
    $('metric-queue').textContent=String(data.summary.queue);
    $('metric-active').textContent=data.active?'Em uso':'Livre';
    $('metric-commands').textContent=String(data.summary.commands);
    $('metric-uptime').textContent=time(data.summary.elapsed);
    $('queue-count').textContent=`${data.queue.length} ${data.queue.length===1?'PESSOA':'PESSOAS'}`;
    $('queue-list').replaceChildren(...(data.queue.length?data.queue.map(queueItem):[el('p','muted','Nenhum visitante na fila.')]));
    $('approve-next').disabled=Boolean(data.active)||!data.queue.length;
    $('reject-all').disabled=!data.queue.length;
    $('session-badge').textContent=data.active?'● OCUPADO':'● LIVRE';
    $('session-badge').classList.toggle('state-active',Boolean(data.active));
    $('active-name').textContent=data.active?data.active.name:'Nenhum visitante ativo';
    $('active-message').textContent=data.active?'Este visitante pode controlar SEM-001 e SEM-002.':'Aprove alguém da fila para iniciar uma demonstração.';
    $('active-timer').textContent=time(data.active?.control_left??90);
    $('end-session').disabled=!data.active;
    station('a','SEM-001',data.receivers['SEM-001']);
    station('b','SEM-002',data.receivers['SEM-002']);
    $('history-list').replaceChildren(...(data.logs.length?data.logs.map(renderLog):[el('p','muted','Nenhum comando ainda.')]));
    $('connection-pill').innerHTML='<i></i> CONECTADO À NUVEM';
    if(Date.now()>errorUntil)nodes.toast.textContent='';
  }
  async function refresh(){
    if(running)return;
    running=true;
    try{
      render(await api('/api/admin/state'));
      setLogged(true);
    }catch(err){
      if(/login|restrito|Faça login/i.test(err.message))setLogged(false);
      else { $('connection-pill').textContent='○ NUVEM OFFLINE';notify('Falha de sincronização: '+err.message,true); }
    }finally{running=false;}
  }
  async function act(path,body={},success='Ação concluída.'){
    try{await api(path,body);notify(success);await refresh();}
    catch(err){notify(err.message,true);}
  }
  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();nodes.error.textContent='';
    const pin=$('admin-pin').value.trim();
    try{await api('/api/admin/login',{pin});$('admin-pin').value='';setLogged(true);refresh();}
    catch(err){nodes.error.textContent=err.message;}
  });
  $('logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{});}finally{setLogged(false);}});
  $('queue-list').addEventListener('click', e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    const path=btn.dataset.action;
    const id=btn.dataset.id;
    if(path==='approve')act('/api/admin/approve',{id},'Visitante aprovado. A sessão de 90 segundos começou.');
    if(path==='reject')act('/api/admin/reject',{id},'Solicitação recusada.');
  });
  $('approve-next').addEventListener('click',()=>{
    const first=latest?.queue?.[0];if(!first)return;
    act('/api/admin/approve',{id:first.id},'Próximo visitante aprovado.');
  });
  $('reject-all').addEventListener('click',()=>{
    if(confirm('Recusar todas as solicitações aguardando?'))act('/api/admin/reject-all',{},'Fila recusada.');
  });
  $('end-session').addEventListener('click',()=>{
    if(confirm('Encerrar agora a sessão do visitante ativo?'))act('/api/admin/revoke',{},'Sessão encerrada pelo expositor.');
  });
  $('reset-signals').addEventListener('click',()=>{
    if(confirm('Limpar histórico? Não desliga os relés. A sessão ativa será mantida.'))
      act('/api/admin/reset-signals',{},'Histórico limpo.');
  });
  $('reset-demo').addEventListener('click',()=>{
    if(confirm('Encerrar sessão e fila? Não desliga fisicamente as lâmpadas.'))
      act('/api/admin/reset-demo',{},'Fila e sessão encerradas.');
  });
  api('/api/admin/status').then(s=>{setLogged(s.authenticated);if(s.authenticated)refresh();}).catch(()=>setLogged(false));
  setInterval(()=>{if(!nodes.dashboard.hidden)refresh();},1200);
})();
