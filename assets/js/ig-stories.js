// Instagram Stories Modal - Peacock Cosmetics
// Mobile-first, touch-friendly, ecommerce CTA, progress bars, timers
// Usage: include <script type="module" src="./assets/js/ig-stories.js"></script>
// The module auto-inicializa ao carregar e liga nos botões .story-avatar[data-story-index]

export function initInstagramStories(options = {}) {

  // Sistema de detecção de dispositivo para otimização de mídia
  const deviceDetection = {
    isMobile() {
      // Múltiplos critérios para detecção confiável
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isTablet = /ipad|tablet/i.test(userAgent) && window.innerWidth > 768;

      // Mobile se: (UA mobile OU tela pequena) E tem touch E não é tablet grande
      return (isMobileUA || isSmallScreen) && hasTouchScreen && !isTablet;
    },

    isTablet() {
      const userAgent = navigator.userAgent.toLowerCase();
      const isTabletUA = /ipad|tablet/i.test(userAgent);
      const isMediumScreen = window.innerWidth > 768 && window.innerWidth <= 1024;
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      return isTabletUA || (isMediumScreen && hasTouchScreen);
    },

    isDesktop() {
      return !this.isMobile() && !this.isTablet();
    },

    getOptimalMediaSize() {
      if (this.isMobile()) return 'mobile';
      if (this.isTablet()) return 'mobile'; // Tablets usam versão mobile para economizar banda
      return 'desktop';
    },

    getConnectionSpeed() {
      // Detecta velocidade de conexão quando disponível
      if ('connection' in navigator) {
        const conn = navigator.connection;
        if (conn.effectiveType) {
          // '4g', '3g', '2g', 'slow-2g'
          return conn.effectiveType;
        }
      }
      return 'unknown';
    },

    shouldUseHighQuality() {
      const speed = this.getConnectionSpeed();
      const isDesktop = this.isDesktop();
      const isFastConnection = ['4g'].includes(speed);

      // Alta qualidade apenas em desktop com conexão rápida ou conexão desconhecida (assumir boa)
      return isDesktop && (isFastConnection || speed === 'unknown');
    }
  };

  // Configuração principal após definir deviceDetection
  const cfg = {
    avatarsSelector: options.avatarsSelector || '.story-avatar',
    ctaHref: options.ctaHref || 'https://seguro.peacockcosmeticos.com.br/r/8EW2RKYL5W',
    product: options.product || getProductInfoFromPage(),
    stories: options.stories || getDefaultStories(),
    imageDurationMs: 3000,
  };


  // Carregador dinâmico do hls.js (para streaming em pedaços no mobile)
  async function ensureHlsJs() {
    try {
      if (window.Hls) return true;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js';
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
      return !!window.Hls;
    } catch (_) {
      return false;
    }
  }

  function canPlayHlsNatively(videoEl) {
    try { return !!videoEl?.canPlayType?.('application/vnd.apple.mpegurl'); } catch { return false; }
  }

  // Pré-carrega manifesto e primeiros segmentos (nível 0) para iniciar instantâneo
  async function prefetchHlsWarmup(masterUrl){
    try{
      if(!masterUrl || typeof masterUrl !== 'string') return;
      // master: foo_master.m3u8 -> variante baixa: foo_0.m3u8; 1ºs segmentos: foo_0_000.ts, foo_0_001.ts
      const v0 = masterUrl.replace('_master.m3u8','_0.m3u8');
      const s0 = masterUrl.replace('_master.m3u8','_0_000.ts');
      const s1 = masterUrl.replace('_master.m3u8','_0_001.ts');
      await Promise.allSettled([
        fetch(masterUrl, { credentials:'same-origin' }),
        fetch(v0, { credentials:'same-origin' }),
        fetch(s0, { credentials:'same-origin' }),
        fetch(s1, { credentials:'same-origin' })
      ]);
    }catch(_){/* silencioso */}
  }

  // Build modal once
  let state = {
    storyIndex: 0,
    itemIndex: 0,
    playing: false,
    timerId: null,
    timerStart: 0,
    timerRemaining: 0,
    currentDuration: 0,
    touchXStart: 0,
    touchYStart: 0,
    urgencyInterval: null,
    deadlineTs: null,
    loadingTimeoutId: null,
    loadToken: 0,
  };
  // Default sound state
  state.muted = false;


  const el = buildModal(cfg);
  document.body.appendChild(el.overlay);

  // Wire avatars + estado visto (persistncia)
  const seenSet = loadSeenSet();
  document.querySelectorAll(cfg.avatarsSelector).forEach((btn) => {
    const idx = parseInt(btn.getAttribute('data-story-index') || '0', 10);
    if (seenSet.has(idx)) btn.setAttribute('data-viewed', 'true');

    // Warmup HLS no primeiro toque (antes do clique)
    btn.addEventListener('pointerdown', () => {
      try {
        const story = cfg.stories[idx];
        const firstVid = story?.items?.find(it => it?.type === 'video' && (it.mobileHls || it.hls));
        if (firstVid) prefetchHlsWarmup(firstVid.mobileHls || firstVid.hls);
      } catch {}
    }, { passive: true });

    btn.addEventListener('click', () => openStory(idx));

    // Inicializar preview no círculo
    initAvatarPreview(btn, idx);
  });
  // Delegação defensiva: garante que cliques em .story-avatar sempre abram os stories
  document.addEventListener('click', (e) => {
    const btn = e.target && (e.target.closest ? e.target.closest(cfg.avatarsSelector) : null);
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-story-index') || '0', 10);
    openStory(idx);
  });


    // Abrir Stories ao clicar em blocos de confiança e estrelas
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const trigger = (target.closest && (
        target.closest('.trust-primary') ||
        target.closest('.reviews-mini') ||
        target.closest('img[alt="5 estrelas"]') ||
        target.closest('img[src*="stars-rating"]')
      ));
      if (!trigger) return;
      // Impede navegação inesperada em links internos desses blocos
      e.preventDefault();
      try { openStory(0, 0); }
      catch { const btn = document.querySelector('.story-avatar'); if (btn) btn.click(); }
    });

  // Inicializar preview nos círculos dos avatares
  function initAvatarPreview(avatarBtn, storyIndex) {
    try {
      const story = cfg.stories[storyIndex];
      if (!story) return;

      const img = avatarBtn.querySelector('img');
      if (!img) return;

      // Criar container para preview
      const previewContainer = document.createElement('div');
      previewContainer.className = 'story-preview-container';
      previewContainer.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: 999px;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
        transition: all 0.3s ease;
        background: rgba(0, 0, 0, 0.1);
      `;

      // Configurar preview baseado no tipo
      if (story.previewType === 'video' && story.thumbnail) {
        setupVideoPreview(previewContainer, story, img);
      } else if (story.previewType === 'slider' && story.items.length > 1) {
        setupSliderPreview(previewContainer, story, img);
      }

      // Adicionar container ao avatar
      const avatarParent = avatarBtn.querySelector('span') || avatarBtn;
      avatarParent.style.position = 'relative';
      avatarParent.appendChild(previewContainer);

      // Adicionar efeitos de hover e animações
      avatarBtn.addEventListener('mouseenter', () => {
        previewContainer.style.transform = 'scale(1.05)';
        previewContainer.style.filter = 'brightness(1.1)';

        // Animar ícones dentro do container
        const icons = previewContainer.querySelectorAll('div[style*="position: absolute"]');
        icons.forEach(icon => {
          icon.style.transform = 'scale(1.1)';
          icon.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        });
      });

      avatarBtn.addEventListener('mouseleave', () => {
        previewContainer.style.transform = 'scale(1)';
        previewContainer.style.filter = 'brightness(1)';

        // Restaurar ícones
        const icons = previewContainer.querySelectorAll('div[style*="position: absolute"]');
        icons.forEach(icon => {
          icon.style.transform = 'scale(1)';
          icon.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        });
      });

      // Animação de entrada suave
      previewContainer.style.opacity = '0';
      previewContainer.style.transform = 'scale(0.8)';

      setTimeout(() => {
        previewContainer.style.opacity = '1';
        previewContainer.style.transform = 'scale(1)';
      }, 100);

      // Adicionar animação de pulsação sutil para chamar atenção
      if (story.previewType === 'video' || (story.previewType === 'slider' && story.items.length > 1)) {
        const pulseAnimation = `
          @keyframes subtlePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }
        `;

        // Adicionar CSS da animação se não existir
        if (!document.querySelector('#pulse-animation-style')) {
          const style = document.createElement('style');
          style.id = 'pulse-animation-style';
          style.textContent = pulseAnimation;
          document.head.appendChild(style);
        }

        // Aplicar animação de pulsação ocasional
        setTimeout(() => {
          avatarBtn.style.animation = 'subtlePulse 2s ease-in-out infinite';

          // Parar animação após alguns ciclos
          setTimeout(() => {
            avatarBtn.style.animation = '';
          }, 8000);
        }, 2000);
      }

    } catch (error) {
      console.warn('Erro ao inicializar preview do avatar:', error);
    }
  }

  // Configurar preview de vídeo no círculo
  function setupVideoPreview(container, story, originalImg) {
    // Criar vídeo em miniatura (lazy)
    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 999px;
      opacity: 0;
      transition: all 0.4s ease;
      filter: brightness(0.8) contrast(1.1);
    `;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';

    // Usar versão ultra-otimizada para círculo (se disponível)
    const videoSrc = story.items[0]?.circle ||
      (deviceDetection.isMobile() ?
        story.items[0]?.mobile || story.items[0]?.src :
        story.items[0]?.src);

    // Lazy: só definir src quando visível
    video.dataset.src = videoSrc || '';

    const onVisible = (isVisible) => {
      if (isVisible) {
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.play?.().catch(() => {});
        }
      } else {
        try {
          video.pause?.();
          video.removeAttribute?.('src');
          const s = video.querySelector('source'); if (s) s.removeAttribute?.('src');
          video.load?.();
          if (originalImg) originalImg.style.visibility = '';
          video.style.opacity = 0;
        } catch {}
      }
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => onVisible(entry.isIntersecting));
    }, { rootMargin: '100px', threshold: 0.5 });
    io.observe(container);

    video.addEventListener('canplay', () => {
      if (originalImg) originalImg.style.visibility = 'hidden';
      video.style.opacity = 1;
    }, { once: true });

    // Indicador de vídeo
    const videoIcon = document.createElement('div');
    videoIcon.innerHTML = '▶';
    videoIcon.style.cssText = `
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
      color: #333;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      z-index: 2;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.5);
      transition: all 0.2s ease;
    `;

    container.appendChild(video);
    container.appendChild(videoIcon);

    // Carregar e reproduzir vídeo quando possível
    video.addEventListener('loadeddata', () => {
      video.currentTime = 1; // Pular para 1 segundo
      video.play().then(() => {
        video.style.opacity = '1';
      }).catch(() => {
        // Se falhar, manter imagem original
        video.style.display = 'none';
      });
    });

    // Pausar quando sair de vista (performance)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    });
    observer.observe(container);
  }

  // Configurar preview de slider no círculo
  function setupSliderPreview(container, story, originalImg) {
    // Indicador de múltiplos itens
    const sliderIndicator = document.createElement('div');
    sliderIndicator.style.cssText = `
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 2px;
      z-index: 2;
    `;

    // Criar dots para indicar quantidade de itens (máximo 5 dots)
    const itemCount = Math.min(story.items.length, 5);
    for (let i = 0; i < itemCount; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.8));
        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        border: 0.5px solid rgba(255,255,255,0.6);
        backdrop-filter: blur(2px);
        transition: all 0.2s ease;
      `;
      sliderIndicator.appendChild(dot);
    }

    // Adicionar ícone de múltiplos itens
    const multiIcon = document.createElement('div');
    multiIcon.innerHTML = '+';
    multiIcon.style.cssText = `
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
      color: #333;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      z-index: 2;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.5);
      transition: all 0.2s ease;
    `;

    container.appendChild(multiIcon);

    // Se tem mais de 5 itens, adicionar "+"
    if (story.items.length > 5) {
      const plus = document.createElement('div');
      plus.textContent = '+';
      plus.style.cssText = `
        color: white;
        font-size: 8px;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        margin-left: 2px;
      `;
      sliderIndicator.appendChild(plus);
    }

    container.appendChild(sliderIndicator);
  }

  // Public API for navigation
  function openStory(storyIdx, itemIdx = 0) {
    try { if (window.stopAllMediaGlobal) { window.stopAllMediaGlobal(); } } catch(e){}

    // Limpeza defensiva: parar qualquer mídia anterior fora do IG modal e fechar modal legacy
    try {
      const legacy = document.getElementById('stories-modal-v2');
      if (legacy) {
        legacy.querySelectorAll('video').forEach(v => {
          try {
            v.muted = true; v.volume = 0; v.pause && v.pause(); v.currentTime = 0;
            if (v.removeAttribute) v.removeAttribute('src');
            const s = v.querySelector('source'); if (s && s.removeAttribute) s.removeAttribute('src');
            if (v.load) v.load();
          } catch {}
        });
        legacy.style.display = 'none';
        legacy.innerHTML = '';
      }
      // Pausar/mutar todos os vídeos fora do IG modal
      document.querySelectorAll('video').forEach(v => {
        const inIg = v.closest && v.closest('#ig-stories-modal');
        if (!inIg) {
          try { v.muted = true; v.volume = 0; v.pause && v.pause(); v.currentTime = 0; } catch {}
        }
      });
    } catch {}

    state.storyIndex = clamp(storyIdx, 0, cfg.stories.length - 1);
    state.itemIndex = clamp(itemIdx, 0, cfg.stories[state.storyIndex].items.length - 1);
    fillBars();
    renderCurrentItem();
    showOverlay();
    startCurrentTimer();
    initUrgencyUI();
    // foco inicial no botc a f e3o fechar (acessibilidade)
    const closeBtn = el.overlay.querySelector('.ig-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
  }

  function nextItem() {
    const s = cfg.stories[state.storyIndex];
    if (state.itemIndex + 1 < s.items.length) {
      state.itemIndex += 1;
      updateBars();
      renderCurrentItem();
      startCurrentTimer();
    } else {
      nextStory();
    }
  }
  function prevItem() {
    if (state.itemIndex > 0) {
      state.itemIndex -= 1;
      updateBars();
      renderCurrentItem();
      startCurrentTimer();
    } else {
      prevStory(true); // jump to last item of previous story
    }
  }
  function nextStory() {
    // marcar story atual como visto
    markStorySeen(state.storyIndex);
    if (state.storyIndex + 1 < cfg.stories.length) {
      state.storyIndex += 1;
      state.itemIndex = 0;
      fillBars();
      renderCurrentItem();
      startCurrentTimer();
      initUrgencyUI();
    } else {
      closeOverlay();
    }
  }
  function prevStory(goToLast = false) {
    if (state.storyIndex > 0) {
      state.storyIndex -= 1;
      state.itemIndex = goToLast ? cfg.stories[state.storyIndex].items.length - 1 : 0;
      fillBars();
      renderCurrentItem();
      startCurrentTimer();
    } else {
      closeOverlay();
    }
  }

  // Modal control
  function showOverlay() {
    document.documentElement.style.overflow = 'hidden';
    state.openedAt = performance.now();
    el.overlay.style.display = 'flex';
    requestAnimationFrame(() => el.overlay.classList.add('ig-open'));
  }
  function closeOverlay() {
    pauseTimer();
    stopAllVideos();
    markStorySeen(state.storyIndex);
    clearUrgencyUI();
    el.overlay.classList.remove('ig-open');
    setTimeout(() => {
      el.overlay.style.display = 'none';
      document.documentElement.style.overflow = '';
    }, 160);
  }

  // Visibilidade real do elemento na tela (tamanho > 1px, não hidden/display none, opacidade > 0, e interseção com modal)
  function isActuallyVisible(node){
    try{
      if(!node) return false;
      const rect = node.getBoundingClientRect();
      if(!rect || rect.width <= 1 || rect.height <= 1) return false;
      const cs = window.getComputedStyle(node);
      if(cs && (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0)) return false;
      const modal = document.querySelector('.ig-modal');
      if(modal){
        const mrect = modal.getBoundingClientRect();
        const noIntersect = rect.right <= mrect.left || rect.left >= mrect.right || rect.bottom <= mrect.top || rect.top >= mrect.bottom;
        if(noIntersect) return false;
      }
      return true;
    }catch{ return false }
  }

  // Verificação definitiva: mídia está completamente pronta E visível
  function isMediaReady(element) {
    try {
      if (!element) return false;

      if (element.tagName === 'IMG') {
        // Imagem: basta estar totalmente carregada (independente de visibilidade momentânea)
        return element.complete && element.naturalWidth > 0 && element.naturalHeight > 0;
      }
      if (element.tagName === 'VIDEO') {
        const v = element;
        // Vídeo: pronto para reproduzir OU já reproduzindo
        const playable = v.readyState >= 3 || (Number.isFinite(v.duration) && v.duration > 0);
        const alreadyPlaying = (!v.paused && v.currentTime > 0);
        return playable || alreadyPlaying;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Timer/progress
  function startCurrentTimer() {
    // limpar timer anterior e entrar em modo "aguardando" até carregar
    if (state.timerId) { window.clearTimeout(state.timerId); state.timerId = null; }
    if (state.loadingTimeoutId) { clearTimeout(state.loadingTimeoutId); state.loadingTimeoutId = null; }
    if (el.loading) el.loading.hidden = true;
    state.playing = false;

    const item = getCurrentItem();
    const media = el.media;
    let dur = cfg.imageDurationMs;

    // Helper: exibir/ocultar loading com checagem real de visibilidade/renderiza e7 e3o
    const showLoading = (on, delay=0) => {
      if (!el.loading) return;

      // Cancelar qualquer timeout pendente
      if (state.loadingTimeoutId) {
        clearTimeout(state.loadingTimeoutId);
        state.loadingTimeoutId = null;
      }

      const hideNow = () => {
        el.loading.hidden = true;
        el.loading.style.display = 'none';
        el.loading.setAttribute('aria-busy', 'false');
      };
      const showNow = () => {
        el.loading.hidden = false;
        el.loading.style.display = 'flex';
        el.loading.setAttribute('aria-busy', 'true');
      };

      if (on) {
        // Mostrar loading após delay (se ainda for o mesmo item)
        const token = state.loadToken;
        state.loadingTimeoutId = setTimeout(() => {
          if (token === state.loadToken && el.loading) {
            showNow();
          }
        }, delay);
      } else {
        // Esconder imediatamente
        hideNow();
      }
    };

    if (item.type === 'image') {
      const img = media.querySelector('img');
      if (img) {
        // Verificação prévia: se já está pronta, vai direto pro timer
        const imgReady = isMediaReady(img);
        console.log('[DEBUG] IMG check: isMediaReady =', imgReady);
        if (imgReady) {
          // JÁ PRONTA - não mostra loading, vai direto
          console.log('[DEBUG] IMG: já pronta, indo direto pro timer');
        } else {
          // NÃO PRONTA - mostra loading e aguarda
          console.log('[DEBUG] IMG: não pronta, mostrando loading e aguardando');
          showLoading(true, 300);
          const onReady = () => {
            console.log('[DEBUG] IMG: onReady disparado, escondendo loading');
            showLoading(false);
            startCurrentTimer();
          };
          img.addEventListener('load', onReady, { once: true });
          img.addEventListener('error', onReady, { once: true });
          return; // só inicia quando carregar
        }
      }
    } else if (item.type === 'video') {
      const v = media.querySelector('video');
      if (v) {
        // Verificação prévia: se já está pronto, vai direto pro timer
        const videoReady = isMediaReady(v);
        console.log('[DEBUG] VIDEO check: isMediaReady =', videoReady);
        if (videoReady) {
          // JÁ PRONTO - não mostra loading, vai direto
          console.log('[DEBUG] VIDEO: já pronto, indo direto pro timer');
          dur = Math.ceil(v.duration * 1000);
          try { v.play(); } catch {}
          v.onended = () => nextItem();
        } else {
          // NÃO PRONTO - mostra loading e aguarda
          console.log('[DEBUG] VIDEO: não pronto, mostrando loading e aguardando');
          showLoading(true, 300);
          const onReady = () => {
            console.log('[DEBUG] VIDEO: onReady disparado, escondendo loading');
            showLoading(false);
            dur = Math.ceil(v.duration * 1000);
            try { v.play(); } catch {}
            v.onended = () => nextItem();
            startCurrentTimer();
          };
          v.addEventListener('loadedmetadata', onReady, { once: true });
          v.addEventListener('canplay', onReady, { once: true });
          try { v.load(); } catch {}
          return; // só inicia quando carregar
        }
      }
    }

    // pronto para iniciar contagem
    showLoading(false);
    state.currentDuration = dur;
    state.timerRemaining = dur;
    state.timerStart = performance.now();
    state.playing = true;
    animateProgress();
    state.timerId = window.setTimeout(() => nextItem(), dur);
  }
  function pauseTimer() {
    // Evitar pausas acidentais imediatamente aps abrir
    const openedAgo = performance.now() - (state.openedAt || 0);
    if (openedAgo >= 0 && openedAgo < 600) return;
    if (!state.playing) return;
    state.playing = false;
    if (state.timerId) { window.clearTimeout(state.timerId); state.timerId = null; }
    const elapsed = performance.now() - state.timerStart;
    state.timerRemaining = Math.max(0, state.currentDuration - elapsed);
    // Congelar visualmente a barra atual
    const fills = el.progress.querySelectorAll('.ig-bar-fill');
    const current = fills[state.itemIndex];
    if (current) {
      const cw = getComputedStyle(current).width;
      current.style.transition = 'none';
      current.style.width = cw; // congela no ponto atual
    }
    pauseVideo();
  }
  function resumeTimer() {
    if (state.playing || state.timerRemaining <= 0) return;
    state.playing = true;
    state.timerStart = performance.now();
    // retomar apenas a barra corrente com o tempo restante
    const fills = el.progress.querySelectorAll('.ig-bar-fill');
    const current = fills[state.itemIndex];
    if (current) {
      current.style.transition = 'none';
      // força recálculo
      void current.offsetWidth;
      current.style.transition = 'width linear';
      current.style.transitionDuration = `${state.timerRemaining}ms`;
      current.style.width = '100%';
    }
    resumeVideo();
    state.timerId = window.setTimeout(() => nextItem(), state.timerRemaining);
  }
  function animateProgress() {
    const bars = el.progress.querySelectorAll('.ig-bar-fill');
    bars.forEach((b, i) => {
      b.style.transition = 'none';
      if (i < state.itemIndex) {
        b.style.width = '100%';
      } else if (i === state.itemIndex) {
        b.style.width = '0%';
        // async to allow transition
        requestAnimationFrame(() => {
          b.style.transition = 'width linear';
          b.style.transitionDuration = `${state.currentDuration}ms`;
          b.style.width = '100%';
        });
      } else {
        b.style.width = '0%';
      }
    });
  }
  function updateBars() { // when index changes mid-story
    const fills = el.progress.querySelectorAll('.ig-bar-fill');
    fills.forEach((b, i) => {
      b.style.transition = 'none';
      b.style.width = i < state.itemIndex ? '100%' : (i === state.itemIndex ? '0%' : '0%');
    });
  }

  // Rendering media/product
  function getCurrentItem() {
    return cfg.stories[state.storyIndex].items[state.itemIndex];
  }
  function stopAllVideos() {
    el.media.querySelectorAll('video').forEach(v => {
      try { v.muted = true; v.volume = 0; v.pause && v.pause(); v.currentTime = 0; } catch {}
      try {
        if (v.removeAttribute) v.removeAttribute('src');
        const s = v.querySelector('source'); if (s && s.removeAttribute) s.removeAttribute('src');
        if (v.load) v.load();
      } catch {}
    });
  }
  function pauseVideo() {
    const v = el.media.querySelector('video');
    if (v) { try { v.pause(); } catch {} }
  }
  function resumeVideo() {
    const v = el.media.querySelector('video');
    if (v) { try { v.play(); } catch {} }
  }
  function renderCurrentItem() {
    stopAllVideos();
    const story = cfg.stories[state.storyIndex];
    const item = getCurrentItem();
    // reset/hide loading do item anterior
    if (state.loadingTimeoutId) { clearTimeout(state.loadingTimeoutId); state.loadingTimeoutId = null; }
    if (el.loading) el.loading.hidden = true; state.loadToken++;

    el.media.innerHTML = '';

    // Função para obter a melhor fonte de mídia baseado no dispositivo
    const getOptimalMediaSrc = (item) => {
      // Se tem versões otimizadas, usar baseado no dispositivo
      if (item.optimal) {
        return item.optimal;
      }

      // Fallback para lógica manual se não tem versões otimizadas
      const mediaSize = deviceDetection.getOptimalMediaSize();
      if (mediaSize === 'mobile' && item.mobile) {
        return item.mobile;
      } else if (mediaSize === 'desktop' && item.desktop) {
        return item.desktop;
      }

      // Fallback final para src original
      return item.src;
    };

    if (item.type === 'image') {
      const optimalSrc = getOptimalMediaSrc(item);

      // Verificar cache primeiro
      const cachedImg = mediaCache.get(optimalSrc);
      if (cachedImg) {
        // Usar imagem do cache
        const img = cachedImg.cloneNode();
        img.alt = story.label || '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.background = '#000';
        el.media.appendChild(img);
      } else {
        // Carregar nova imagem
        const img = new Image();
        img.onload = () => {
          // Adicionar ao cache após carregar
          mediaCache.set(optimalSrc, img);
        };
        img.src = optimalSrc;
        img.alt = story.label || '';
        img.loading = 'eager';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.background = '#000';
        el.media.appendChild(img);
      }

      // Preload de alta qualidade em background se necessário
      if (deviceDetection.shouldUseHighQuality() && item.desktop && optimalSrc !== item.desktop) {
        const cachedHQ = mediaCache.get(item.desktop);
        if (!cachedHQ) {
          const highQualityImg = new Image();
          highQualityImg.onload = () => {
            // Adicionar ao cache e trocar se ainda estiver visível
            mediaCache.set(item.desktop, highQualityImg);
            const currentImg = el.media.querySelector('img');
            if (currentImg && currentImg.src === optimalSrc) {
              currentImg.src = item.desktop;
            }
          };
          highQualityImg.src = item.desktop;
        }
      }
    } else {
      const optimalSrc = getOptimalMediaSrc(item);

      // Para vídeos: preferir HLS (stream em pedaços) no mobile, com fallback para MP4
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.muted = false; // iniciar com áudio habilitado após clique do usuário
      v.controls = false;
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'contain';
      v.style.background = '#000';

      // Poster para primeiro frame imediato
      try { v.poster = item.poster || item.thumbnail || ''; } catch {}


      let desiredHls = (deviceDetection.getOptimalMediaSize?.() === 'mobile')
        ? (item.mobileHls || item.hls)
        : (item.hls || item.mobileHls);
      // Preferir MP4 web-optimized quando disponível (sem Mux/HLS)
      try { if (optimalSrc && /\.mp4$/i.test(optimalSrc)) { desiredHls = null; } } catch {}

      const tryMp4Fallback = () => { if (!v.src && !v.currentSrc) { v.src = optimalSrc; } };

      if (desiredHls) {
        if (canPlayHlsNatively(v)) {
          v.src = desiredHls; // Safari iOS toca HLS nativamente
        } else {
          ensureHlsJs().then((ok) => {
            if (ok && window.Hls && window.Hls.isSupported()) {
              const h = new Hls({
                autoStartLoad: true,
                startLevel: 0,
                capLevelOnFPSDrop: true,
                capLevelToPlayerSize: true,
                maxInitialBitrate: 300000,
                startFragPrefetch: true
              });
              h.on(Hls.Events.ERROR, function(_, data){ if (data?.fatal) { tryMp4Fallback(); } });
              try { h.startLevel = 0; } catch {}
              h.loadSource(desiredHls);
              h.attachMedia(v);
            } else {
              tryMp4Fallback();
            }
          }).catch(tryMp4Fallback);
        }
      } else {
        v.src = optimalSrc;
      }

      // Registrar no cache para estatísticas (sem dados reais)
      v.addEventListener('loadedmetadata', () => {
        const key = v.currentSrc || desiredHls || optimalSrc;
        mediaCache.set(key, { type: 'video', loaded: true });
      }, { once: true });

      // Preload de alta qualidade para vídeos em desktop com boa conexão (apenas MP4)
      if (!desiredHls && deviceDetection.shouldUseHighQuality() && item.desktop && optimalSrc !== item.desktop) {
        if (!mediaCache.has(item.desktop)) {
          const highQualityVideo = document.createElement('video');
          highQualityVideo.preload = 'metadata';
          highQualityVideo.muted = true;
          highQualityVideo.playsInline = true;

          highQualityVideo.addEventListener('canplay', () => {
            mediaCache.set(item.desktop, { type: 'video', loaded: true });
            if (v.parentNode && v.paused) {
              const currentTime = v.currentTime;
              v.src = item.desktop;
              v.currentTime = currentTime;
            }
          }, { once: true });


      // Prefetch do prximo story (apenas 1   frente)
      try {
        const tryPrefetchNext = () => {
          try {
            const s = cfg.stories[state.storyIndex];
            const atEnd = state.itemIndex + 1 >= s.items.length;
            const nextStoryIndex = atEnd ? state.storyIndex + 1 : state.storyIndex;
            const nextItemIndex = atEnd ? 0 : state.itemIndex + 1;
            const nextStory = cfg.stories[nextStoryIndex];
            const nextItem = nextStory?.items?.[nextItemIndex];
            if (!nextItem || nextItem.type !== 'video') return;
            const nextHls = (deviceDetection.getOptimalMediaSize?.() === 'mobile')
              ? (nextItem.mobileHls || nextItem.hls)
              : (nextItem.hls || nextItem.mobileHls);
            if (nextHls) {
              prefetchHlsWarmup(nextHls);
            } else {
              const nextSrc = getOptimalMediaSrc(nextItem);
              if (nextSrc) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'video';
                link.href = nextSrc;
                document.head.appendChild(link);
              }
            }
            if (nextItem.thumbnail) { const img = new Image(); img.src = nextItem.thumbnail; }
          } catch {}
        };
        v.addEventListener('playing', tryPrefetchNext, { once: true });
      } catch {}

          setTimeout(() => { highQualityVideo.src = item.desktop; }, 1000);
        }
      }

      el.media.appendChild(v);
    }
    // header oculto (sem avatar/título)
    if (el.headerLabel) el.headerLabel.textContent = '';
    const headerAvatar = document.querySelector('.ig-header .ig-avatar');
    if (headerAvatar) { headerAvatar.textContent = ''; }
    // product area
    fillProduct(cfg.product, cfg.ctaHref);
    // aplicar som preferido e atualizar UI social
    { const v2 = document.querySelector('.ig-modal video'); if (v2){ v2.muted = !!state.muted; v2.volume = state.muted ? 0 : 1; } }
    { const modalEl = document.querySelector('#ig-stories-modal .ig-modal');
      // Botão de som (topo esquerdo) estilo btn-x com SVG
      if (modalEl && !modalEl.querySelector('.ig-sound-top')){
        const soundTop = document.createElement('button');
        soundTop.className = 'ig-sound-top';
        soundTop.setAttribute('aria-label', 'Áudio');
        soundTop.innerHTML = '<svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5l-4 4H4v6h3l4 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
        soundTop.addEventListener('click', () => toggleMute());
        modalEl.appendChild(soundTop);
      }
      // Garantir trilho de ações presente (direita, centralizado)
      ensureActionsUI();
    }
    updateSocialUI();
    const sb = document.querySelector('.ig-modal .ig-saiba');
    if (sb) sb.addEventListener('click', (e)=>{ e.preventDefault(); closeOverlayFocusCTA(); });

  }

  // UI builders
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'ig-stories-modal';
    overlay.innerHTML = `
      <div class="ig-modal" role="dialog" aria-modal="true" aria-label="Stories Instagram">
        <div class="ig-progress"></div>
        <div class="ig-loading" hidden aria-live="polite" aria-busy="true">
          <div class="ig-spinner" aria-hidden="true"></div>
          <div class="ig-loading-text">Carregando…</div>
        </div>
        <button class="ig-close" aria-label="Fechar">×</button>
        <button class="ig-nav ig-left" aria-label="Anterior">‹</button>
        <button class="ig-nav ig-right" aria-label="Próximo">›</button>
        <div class="ig-header">
          <div class="ig-avatar"></div>
          <div class="ig-title"></div>
        </div>
        <div class="ig-media" role="group" aria-label="Stories"></div>
        <div class="ig-product"></div>
      </div>
      <style>${styles()}</style>
    `;
    const progress = overlay.querySelector('.ig-progress');
    const loading = overlay.querySelector('.ig-loading');
    const media = overlay.querySelector('.ig-media');
    const close = overlay.querySelector('.ig-close');
    const left = overlay.querySelector('.ig-left');
    const right = overlay.querySelector('.ig-right');
    const product = overlay.querySelector('.ig-product');
    const headerLabel = overlay.querySelector('.ig-title');

    // Ações sociais, comentários, perfil e estilos extras
    const modalEl = overlay.querySelector('.ig-modal');

    // Toolbars e overlays
    const actions = document.createElement('div');
    actions.className = 'ig-actions';
    actions.style.cssText = 'position:absolute;right:6px;top:73%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px;z-index:7;align-items:center;justify-content:center';
    actions.innerHTML = `
      <div class="ig-icon-with-count">
        <button class="ig-act ig-like" aria-label="Curtir">
          <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <div class="ig-count-left" aria-hidden="true">86</div>
      </div>
      <button class="ig-act ig-comment" aria-label="Comentar">
        <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a4 4 0 0 1-4 4H8l-4 4V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4z"/>
        </svg>
      </button>
      <button class="ig-act ig-share" aria-label="Compartilhar">
        <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 12v7a1 1 0 0 0 1 1h7"/>
          <path d="M21 3l-9 9"/>
          <path d="M15 3h6v6"/>
        </svg>
      </button>
      <button class="ig-act ig-wa" aria-label="WhatsApp">
        <svg class="ig-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.66 15.1L2 22l4.98-1.3A10 10 0 1 0 12 2Zm5.36 14.18c-.23.66-1.12 1.2-1.83 1.36a5.9 5.9 0 0 1-2.7-.17c-.61-.2-1.39-.45-2.38-1.04A10.13 10.13 0 0 1 7.8 13c-.37-.64-.79-1.53-.92-2.67-.18-1.5.79-2.6 1.05-2.9.27-.31.59-.38.78-.38h.56c.18 0 .42 0 .64.49.23.5.78 1.94.85 2.08.07.14.11.31.02.5-.09.2-.14.31-.29.48-.15.17-.3.38-.43.51-.14.13-.29.28-.13.56.16.28.71 1.16 1.52 1.87 1.05.93 1.94 1.23 2.24 1.37.3.14.48.12.66-.07.18-.18.77-.9.98-1.21.2-.31.41-.26.68-.15.28.12 1.76.83 2.06.98.3.15.5.22.58.35.08.13.08.74-.15 1.4Z"/>
        </svg>
      </button>
      <div class="ig-watermark" aria-hidden="true">Peacock</div>
    `;
    modalEl.appendChild(actions);

    const comments = document.createElement('div');
    comments.className = 'ig-comments';
    comments.setAttribute('aria-label','Comentários');
    comments.hidden = true;
    comments.innerHTML = `
      <div class="ig-comments-head"><div class="ig-comments-title"><span class="ig-cnt">0</span> comentários</div><button type="button" class="ig-comments-close" aria-label="Fechar">×</button></div>
      <div class="ig-comments-list" role="list"></div>
      <div class="ig-comments-emoji">
        <button type="button" class="ig-emo">😂</button>
        <button type="button" class="ig-emo">😍</button>
        <button type="button" class="ig-emo">🥰</button>
        <button type="button" class="ig-emo">😮</button>
        <button type="button" class="ig-emo">😊</button>
        <button type="button" class="ig-emo">😢</button>
      </div>
      <form class="ig-comments-form" autocomplete="on">
        <input name="text" class="ig-input" maxlength="140" placeholder="Adicionar comentário..." />
        <button type="submit" class="ig-send">Enviar</button>
      </form>
    `;
    modalEl.appendChild(comments);

    const profile = document.createElement('div');
    profile.className = 'ig-profile';
    profile.hidden = true;
    profile.innerHTML = `
      <form class="ig-profile-form" autocomplete="on">
        <div style="font-weight:700;margin-bottom:8px">Quase lá! Informe seus dados para interagir</div>
        <input name="name" class="ig-input" required placeholder="Seu nome" />
        <input name="whats" class="ig-input" required inputmode="tel" placeholder="WhatsApp (com DDD)" />
        <button type="submit" class="ig-cta-mini">Continuar</button>
        <button type="button" class="ig-cancel">Cancelar</button>
      </form>`;
    modalEl.appendChild(profile);

    const toast = document.createElement('div'); toast.className = 'ig-toast'; toast.hidden = true; modalEl.appendChild(toast);

    // Estilos adicionais (mobile-first, leves)
    const extra = document.createElement('style'); extra.textContent = extraStyles(); overlay.appendChild(extra);

    // Handlers de ações
    actions.querySelector('.ig-like')?.addEventListener('click', async () => {
      const ok = await ensureProfile(); if (!ok) return; toggleLike();
    });
    actions.querySelector('.ig-comment')?.addEventListener('click', () => {
      toggleComments();
    });
    actions.querySelector('.ig-share')?.addEventListener('click', () => handleShare());
    actions.querySelector('.ig-wa')?.addEventListener('click', () => handleWhats());


    // Formulário de comentários
    comments.querySelector('.ig-comments-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = await ensureProfile(); if (!ok) return;
      const input = comments.querySelector('input[name="text"]');
      const txt = (input?.value || '').trim(); if (!txt) return;
      addUserComment(txt); input.value = '';
    });
    comments.querySelector('.ig-comments-close')?.addEventListener('click', () => { toggleComments(); });
    comments.querySelectorAll('.ig-emo').forEach(btn => btn.addEventListener('click', () => { const input = comments.querySelector('input[name="text"]'); if(input){ input.value = (input.value||'') + ' ' + btn.textContent; input.focus(); }}));

    // Formulário de perfil (gating)
    profile.querySelector('.ig-profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const name = f.querySelector('input[name="name"]').value.trim();
      const whats = f.querySelector('input[name="whats"]').value.trim();
      if (!name || !whats) return;
      try { localStorage.setItem('igStoriesProfile', JSON.stringify({ name, whats })); } catch {}
      profile.hidden = true; showToast('Pronto! Agora você pode interagir.');
    });
    profile.querySelector('.ig-cancel')?.addEventListener('click', () => { profile.hidden = true; });


    // Ocultar modal legado (evitar conflitos)
    const legacy = document.getElementById('stories-modal-v2');
    if (legacy) legacy.style.display = 'none';

    // Acessibilidade: trap de foco e ESC
    const getFocusable = () => Array.from(overlay.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'));
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
      if (e.key === 'Tab') {
        const f = getFocusable(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Events
    close.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
    left.addEventListener('click', (e) => { e.stopPropagation(); pauseTimer(); nextFrame(() => { resumeTimer(); }); prevItem(); });
    right.addEventListener('click', (e) => { e.stopPropagation(); pauseTimer(); nextFrame(() => { resumeTimer(); }); nextItem(); });

    // Tap zones for quick nav (left/right half)
    media.addEventListener('click', (e) => {
      const mid = media.getBoundingClientRect().width / 2;
      if (e.offsetX < mid) { prevItem(); } else { nextItem(); }
    });

    // Pause on press/hold
    let pressId = null;
    const pressStart = () => {
      const openedAgo = performance.now() - (state.openedAt || 0);
      if (openedAgo < 600) return; // não pausar imediatamente após abrir
      if (!pressId) { pressId = setTimeout(() => pauseTimer(), 120); }
    };
    const pressEnd = () => { if (pressId) { clearTimeout(pressId); pressId = null; resumeTimer(); } };
    media.addEventListener('pointerdown', pressStart);
    media.addEventListener('pointerup', pressEnd);
    media.addEventListener('pointercancel', pressEnd);
    media.addEventListener('pointerleave', pressEnd);

    // Swipe
    overlay.addEventListener('touchstart', (e) => { if (!e.touches[0]) return; state.touchXStart = e.touches[0].clientX; state.touchYStart = e.touches[0].clientY; });
    overlay.addEventListener('touchend', (e) => {
      const dx = (e.changedTouches[0]?.clientX || 0) - state.touchXStart;
      const dy = (e.changedTouches[0]?.clientY || 0) - state.touchYStart;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx > 0 ? prevItem() : nextItem(); }
  // ====== Social/UX helpers ======
    });


  function showToast(msg){const t=document.querySelector('.ig-modal .ig-toast'); if(!t) return; t.textContent=msg; t.hidden=false; clearTimeout(t._h); t._h=setTimeout(()=>{t.hidden=true},1600)}

  function getProfile(){try{const j=localStorage.getItem('igStoriesProfile');return j?JSON.parse(j):null}catch{return null}}
  async function ensureProfile(){const p=getProfile(); if(p&&p.name&&p.whats) return true; const el=document.querySelector('.ig-modal .ig-profile'); if(el){el.hidden=false; el.style.display='block'; el.style.zIndex='50';} return false}

  function storageGet(key, def){try{const j=localStorage.getItem(key); return j?JSON.parse(j):def}catch{return def}}
  function storageSet(key, val){try{localStorage.setItem(key, JSON.stringify(val))}catch{}}

  function commentsAll(){return storageGet('igStoriesComments',{})}
  function saveCommentsAll(obj){storageSet('igStoriesComments',obj)}
  function commentsFor(){const all=commentsAll(); return all[storyKey()]||[]}
  function saveCommentsFor(arr){const all=commentsAll(); all[storyKey()]=arr; saveCommentsAll(all)}

  function seedCommentsIfNeeded(){if(storageGet('igStoriesSeeded',0)) return; const base=[
    'Resultados em 5 semanas, amei demais!','Nada de irrita e7 e3o, super leve','Recomendei pra minha m e3e e ela amou','Em 3 semanas j e1 vi diferen e7a','Vale cada centavo','F f4lego pros meus c edlios!','Comprei de novo pra garantir','Meu r edmel ficou perfeito','Chegou r e1pido','Atendimento pelo Whats funcionou bem'
  ]; const names=['Ana','Beatriz','Carla','Duda','Erika','Fernanda','Gi','Helena','Iasmin','Julia','Karen','Lu','Mari','Nana','Olivia','Paula','Quezia','Rafa','Sofia','Tati'];
    const obj={}; for(let s=0;s<7;s++){const arr=[]; for(let i=0;i<12;i++){const nm=names[(s*3+i)%names.length]; arr.push({name:nm, text:base[(i+s)%base.length], ts:Date.now()-((i+1)*3600e3)}); if(i%5===0) arr.push({name:nm+' (resposta)', text:'Verdade! comigo tb', ts:Date.now()-((i+1)*3500e3)});} obj[`story-${s}`]=arr}
    saveCommentsAll(obj); const likes={}; for(let s=0;s<7;s++){likes[`story-${s}`]=86;} storageSet('igStoriesLikes',likes); storageSet('igStoriesSeeded',1);
  }

  function renderComments(){const wrap=document.querySelector('.ig-modal .ig-comments'); const list=wrap?.querySelector('.ig-comments-list'); if(!wrap||!list) return; const arr=commentsFor(); list.innerHTML=''; arr.slice(-80).forEach(c=>{const item=document.createElement('div'); item.className='ig-comment-item'; const avatar=document.createElement('div'); avatar.className='ig-avatar-chip'; avatar.textContent=(c.name||'?').trim()[0]?.toUpperCase()||'?'; const body=document.createElement('div'); body.className='ig-comment-body'; body.innerHTML=`<div style="font-weight:700">${c.name||'Cliente'}</div><div>${c.text||''}</div>`; item.append(avatar,body); list.appendChild(item)}); const cmtCount=document.querySelector('.ig-actions .ig-cmt-count'); if(cmtCount) cmtCount.textContent=String(arr.length)}
  function toggleComments(){
    const el=document.querySelector('.ig-modal .ig-comments'); if(!el) return;
    const isOpen = el.classList.contains('ig-open') && el.style.display !== 'none' && el.hidden === false;
    if(!isOpen){
      if(typeof pauseTimer==='function') pauseTimer();
      el.hidden=false; el.style.display='flex'; el.dataset.open='1';
      renderComments();
      el.classList.add('ig-open');
      requestAnimationFrame(()=> el.classList.add('ig-open'));
      /* não focar automaticamente para não abrir o teclado */
      return;
    }
    el.classList.remove('ig-open'); el.dataset.open='0';
    setTimeout(()=>{ el.style.display='none'; el.hidden=true; if(typeof resumeTimer==='function') resumeTimer(); }, 280);
  }
  function addUserComment(text){const prof=getProfile(); const arr=commentsFor(); arr.push({name:prof?.name||'Cliente', text, ts:Date.now()}); saveCommentsFor(arr); renderComments(); showToast('Coment e1rio publicado!')}







    return { overlay, progress, loading, media, product, headerLabel };
  }

  // ====== Social/UX helpers (moved outside de buildModal) ======
  function extraStyles(){return `
  .ig-sound-top{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:16px;z-index:8;appearance:none;border:0;background:rgba(255,255,255,.18);color:#fff;width:var(--btn-x);height:var(--btn-x);border-radius:50%;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.30)}
  .ig-actions{position:absolute;right:6px;top:73%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px;z-index:7;align-items:center;justify-content:center}
  .ig-icon-with-count{position:relative;width:var(--btn-icon);height:var(--btn-icon);display:grid;place-items:center}
  .ig-count-left{position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);font-size:var(--fs-xs);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
  .ig-act{appearance:none;border:0;background:rgba(255,255,255,.20);color:#fff;width:var(--btn-icon);height:var(--btn-icon);border-radius:50%;display:grid;place-items:center;box-shadow:0 6px 14px rgba(0,0,0,.22)}
  .ig-act.ig-wa{background:#25D366;color:#fff}
  .ig-act:active{transform:scale(.96)}
  .ig-svg{width:var(--icon);height:var(--icon);display:block;fill:currentColor}
  .ig-watermark{margin-top:2px;font-size:var(--fs-xxs);opacity:.85;background:rgba(0,0,0,.25);padding:2px 6px;border-radius:6px;color:#fff}

  .ig-comments{position:absolute;left:0;right:0;bottom:0;background:#fff;color:#111;max-height:65vh;border-radius:16px 16px 0 0;padding:12px 12px 8px;z-index:10;display:flex;flex-direction:column;box-shadow:0 -12px 28px rgba(0,0,0,.28);transform:translateY(100%);transition:transform .28s ease}
  .ig-comments.ig-open{transform:translateY(0)}
  .ig-comments-head{display:flex;align-items:center;justify-content:space-between;font-weight:800;margin-bottom:8px}
  .ig-comments-title{font-size:14px}
  .ig-comments-list{overflow:auto;flex:1;display:flex;flex-direction:column;gap:14px;padding-right:6px}
  .ig-comment-item{display:flex;gap:10px}
  .ig-avatar-chip{width:32px;height:32px;border-radius:999px;background:#f2f3f5;display:flex;align-items:center;justify-content:center;font-weight:800;color:#111}
  .ig-comment-body{font-size:14px;line-height:1.25}
  .ig-comment-meta{display:flex;gap:14px;color:#6b7280;font-size:12px;margin-top:4px;align-items:center}
  .ig-comments-emoji{display:flex;gap:8px;padding:6px 0}
  .ig-comments-emoji .ig-emo{appearance:none;border:0;background:#f2f3f5;border-radius:10px;padding:6px 8px;font-size:18px}
  .ig-comments-form{display:flex;gap:8px;margin-top:6px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6px)}
  .ig-input{flex:1;min-height:40px;border-radius:14px;border:1px solid #E5E7EB;padding:8px 12px;background:#fff}
  .ig-send,.ig-cta-mini{background:#111;border:0;color:#fff;padding:10px 14px;border-radius:12px;font-weight:800}
  .ig-profile{position:absolute;left:12px;right:12px;bottom:60px;background:#fff;color:#111;border-radius:14px;padding:12px;z-index:50;box-shadow:0 6px 24px rgba(0,0,0,.25)}
  .ig-profile .ig-input{background:#f2f4f7}
  .ig-profile .ig-cancel{background:transparent;border:0;margin-left:8px;color:#555}
  .ig-toast{position:absolute;left:50%;transform:translateX(-50%);bottom:56px;background:rgba(0,0,0,.85);color:#fff;padding:8px 12px;border-radius:12px;z-index:9}
  @media(min-width:768px){.ig-sound-top{top:20px;left:20px;width:48px;height:48px}.ig-actions{right:16px}.ig-act{width:48px;height:48px}}
`}

  function showToast(msg){const t=document.querySelector('.ig-modal .ig-toast'); if(!t) return; t.textContent=msg; t.hidden=false; clearTimeout(t._h); t._h=setTimeout(()=>{t.hidden=true},1600)}

  function getProfile(){try{const j=localStorage.getItem('igStoriesProfile');return j?JSON.parse(j):null}catch{return null}}
  async function ensureProfile(){const p=getProfile(); if(p&&p.name&&p.whats) return true; const el=document.querySelector('.ig-modal .ig-profile'); if(el){el.hidden=false; el.style.display='block'; el.style.zIndex='50';} return false}

  function storageGet(key, def){try{const j=localStorage.getItem(key); return j?JSON.parse(j):def}catch{return def}}
  function storageSet(key, val){try{localStorage.setItem(key, JSON.stringify(val))}catch{}}

  function storyKey(){ return `story-${state.storyIndex}` }

  function getLikes(){const all=storageGet('igStoriesLikes',{}); return all[storyKey()]||0}
  function setLikes(n){const all=storageGet('igStoriesLikes',{}); all[storyKey()]=n; storageSet('igStoriesLikes',all)}
  function hasLiked(){const all=storageGet('igStoriesLiked',{}); const prof=getProfile(); const id=prof?prof.whats:'anon'; const per=all[id]||{}; return !!per[storyKey()]}
  function markLiked(v){const all=storageGet('igStoriesLiked',{}); const prof=getProfile(); const id=prof?prof.whats:'anon'; const per=all[id]||{}; per[storyKey()]=v?1:0; all[id]=per; storageSet('igStoriesLiked',all)}
  function toggleLike(){let n=getLikes(); const liked=hasLiked(); if(liked){n=Math.max(0,n-1); markLiked(false)} else {n+=1; markLiked(true)} setLikes(n); updateSocialUI();}

  function commentsAll(){return storageGet('igStoriesComments',{})}
  function saveCommentsAll(obj){storageSet('igStoriesComments',obj)}
  function commentsFor(){const all=commentsAll(); return all[storyKey()]||[]}
  function saveCommentsFor(arr){const all=commentsAll(); all[storyKey()]=arr; saveCommentsAll(all)}

  function seedCommentsIfNeeded(){if(storageGet('igStoriesSeeded',0)) return; const base=[
    'Resultados em 5 semanas, amei demais!','Nada de irritação, super leve','Recomendei pra minha mãe e ela amou','Em 3 semanas já vi diferença','Vale cada centavo','Fôlego pros meus cílios!','Comprei de novo pra garantir','Meu rímel ficou perfeito','Chegou rápido','Atendimento pelo Whats funcionou bem'
  ]; const names=['Ana','Beatriz','Carla','Duda','Erika','Fernanda','Gi','Helena','Iasmin','Julia','Karen','Lu','Mari','Nana','Olivia','Paula','Quezia','Rafa','Sofia','Tati'];
    const obj={}; for(let s=0;s<7;s++){const arr=[]; for(let i=0;i<12;i++){const nm=names[(s*3+i)%names.length]; arr.push({name:nm, text:base[(i+s)%base.length], ts:Date.now()-((i+1)*3600e3)}); if(i%5===0) arr.push({name:nm+' (resposta)', text:'Verdade! comigo tb', ts:Date.now()-((i+1)*3500e3)});} obj[`story-${s}`]=arr}
    saveCommentsAll(obj); const likes={}; for(let s=0;s<7;s++){likes[`story-${s}`]=86;} storageSet('igStoriesLikes',likes); storageSet('igStoriesSeeded',1);
  }

  function renderComments(){const wrap=document.querySelector('.ig-modal .ig-comments'); const list=wrap?.querySelector('.ig-comments-list'); if(!wrap||!list) return; const arr=commentsFor(); list.innerHTML=''; const rel=(ts)=>{const s=Math.max(1,Math.floor((Date.now()-(ts||Date.now()))/1000)); if(s<60) return `${s}s`; const m=Math.floor(s/60); if(m<60) return `${m}m`; const h=Math.floor(m/60); if(h<24) return `${h}h`; const d=Math.floor(h/24); return `${d}d`}; arr.slice(-80).forEach(c=>{const item=document.createElement('div'); item.className='ig-comment-item'; const avatar=document.createElement('div'); avatar.className='ig-avatar-chip'; avatar.textContent=(c.name||'?').trim()[0]?.toUpperCase()||'?'; const body=document.createElement('div'); body.className='ig-comment-body'; const name=(c.name||'Cliente'); const text=(c.text||''); const meta=`<div class="ig-comment-meta"><span>${rel(c.ts)}</span><button type="button" class="ig-reply">Responder</button></div>`; body.innerHTML=`<div style="font-weight:800">${name}</div><div>${text}</div>${meta}`; item.append(avatar,body); list.appendChild(item)}); const cmtCount=document.querySelector('.ig-actions .ig-cmt-count'); if(cmtCount) cmtCount.textContent=String(arr.length); const headerCount=document.querySelector('.ig-comments .ig-cnt'); if(headerCount) headerCount.textContent=String(arr.length)}
  function toggleComments(){
    const el=document.querySelector('.ig-modal .ig-comments'); if(!el) return;
    const isOpen = el.dataset.open === '1';
    if(!isOpen){
      if(typeof pauseTimer==='function') pauseTimer();
      el.hidden=false; el.style.display='flex'; el.dataset.open='1';
      renderComments();
      el.classList.add('ig-open');
      requestAnimationFrame(()=> el.classList.add('ig-open'));
      /* não focar automaticamente para não abrir o teclado */
    } else {
      el.classList.remove('ig-open');
      el.dataset.open='0';
      setTimeout(()=>{ el.style.display='none'; el.hidden=true; if(typeof resumeTimer==='function') resumeTimer(); },280);
    }
  }
  function addUserComment(text){const prof=getProfile(); const arr=commentsFor(); arr.push({name:prof?.name||'Cliente', text, ts:Date.now()}); saveCommentsFor(arr); renderComments(); showToast('Comentário publicado!')}

  function updateSocialUI(){
    seedCommentsIfNeeded();
    const likeBtn = document.querySelector('.ig-actions .ig-like');
    const likeCountEl = document.querySelector('.ig-actions .ig-count-left') || likeBtn?.querySelector('.ig-count');
    if (likeCountEl) likeCountEl.textContent = String(getLikes());
    const liked = hasLiked();
    if (likeBtn){
      likeBtn.style.background = liked ? '#34C759' : 'rgba(255,255,255,.20)';
      likeBtn.style.color = '#fff';
    }
    renderComments();
  }

  function applyMuteToVideo(){const v=document.querySelector('.ig-modal video'); if(v){v.muted=!!state.muted; v.volume= state.muted?0:1}}
  function toggleMute(){state.muted=!state.muted; applyMuteToVideo(); updateSocialUI()}

  function handleShare(){
    const url = (typeof cfg !== 'undefined' && cfg?.ctaHref) ? cfg.ctaHref : window.location.href;
    const title = el?.product?.querySelector('.ig-title')?.textContent?.trim() || document.title;
    const text = 'Dá uma olhada neste produto!';
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(()=>{});
    } else {
      try{ navigator.clipboard?.writeText(url); showToast('Link copiado!'); }
      catch{ window.open(url,'_blank'); }
    }
  }

  function handleWhats(){
    const base = 'https://wa.me/5519981625626';
    const url = (typeof cfg !== 'undefined' && cfg?.ctaHref) ? cfg.ctaHref : window.location.href;
    const title = el?.product?.querySelector('.ig-title')?.textContent?.trim() || 'Peacock Cosméticos';
    const msg = `Olá, tenho interesse neste produto: ${title} - ${url}`;
    const utm = '&utm_source=stories&utm_medium=whatsapp&utm_campaign=ig_stories';
    const href = `${base}?text=${encodeURIComponent(msg)}${utm}`;
    window.open(href,'_blank','noopener');
  }



  function closeOverlayFocusCTA(){
    try{ document.querySelector('#ig-stories-modal .ig-close')?.click(); }catch{}
    setTimeout(()=>{
      const btn=[...document.querySelectorAll('button,a')].find(el=>/comprar agora/i.test(el.textContent||'')) || document.querySelector('#cta, #buy, .buy-now, .cta-buy');
      btn?.focus();
    },50)
  }

  // Garante que a UI social esteja presente mesmo se algum fluxo não a tiver criado
  function ensureActionsUI(){
    const modalEl = document.querySelector('#ig-stories-modal .ig-modal');
    if (!modalEl) return;
    if (!modalEl.querySelector('.ig-actions')){
      const actions = document.createElement('div');
      actions.className = 'ig-actions';
      actions.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:12px;z-index:7;align-items:center;justify-content:center';
      actions.innerHTML = `
        <div class="ig-icon-with-count">
          <button class="ig-act ig-like" aria-label="Curtir">
            <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <div class="ig-count-left" aria-hidden="true">86</div>
        </div>
        <button class="ig-act ig-comment" aria-label="Comentar">
          <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a4 4 0 0 1-4 4H8l-4 4V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4z"/>
          </svg>
        </button>
        <button class="ig-act ig-share" aria-label="Compartilhar">
          <svg class="ig-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h7"/>
            <path d="M21 3l-9 9"/>
            <path d="M15 3h6v6"/>
          </svg>
        </button>
        <button class="ig-act ig-wa" aria-label="WhatsApp">
          <svg class="ig-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.66 15.1L2 22l4.98-1.3A10 10 0 1 0 12 2Zm5.36 14.18c-.23.66-1.12 1.2-1.83 1.36a5.9 5.9 0 0 1-2.7-.17c-.61-.2-1.39-.45-2.38-1.04A10.13 10.13 0 0 1 7.8 13c-.37-.64-.79-1.53-.92-2.67-.18-1.5.79-2.6 1.05-2.9.27-.31.59-.38.78-.38h.56c.18 0 .42 0 .64.49.23.5.78 1.94.85 2.08.07.14.11.31.02.5-.09.2-.14.31-.29.48-.15.17-.3.38-.43.51-.14.13-.29.28-.13.56.16.28.71 1.16 1.52 1.87 1.05.93 1.94 1.23 2.24 1.37.3.14.48.12.66-.07.18-.18.77-.9.98-1.21.2-.31.41-.26.68-.15.28.12 1.76.83 2.06.98.3.15.5.22.58.35.08.13.08.74-.15 1.4Z"/>
          </svg>
        </button>
        <div class="ig-watermark" aria-hidden="true">iShorts</div>
      `;
      modalEl.appendChild(actions);

      actions.querySelector('.ig-like')?.addEventListener('click', async () => { const ok = await ensureProfile(); if (!ok) return; toggleLike(); });
      actions.querySelector('.ig-comment')?.addEventListener('click', () => { toggleComments(); });
      actions.querySelector('.ig-share')?.addEventListener('click', () => handleShare());
      actions.querySelector('.ig-wa')?.addEventListener('click', () => handleWhats());

    }
    if (!modalEl.querySelector('.ig-comments')){
      const comments = document.createElement('div');
      comments.className = 'ig-comments';
      comments.setAttribute('aria-label','Comentários');
      comments.hidden = true;
      comments.innerHTML = `
        <div class="ig-comments-head"><div class="ig-comments-title"><span class="ig-cnt">0</span> comentários</div><button type="button" class="ig-comments-close" aria-label="Fechar">×</button></div>
        <div class="ig-comments-list" role="list"></div>
        <div class="ig-comments-emoji">
          <button type="button" class="ig-emo">😂</button>
          <button type="button" class="ig-emo">😍</button>
          <button type="button" class="ig-emo">🥰</button>
          <button type="button" class="ig-emo">😮</button>
          <button type="button" class="ig-emo">😊</button>
          <button type="button" class="ig-emo">😢</button>
        </div>
        <form class="ig-comments-form" autocomplete="on">
          <input name="text" class="ig-input" maxlength="140" placeholder="Adicionar comentário..." />
          <button type="submit" class="ig-send">Enviar</button>
        </form>
      `;
      modalEl.appendChild(comments);
      comments.querySelector('.ig-comments-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const ok = await ensureProfile(); if (!ok) return;
        const input = comments.querySelector('input[name="text"]');
        const txt = (input?.value || '').trim(); if (!txt) return;
        addUserComment(txt); input.value = '';
      });
      comments.querySelector('.ig-comments-close')?.addEventListener('click', () => { toggleComments(); });
      comments.querySelectorAll('.ig-emo').forEach(btn => btn.addEventListener('click', () => { const input = comments.querySelector('input[name="text"]'); if(input){ input.value = (input.value||'') + ' ' + btn.textContent; input.focus(); }}));
    }
    if (!modalEl.querySelector('.ig-profile')){
      const profile = document.createElement('div');
      profile.className = 'ig-profile';
      profile.hidden = true;
      profile.innerHTML = `
        <form class="ig-profile-form" autocomplete="on">
          <div style="font-weight:700;margin-bottom:8px">Quase lá! Informe seus dados para interagir</div>
          <input name="name" class="ig-input" required placeholder="Seu nome" />
          <input name="whats" class="ig-input" required inputmode="tel" placeholder="WhatsApp (com DDD)" />
          <button type="submit" class="ig-cta-mini">Continuar</button>
          <button type="button" class="ig-cancel">Cancelar</button>
        </form>`;
      modalEl.appendChild(profile);
      profile.querySelector('.ig-profile-form')?.addEventListener('submit', (e) => {
        e.preventDefault(); const f = e.currentTarget;
        const name = f.querySelector('input[name="name"]').value.trim();
        const whats = f.querySelector('input[name="whats"]').value.trim();
        if (!name || !whats) return;
        try { localStorage.setItem('igStoriesProfile', JSON.stringify({ name, whats })); } catch {}
        profile.hidden = true; showToast('Pronto! Agora você pode interagir.');
      });
      profile.querySelector('.ig-cancel')?.addEventListener('click', () => { profile.hidden = true; });
    }
    if (!modalEl.querySelector('.ig-toast')){
      const toast = document.createElement('div'); toast.className = 'ig-toast'; toast.hidden = true; modalEl.appendChild(toast);
    }
    if (!document.querySelector('#ig-stories-modal style[data-ig-extra]')){
      const extra = document.createElement('style'); extra.textContent = extraStyles(); extra.setAttribute('data-ig-extra','');
      document.querySelector('#ig-stories-modal')?.appendChild(extra);
    }
  }


  function fillBars() {
    const s = cfg.stories[state.storyIndex];
    el.progress.innerHTML = '';
    s.items.forEach(() => {
      const bar = document.createElement('div'); bar.className = 'ig-bar';
      const fill = document.createElement('div'); fill.className = 'ig-bar-fill';
      bar.appendChild(fill); el.progress.appendChild(bar);
    });
    updateBars();
  }

  function fillProduct(product, href) {
    const title = escapeHtml(product.title || 'Sérum de Crescimento de Cílios');
    const thumb = product.thumb || document.querySelector('#mainImage')?.src || './imagens/78.jpg';
    const priceNow = product.priceNow || 'R$ 157,90';
    const priceOld = product.priceOld || '';
    el.product.innerHTML = `
      <div class="ig-card" role="group" aria-label="Oferta">
        <div class="ig-card-left">
          <div class="ig-thumb-wrap"><img class="ig-thumb" src="${thumb}" alt="${title}"></div>
          <div class="ig-info">
            <div class="ig-title">${title}</div>
            <div class="ig-price-row">
              <span class="ig-price-now">${priceNow}</span>
              ${priceOld ? `<span class="ig-price-old">${priceOld}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="ig-card-actions">
          <button type="button" class="ig-saiba">Saiba mais <span aria-hidden="true">›</span></button>
        </div>
      </div>
    `;
  }

  function styles() {
    return `
      :root{
        --ig-green-1:#34C759;--ig-green-2:#2DB34E;--ig-gray-ring:#9CA3AF;--ig-avatar-size:clamp(56px,14vw,68px);--ig-ring-thickness:3px;
        --bg-overlay: rgba(0,0,0,.80);--text-strong:#111827;--text-dim:#6B7280;--stroke-soft:#E5E7EB;--shadow: 0 6px 18px rgba(0,0,0,.18);
        --fs-xxs:11px; --fs-xs:12px; --fs-sm:13px; --fs-md:14px; --fs-lg:17px; --fs-xl:18px;
        --lh-tight:1.15; --lh-normal:1.35;--r-card:14px; --r-thumb:8px; --r-pill:999px;
        --gap-sm:8px; --gap-md:12px; --gap-lg:16px;--btn-icon:44px; --icon:24px; --btn-x:36px; --thumb:56px;
      }
      #ig-stories-modal{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:10000;opacity:0;transition:opacity .16s ease}
      #ig-stories-modal.ig-open{opacity:1}
      #ig-stories-modal .ig-modal{position:relative;width:100%;max-width:640px;height:100vh;max-height:100vh;height:100svh;max-height:100svh;height:100dvh;max-height:100dvh;display:grid;grid-template-rows:auto 0 auto 1fr auto;background:#000}
      .ig-progress{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);left:8px;right:8px;display:flex;gap:4px;z-index:4}
      .ig-bar{flex:1;height:3px;background:rgba(255,255,255,.25);border-radius:999px;overflow:hidden}
      .ig-bar-fill{width:0%;height:100%;background:linear-gradient(90deg,#84C63A,#6BBF3E)}
      .ig-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;z-index:9;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:none}
.ig-loading[hidden]{display:none!important}
      .ig-spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:ig-spin 1s linear infinite}
      @keyframes ig-spin{to{transform:rotate(360deg)}}
      .ig-loading-text{font-size:var(--fs-sm);font-weight:700}
      .ig-close{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:16px;width:var(--btn-x);height:var(--btn-x);border-radius:50%;border:none;background:rgba(255,255,255,.18);color:#fff;font-size:22px;line-height:var(--btn-x);z-index:8;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.30)}
      .ig-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:999px;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:22px;line-height:40px;z-index:8}
      .ig-left{left:8px}.ig-right{right:8px}
      .ig-header{display:none}
      .ig-avatar{display:none}
      .ig-title{display:none}
      .ig-media{grid-row:1/-1;width:100%;height:100vh;max-height:100vh;height:100svh;max-height:100svh;height:100dvh;max-height:100dvh;z-index:1;background:#000}


  function isVideoPlaying(v){
    try{ return v && v.currentTime > 0 && !v.paused && !v.ended && v.readyState >= 2; }catch{ return false }
  }



      .ig-media video,.ig-media img{width:100%;height:100%;object-fit:contain;background:#000}
      .ig-product{position:absolute;left:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);width:min(82%,calc(100% - 96px));z-index:6}
      .ig-card{display:flex;align-items:center;gap:var(--gap-md);padding:12px;background:#fff;color:var(--text-strong);border-radius:var(--r-card);box-shadow:var(--shadow)}
      .ig-card-left{display:flex;align-items:center;gap:var(--gap-md);flex:1 1 auto;min-width:0}
      .ig-thumb-wrap{width:var(--thumb);height:var(--thumb);border-radius:var(--r-thumb);overflow:hidden;flex:0 0 var(--thumb);border:1px solid #F1F5F9}
      .ig-thumb{width:100%;height:100%;object-fit:cover;background:#F3F4F6}
      .ig-info{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 auto}
      .ig-title{font-size:var(--fs-md);font-weight:600;line-height:var(--lh-normal);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-strong)}
      .ig-price-row{margin-top:4px;display:flex;align-items:baseline;gap:8px}
      .ig-price-now{font-weight:800;font-size:var(--fs-lg);color:var(--text-strong)}
      .ig-price-old{font-size:var(--fs-xs);color:var(--text-dim);text-decoration:line-through}
      .ig-card-actions{display:flex;align-items:center;gap:10px;margin-top:8px}
      .ig-saiba{flex:0 0 auto;align-self:center;border:1px solid var(--stroke-soft);border-radius:var(--r-pill);background:#fff;color:var(--text-strong);display:inline-flex;align-items:center;gap:8px;padding:10px 14px;font-weight:700;font-size:var(--fs-md);box-shadow:none}
      .ig-view{display:none}
      /* Anel estilo Instagram para avatares - pixel perfect */
      .story-avatar{position:relative;display:inline-flex;align-items:center;justify-content:center;width:var(--ig-avatar-size);height:var(--ig-avatar-size);border-radius:999px;padding:var(--ig-ring-thickness);background:conic-gradient(var(--ig-green-1) 0 360deg) !important;box-shadow:0 2px 6px rgba(0,0,0,.12)}
      .story-avatar::after{content:"";position:absolute;inset:calc(var(--ig-ring-thickness) + 1px);border-radius:999px;box-shadow:inset 0 0 0 2px #fff;pointer-events:none}
      .story-avatar img{width:100%;height:100%;border-radius:999px;object-fit:cover;background:#000}
      .story-avatar[data-viewed="true"]{background:conic-gradient(var(--ig-gray-ring) 0 360deg) !important}
    `;
  }

  // Helpers
  function getProductInfoFromPage() {
    const title = document.querySelector('h1')?.textContent?.trim() || 'Sérum de Crescimento de Cílios';
    const thumb = document.querySelector('#mainImage')?.src || document.querySelector('.product-image-gallery img')?.src || './imagens/78.jpg';
    const block = document.querySelector('#price-highlight-block');
    let priceNow = '';
    let priceOld = '';
    if (block) {
      const vistaDiv = Array.from(block.querySelectorAll('div')).find(d => /à vista/i.test(d.textContent||''));
      const m = vistaDiv?.textContent?.match(/R\$\s*[\d.,]+/);
      if (m) priceNow = m[0];
    }
    // tentativa de encontrar preço antigo na página, se existir
    const compareText = document.querySelector('.compare-price')?.textContent || '';
    const m2 = compareText.match(/R\$\s*[\d.,]+/);
    if (m2) priceOld = m2[0];
    return { title, thumb, priceNow: priceNow || 'R$ 157,90', priceOld };
  }
  function getDefaultStories() {
    // Função para gerar caminhos de mídia baseado no dispositivo
    const getMediaPaths = (basePath, type) => {
      const mediaSize = deviceDetection.getOptimalMediaSize();

      // Ajuste: para vídeos, usamos a convenção *_optimized.mp4 gerada por FFmpeg
      if (type === 'video') {
        const baseNoExt = basePath.replace('.mp4', '');
        const mobile = `./videos/mobile/${baseNoExt}_optimized.mp4`;
        const desktop = `./videos/desktop/${baseNoExt}_optimized.mp4`;
        const circle = `./videos/thumbnails/${baseNoExt}_circle.mp4`;
        const mobileHls = `./videos/hls/mobile/${baseNoExt}_master.m3u8`;
        return {
          mobile,
          desktop,
          optimal: mediaSize === 'mobile' ? mobile : desktop,
          circle,
          mobileHls
        };
      }

      // Imagens seguem a estrutura padrão
      const folder = 'imagens';
      return {
        thumbnail: `./imagens/thumbnails/${basePath}`,
        mobile: `./${folder}/mobile/${basePath}`,
        desktop: `./${folder}/desktop/${basePath}`,
        optimal: mediaSize === 'mobile' ? `./${folder}/mobile/${basePath}` : `./${folder}/desktop/${basePath}`
      };
    };

    // Conteúdos padrão com múltiplas versões para otimização
    const beforeAfter = Array.from({ length: 11 }, (_, i) => ({
      type: 'image',
      src: `./imagens/antesedepois/${i+1}.jpg`,
      mobile: `./imagens/antesedepois/${i+1}.jpg`,
      desktop: `./imagens/antesedepois/${i+1}.jpg`,
      optimal: `./imagens/antesedepois/${i+1}.jpg`,
      thumbnail: `./imagens/thumbnails/antesedepois-${i+1}.jpg`
    }));

    return [
      {
        label: 'Brenda',
        items: [
          {
            type: 'video',
            src: './imagens/videos/brenda.MOV',
            mobile: './videos/mobile/brenda_optimized.mp4',
            desktop: './videos/desktop/brenda_optimized.mp4',
            circle: './videos/thumbnails/brenda_circle.mp4',
            mobileHls: './videos/hls/mobile/brenda_master.m3u8',
            optimal: './stories/story-brenda.mp4',
            poster: './stories/story-brenda-poster.jpg',
            thumbnail: './imagens/thumbnails/brenda_real.jpg'
          }
        ],
        previewType: 'video',
        thumbnail: './imagens/thumbnails/brenda_real.jpg'
      },
      {
        label: 'Antes/Depois',
        items: beforeAfter,
        previewType: 'slider', // Indica que tem múltiplos itens
        thumbnail: './imagens/thumbnails/antesedepois-1.jpg'
      },
      {
        label: 'Cliente real',
        items: [
          {
            type: 'video',
            src: './imagens/videos/1.mp4',
            ...getMediaPaths('1.mp4', 'video'),
            optimal: './stories/story-1.mp4',
            poster: './stories/story-1-poster.jpg',
            thumbnail: './videos/thumbnails/video-1.jpg'
          },
          {
            type: 'video',
            src: './imagens/videos/2.mp4',
            ...getMediaPaths('2.mp4', 'video'),
            optimal: './stories/story-2.mp4',
            poster: './stories/story-2-poster.jpg',
            thumbnail: './videos/thumbnails/video-2.jpg'
          }
        ],
        previewType: 'video', // Indica que é vídeo
        thumbnail: './videos/thumbnails/video-1.jpg'
      },
      {
        label: 'Como aplicar',
        items: [
          {
            type: 'video',
            src: './imagens/videos/3.mp4',
            ...getMediaPaths('3.mp4', 'video'),
            optimal: './stories/story-3.mp4',
            poster: './stories/story-3-poster.jpg',
            thumbnail: './videos/thumbnails/video-3.jpg'
          }
        ],
        previewType: 'video',
        thumbnail: './videos/thumbnails/video-3.jpg'
      },
      {
        label: 'Dermato',
        items: [
          {
            type: 'image',
            src: './imagens/4.jpg',
            ...getMediaPaths('4.jpg', 'image'),
            thumbnail: './imagens/thumbnails/story-3.jpg'
          },
          {
            type: 'image',
            src: './imagens/78.jpg',
            ...getMediaPaths('78.jpg', 'image'),
            thumbnail: './imagens/thumbnails/story-3.jpg'
          }
        ],
        previewType: 'slider',
        thumbnail: './imagens/thumbnails/story-3.jpg'
      },
      {
        label: '30 dias depois',
        items: [
          {
            type: 'video',
            src: './imagens/videos/6.mp4',
            ...getMediaPaths('6.mp4', 'video'),
            optimal: './stories/story-6.mp4',
            poster: './stories/story-6-poster.jpg',
            thumbnail: './videos/thumbnails/video-6.jpg'
          }
        ],
        previewType: 'video',
        thumbnail: './videos/thumbnails/video-6.jpg'
      },
      {
        label: 'UGC 1',
        items: [
          {
            type: 'video',
            src: './imagens/videos/2.mp4',
            ...getMediaPaths('2.mp4', 'video'),
            optimal: './stories/story-2.mp4',
            poster: './stories/story-2-poster.jpg',
            thumbnail: './videos/thumbnails/video-2.jpg'
          }
        ],
        previewType: 'video',
        thumbnail: './videos/thumbnails/video-2.jpg'
      },
      {
        label: 'UGC 2',
        items: [
          {
            type: 'video',
            src: './imagens/videos/1.mp4',
            ...getMediaPaths('1.mp4', 'video'),
            optimal: './stories/story-1.mp4',
            poster: './stories/story-1-poster.jpg',
            thumbnail: './videos/thumbnails/video-1.jpg'
          }
        ],
        previewType: 'video',
        thumbnail: './videos/thumbnails/video-1.jpg'
      }
    ];
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
  function nextFrame(cb){ requestAnimationFrame(() => requestAnimationFrame(cb)); }


  // Persistência de stories vistos
  function loadSeenSet(){ try{ const raw = localStorage.getItem('igStoriesSeen'); const arr = raw ? JSON.parse(raw) : []; return new Set(Array.isArray(arr)?arr:[]); } catch(e){ return new Set(); } }
  function saveSeenSet(set){ try{ localStorage.setItem('igStoriesSeen', JSON.stringify(Array.from(set))); } catch(e){} }
  function markStorySeen(idx){ try{ const set = loadSeenSet(); if (!set.has(idx)) { set.add(idx); saveSeenSet(set); const btn = document.querySelector(`.story-avatar[data-story-index="${idx}"]`); if (btn) btn.setAttribute('data-viewed','true'); } } catch(e){} }

  // Urgência & escassez (UI mock segura)
  function formatMMSS(total){ const m = String(Math.floor(total/60)).padStart(2,'0'); const s = String(total%60).padStart(2,'0'); return `${m}:${s}`; }
  function initUrgencyUI(){
    clearUrgencyUI();
    const viewersEl = el.overlay.querySelector('.ig-viewers');
    const stockFill = el.overlay.querySelector('.ig-stock-fill');
    const timerEl = el.overlay.querySelector('.ig-timer');
    if (viewersEl) viewersEl.textContent = String(100 + Math.floor(Math.random()*80));
    if (stockFill) { const pct = 60 + Math.floor(Math.random()*25); stockFill.style.width = pct + '%'; }
    if (timerEl) {
      const D = 15*60; // 15 minutos
      state.deadlineTs = Date.now() + D*1000;
      const tick = () => { const remain = Math.max(0, Math.floor((state.deadlineTs - Date.now())/1000)); timerEl.textContent = formatMMSS(remain); if (remain <= 0) { state.deadlineTs = Date.now() + D*1000; } };
      tick(); state.urgencyInterval = setInterval(tick, 1000);
    }
  }
  function clearUrgencyUI(){ if (state.urgencyInterval) { clearInterval(state.urgencyInterval); state.urgencyInterval = null; } }

  // expose for manual usage if needed
  return { openStory, nextItem, prevItem, nextStory, prevStory, close: closeOverlay };
}

// Sistema de cache inteligente de mídia
const mediaCache = {
  cache: new Map(),
  maxSize: 50, // Máximo de itens no cache

  // Gerar chave única para cache
  generateKey(src, deviceType) {
    return `${src}_${deviceType}`;
  },

  // Verificar se item está no cache
  has(src, deviceType = null) {
    const key = this.generateKey(src, deviceType || 'mobile');
    return this.cache.has(key);
  },

  // Obter item do cache
  get(src, deviceType = null) {
    const key = this.generateKey(src, deviceType || 'mobile');
    const item = this.cache.get(key);

    if (item) {
      // Atualizar timestamp de último acesso
      item.lastAccessed = Date.now();
      this.cache.set(key, item);
      return item.data;
    }

    return null;
  },

  // Adicionar item ao cache
  set(src, data, deviceType = null) {
    const key = this.generateKey(src, deviceType || 'mobile');

    // Limpar cache se estiver cheio
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      size: this.estimateSize(data)
    });
  },

  // Estimar tamanho do item
  estimateSize(data) {
    if (data instanceof HTMLImageElement) {
      return data.naturalWidth * data.naturalHeight * 4; // Estimativa RGBA
    } else if (data instanceof HTMLVideoElement) {
      return data.videoWidth * data.videoHeight * 4 * 30; // Estimativa para 30 frames
    }
    return 1024; // Fallback
  },

  // Limpeza do cache (remove itens mais antigos)
  cleanup() {
    const entries = Array.from(this.cache.entries());

    // Ordenar por último acesso (mais antigo primeiro)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Remover 25% dos itens mais antigos
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  },

  // Limpar cache completamente
  clear() {
    this.cache.clear();
  },

  // Obter estatísticas do cache
  getStats() {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, item) => sum + item.size, 0);

    return {
      items: this.cache.size,
      totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
      maxSize: this.maxSize
    };
  }
};

// Função global para verificar cache (debug)
window.checkMediaCache = () => {
  const stats = mediaCache.getStats();
  console.log('📊 Cache Stats:', stats);
  console.log('🗂️ Cache Items:', Array.from(mediaCache.cache.keys()));
  return stats;
};

// Sistema de preload inteligente de thumbnails
const thumbnailPreloader = {
  queue: [],
  loading: new Set(),
  loaded: new Set(),

  // Adicionar thumbnail à fila de preload
  add(src, priority = 'normal') {
    if (this.loaded.has(src) || this.loading.has(src)) return;

    this.queue.push({ src, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => {
      // Prioridade: high > normal > low
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.processQueue();
  },

  // Processar fila de preload
  async processQueue() {
    if (this.queue.length === 0) return;

    // Limitar carregamentos simultâneos baseado na conexão
    const maxConcurrent = deviceDetection.isMobile() ? 2 : 4;
    if (this.loading.size >= maxConcurrent) return;

    const item = this.queue.shift();
    if (!item) return;

    this.loading.add(item.src);

    try {
      await this.loadThumbnail(item.src);
      this.loaded.add(item.src);
    } catch (error) {
      console.warn('Erro ao carregar thumbnail:', item.src, error);
    } finally {
      this.loading.delete(item.src);
      // Continuar processando a fila
      setTimeout(() => this.processQueue(), 100);
    }
  },

  // Carregar thumbnail individual com cache
  loadThumbnail(src) {
    return new Promise((resolve, reject) => {
      // Verificar cache primeiro
      const cached = mediaCache.get(src);
      if (cached) {
        resolve(cached);
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Adicionar ao cache após carregar
        mediaCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
      img.src = src;
    });
  },

  // Preload baseado na visibilidade (Intersection Observer)
  observeAvatars() {
    if (!window.IntersectionObserver) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const avatarBtn = entry.target;
          const storyIndex = parseInt(avatarBtn.dataset.storyIndex);

          // Buscar stories do contexto global
          const storiesInstance = window.igStoriesInstance;
          if (!storiesInstance || !storiesInstance.cfg || !storiesInstance.cfg.stories) return;

          const story = storiesInstance.cfg.stories[storyIndex];

          if (story && story.thumbnail) {
            // Preload com alta prioridade para itens visíveis
            this.add(story.thumbnail, 'high');

            // Preload das mídias do story também
            if (story.items) {
              story.items.forEach(item => {
                if (item.thumbnail) {
                  this.add(item.thumbnail, 'normal');
                }
              });

                  // Warmup HLS da primeira mda de vddeo do story para start instantneo
                  try{
                    const firstVid = story.items.find(it => it?.type==='video' && (it.mobileHls||it.hls));
                    if(firstVid) prefetchHlsWarmup(firstVid.mobileHls || firstVid.hls);
                  }catch{}

            }
          }

          // Parar de observar após carregar
          observer.unobserve(avatarBtn);
        }
      });
    }, {
      rootMargin: '50px', // Começar a carregar 50px antes de ficar visível
      threshold: 0.1
    });

    // Observar todos os avatares
    document.querySelectorAll('[data-story-index]').forEach(avatar => {
      observer.observe(avatar);
    });
  }
};

// Auto-init on import
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.igStoriesInstance = initInstagramStories();
    setTimeout(() => thumbnailPreloader.observeAvatars(), 500);
  });
} else {
  window.igStoriesInstance = initInstagramStories();
  setTimeout(() => thumbnailPreloader.observeAvatars(), 500);
}

