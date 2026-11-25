/* IFAC Rádio em Movimento • Tutorial Radinho v2 — spotlight isolado do site.
   O tour usa simulação isolada no navegador e não altera a fila real do Supabase. */
(function () {
  'use strict';
  const root = document.getElementById('tutorial-root');
  if (!root) return;

  // Quatro cortinas criam um recorte real sem alterar o z-index do conteúdo do site.
  // Isso evita que os painéis da página encubram o mascote ou o balão.
  const shades = ['top','left','right','bottom'].map(side => {
    const el = document.createElement('div');
    el.className = 'tutorial-shade tutorial-shade-' + side;
    el.hidden = true;
    root.appendChild(el);
    return el;
  });
  const frame = document.createElement('div');
  frame.className = 'tutorial-focus-frame';
  frame.hidden = true;
  root.appendChild(frame);

  const mascot = document.createElement('div');
  mascot.className = 'tutorial-mascot bounce';
  mascot.innerHTML = `
    <div class="mascot-body" aria-hidden="true">
      <div class="mascot-shadow"></div><div class="mascot-arms"></div>
      <div class="mascot-hand"></div><div class="mascot-legs mascot-shoes"></div>
      <div class="mascot-radio">
        <div class="mascot-face"><span class="mascot-eye"></span><span class="mascot-eye"></span><span class="mascot-smile"></span></div>
        <div class="mascot-speaker"></div><div class="mascot-knob"></div>
        <div class="mascot-label">RDS</div>
      </div>
    </div>`;
  mascot.hidden = true;
  root.appendChild(mascot);

  const card = document.createElement('div');
  card.className = 'tutorial-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'Tutorial do Radinho');
  card.innerHTML = `
    <div class="tutorial-chip"><span class="dot"></span> Rádio-guia do experimento</div>
    <h3 id="tutorial-title"></h3><p id="tutorial-text"></p>
    <div class="tutorial-step-counter" id="tutorial-counter"></div>
    <div class="tutorial-actions">
      <div class="tutorial-actions-left"><button type="button" class="tutorial-btn link" id="tutorial-skip">Pular</button></div>
      <div class="tutorial-actions-right">
        <button type="button" class="tutorial-btn secondary" id="tutorial-prev">Voltar</button>
        <button type="button" class="tutorial-btn primary" id="tutorial-next">Próximo</button>
      </div>
    </div>`;
  card.hidden = true;
  root.appendChild(card);
  const $ = id => card.querySelector('#' + id);
  const title = $('tutorial-title');
  const detail = $('tutorial-text');
  const count = $('tutorial-counter');
  const back = $('tutorial-prev');
  const nextBtn = $('tutorial-next');
  const skip = $('tutorial-skip');

  const steps = [
    {
      selector: '.hero-copy h1',
      title: 'Olá! Eu sou o Radinho! 📻',
      text: 'Bem-vindo ao CONCT&T! Hoje você vai controlar DOIS semáforos usando uma mesma experiência. Eu vou ensinar como escolher o lugar certo antes de enviar o comando pelo rádio.',
      place: 'right'
    },
    {
      selector: '#id-concept',
      title: 'Um sinal de rádio, vários endereços!',
      text: 'Pense como cartas com destinatário: o comando terá um ID, como SEM-001 ou SEM-002. Cada receptor reconhece o próprio ID e ignora comandos destinados a outros. Neste tutorial, tudo é simulado.',
      place: 'top'
    },
    {
      selector: '.how-steps',
      title: 'Qual caminho o comando percorre?',
      text: 'Site → servidor e fila → ESP32 → transmissor Si4713 → FM-RDS → receptores Si4703 + ESP8266. Os firmwares filtram o ID. Neste tutorial, não enviamos comandos físicos.',
      place: 'top'
    },
    {
      selector: '#name',
      title: 'Primeiro, diga como quer ser chamado.',
      text: 'Digite um nome ou apelido. O expositor poderá organizar a fila sem pedir e-mail ou cadastro.',
      place: 'right',
      enter() {
        const n = document.getElementById('name');
        if (n && !n.value) n.value='Visitante do CONCT&T';
      }
    },
    {
      selector: '#join',
      title: 'Agora vamos pedir acesso.',
      text: 'Uma pessoa por vez controla os dois semáforos durante sua sessão. Vou simular o seu pedido sem conectar à Vercel, Supabase ou ao hardware.',
      place: 'right',
      async leaveNext() {await window.__ifacDemo?.request?.();}
    },
    {
      selector: '#wait-area',
      title: 'Você entrou na fila!',
      text: 'Aqui fica sua posição, o tempo de espera e a opção de cancelar. Na exposição, o responsável aprova no painel administrativo da Vercel. Durante este tour, o Radinho demonstra a aprovação fictícia ao avançar, sem mexer na fila real.',
      place: 'right',
      leaveNext() {window.__ifacDemo?.activateNow?.();}
    },
    {
      selector: '#active-area .timer',
      title: 'Acesso liberado! ✨',
      text: 'Sua sessão tem 90 segundos. Nesse período, você escolhe para qual localização enviar cada comando. Durante o tutorial, o cronômetro fica pausado para você ler com calma.',
      place: 'right'
    },
    {
      selector: '#station-selector',
      title: 'Aqui você escolhe o destino.',
      text: 'Existem duas localizações: A (SEM-001) e B (SEM-002). A seleção define qual receptor receberá seu próximo comando. Vou começar pela Localização A.',
      place: 'right',
      enter() {window.__ifacDemo?.selectTarget?.('SEM-001',false);}
    },
    {
      selector: '.button-grid',
      title: 'Vamos acender o VERDE da Localização A.',
      text: 'Repare no destino SEM-001. Estou simulando um comando verde para ele. A Localização B continuará exatamente como estava.',
      place: 'left',
      enter() {window.__ifacDemo?.send?.('green','SEM-001');}
    },
    {
      selector: '.station-card[data-station="SEM-001"]',
      title: 'Olhe o semáforo A! 🚦',
      text: 'Este painel representa o receptor SEM-001. Ele exibe a luz, o código RDS e a confirmação simulada da mensagem. Observe também o painel B ao lado: ele não recebeu este comando.',
      place: 'left'
    },
    {
      selector: '.target-btn[data-target="SEM-002"]',
      title: 'Agora vamos trocar para a Localização B.',
      text: 'Veja: o sistema permite selecionar outro identificador SEM-002 sem interromper o estado anterior do semáforo A. Na próxima etapa, vou mandar a cor vermelha para B.',
      place: 'right',
      enter() {window.__ifacDemo?.selectTarget?.('SEM-002',false);}
    },
    {
      selector: '.button-grid',
      title: 'Vermelho somente para B!',
      text: 'Agora o comando vermelho leva o ID SEM-002. O resultado esperado: A permanece verde e B passa para vermelho. Dois destinos, controles independentes!',
      place: 'left',
      enter() {window.__ifacDemo?.send?.('red','SEM-002');}
    },
    {
      selector: '#dual-stations',
      title: 'Dois semáforos, duas respostas!',
      text: 'Observe os dois estados lado a lado: A verde e B vermelho. Essa é a demonstração da separação lógica por identificador. No rádio real, os comandos teriam de ser transmitidos e filtrados por ID.',
      place: 'left'
    },
    {
      selector: '.cycle-card',
      title: 'O ciclo também é individual.',
      text: 'No tutorial você pode programar os tempos do ciclo para o destino selecionado; no controle físico, o receptor atualizado executa o ciclo por até 90 segundos. Um ciclo em B não altera o funcionamento de A. São estados independentes no simulador.',
      place: 'left'
    },
    {
      selector: '#payload-lesson',
      title: 'Como o ID viajaria com o comando?',
      text: 'A ideia é combinar “ID do destinatário + comando”. Por exemplo: SEM-002 com o código 000011 (vermelho). Este é um desenho de protocolo, não uma codificação FM-RDS já implementada.',
      place: 'top'
    },
    {
      selector: '.connection-grid',
      title: 'E centenas de semáforos?',
      text: 'O princípio permite pensar em muitos IDs. Mas capacidade, atraso, confiabilidade e número máximo de dispositivos ainda precisam ser testados. Aqui demonstramos o comportamento de dois destinos no tutorial.',
      place: 'top'
    },
    {
      selector: '.how-steps',
      title: 'Pronto! Você já sabe controlar por ID! 🎉',
      text: 'QR Code → acesso → escolher A ou B → enviar comando → mensagem endereçada → receptor correspondente. Agora você pode testar livremente e mostrar ao professor como a interface separa os destinos.',
      place: 'top'
    }
  ];

  let active = false;
  let index = 0;
  let busy = false;
  let layoutScheduled = false;
  let currentTarget = null;
  let delayedFocus = null;
  let lastFocus = null;

  function setRect(el, x, y, w, h) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = Math.max(0, Math.round(w)) + 'px';
    el.style.height = Math.max(0, Math.round(h)) + 'px';
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function layout() {
    layoutScheduled = false;
    if (!active) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const target = currentTarget;
    let hole = null;
    if (target && target.getClientRects().length) {
      const rect = target.getBoundingClientRect();
      const pad = 10;
      const x = clamp(rect.left - pad, 0, W);
      const y = clamp(rect.top - pad, 0, H);
      const right = clamp(rect.right + pad, 0, W);
      const bottom = clamp(rect.bottom + pad, 0, H);
      if (right > x && bottom > y) hole = {x, y, w:right-x, h:bottom-y};
    }
    if (hole) {
      setRect(shades[0], 0, 0, W, hole.y);
      setRect(shades[1], 0, hole.y, hole.x, hole.h);
      setRect(shades[2], hole.x + hole.w, hole.y, W - (hole.x + hole.w), hole.h);
      setRect(shades[3], 0, hole.y + hole.h, W, H - hole.y - hole.h);
      setRect(frame, hole.x, hole.y, hole.w, hole.h);
      frame.hidden = false;
    } else {
      setRect(shades[0], 0, 0, W, H);
      for (const s of shades.slice(1)) setRect(s,0,0,0,0);
      frame.hidden = true;
    }

    const mobile = W <= 860;
    if (mobile) {
      // O balão fica preso na parte inferior da janela e não acompanha a rolagem.
      card.style.left = '16px';
      card.style.top = 'auto';
      const cr = card.getBoundingClientRect();
      const mx = clamp(hole ? hole.x + hole.w / 2 - 45 : 20, 10, Math.max(10,W-110));
      const my = clamp((cr.top || H-300)-105, 4, H-160);
      mascot.style.left = mx + 'px';
      mascot.style.top = my + 'px';
      return;
    }
    const cr = card.getBoundingClientRect();
    const cw = cr.width || 380;
    const ch = cr.height || 280;
    const step = steps[index];
    const pad = 22;
    let x = hole ? hole.x + hole.w + 36 : 170;
    let y = hole ? hole.y + hole.h/2 - ch/2 : 80;
    if (hole && step.place === 'left') x = hole.x - cw - 36;
    if (hole && step.place === 'top') {
      x = hole.x + (hole.w-cw)/2;
      y = hole.y - ch - 34;
      if (y < 20) y = hole.y + hole.h + 24;
    }
    if (x < pad || x + cw > W - pad) {
      x = W - cw - pad;
      if (hole && x < hole.x + hole.w + 12 && x + cw > hole.x - 12) {
        y = hole.y > ch + 32 ? hole.y - ch - 24 : Math.min(H-ch-20,hole.y+hole.h+24);
      }
    }
    x = clamp(x, pad, Math.max(pad,W-cw-pad));
    y = clamp(y, 18, Math.max(18,H-ch-18));
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    mascot.style.left = clamp(x - 120, 10, W-140) + 'px';
    mascot.style.top = clamp(y + 25, 10, H-145) + 'px';
  }
  function scheduleLayout() {
    if (layoutScheduled) return;
    layoutScheduled = true;
    requestAnimationFrame(layout);
  }

  function centerTarget(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const mobile = window.innerWidth <= 860;
    const desiredTop = mobile ? Math.max(65, vh*.23 - Math.min(rect.height*.25,65)) : Math.max(75, vh*.38 - Math.min(rect.height*.5,120));
    const y = window.scrollY + rect.top - desiredTop;
    window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
  }
  function show(indexToShow) {
    if (!active) return;
    index = clamp(indexToShow,0,steps.length-1);
    const step=steps[index];
    currentTarget = document.querySelector(step.selector);
    title.textContent = step.title;
    detail.textContent = step.text;
    count.textContent = `ETAPA ${index+1} DE ${steps.length}`;
    back.disabled = index===0;
    back.style.visibility = index===0 ? 'hidden' : 'visible';
    nextBtn.textContent = index===steps.length-1 ? 'Concluir' : 'Próximo';
    if (typeof step.enter === 'function') step.enter();
    centerTarget(currentTarget);
    scheduleLayout();
    // A rolagem é assíncrona: redesenha o recorte após o movimento.
    if (delayedFocus) clearTimeout(delayedFocus);
    delayedFocus=setTimeout(scheduleLayout,450);
  }
  function start() {
    if (active) return;
    lastFocus = document.activeElement;
    active = true;
    window.__ifacTourActive = true;
    for (const s of shades) s.hidden = false;
    mascot.hidden = false;
    card.hidden = false;
    document.body.classList.add('tutorial-active');
    window.__ifacDemo?.reset?.();
    show(0);
    nextBtn.focus({preventScroll:true});
  }
  function stop() {
    if (!active) return;
    active = false;
    window.__ifacTourActive = false;
    for (const s of shades) s.hidden=true;
    mascot.hidden = true;
    card.hidden = true;
    frame.hidden=true;
    document.body.classList.remove('tutorial-active');
    try { localStorage.setItem('ifac_tutorial_seen_dual_v3','1'); } catch (_) {}
    window.__ifacDemo?.continueWithoutTour?.();
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({preventScroll:true});
  }
  async function next() {
    if (busy) return;
    const step=steps[index];
    if (index===steps.length-1) {stop();return;}
    busy=true;nextBtn.disabled=true;
    try {
      if (typeof step.leaveNext === 'function') await step.leaveNext();
      show(index+1);
    } catch (err) {
      detail.textContent = 'Não foi possível avançar: ' + (err?.message||String(err)) + '. Tente novamente.';
    } finally {
      busy=false;nextBtn.disabled=false;
      nextBtn.focus({preventScroll:true});
    }
  }
  back.addEventListener('click',()=>{if(!busy && index>0) show(index-1)});
  nextBtn.addEventListener('click',next);
  skip.addEventListener('click',stop);
  document.getElementById('start-tour')?.addEventListener('click',start);
  window.addEventListener('scroll',scheduleLayout,{passive:true});
  window.addEventListener('resize',scheduleLayout);
  document.addEventListener('keydown',e=>{
    if(!active) return;
    if(e.key==='Escape') {e.preventDefault();stop();}
    if(e.key==='ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey){e.preventDefault();next();}
    if(e.key==='ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey){e.preventDefault();if(index>0)show(index-1);}
  });

  setTimeout(()=>{
    let seen = false;
    try{seen = localStorage.getItem('ifac_tutorial_seen_dual_v3')==='1';}catch(_){}
    if ((window.IFAC_RDS_CONFIG||{}).tutorialAutoStart && !seen) start();
  },850);
})();
