/* Retrospectiva — trilha e efeitos com Web Audio, sem arquivos.
 *
 * Pad de acordes lentos a 90 BPM, whoosh nas transições, ticks no
 * contador subindo de tom e um acorde no final. Os eventos vêm de
 * FC.recap.eventos, a mesma linha do tempo do vídeo. O som só nasce
 * depois de um gesto do usuário (o player cria o AudioContext no play).
 *
 * master → alto-falante (com mudo) e → gravação (sempre, para o vídeo
 * exportado sair com som mesmo com o mudo ligado). */
(function () {
  const FC = window.FC;
  const COMPASSO = (60 / 90) * 4;    // 4 tempos a 90 BPM ≈ 2,67 s
  // acordes em Hz (voicing aberto); mês negativo usa uma progressão mais escura
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CLARO = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 66]];   // Cmaj7 Am7 Fmaj7 G(add)
  const ESCURO = [[45, 52, 60, 67], [41, 48, 57, 64], [38, 45, 53, 60], [40, 47, 55, 62]];  // Am7 Fmaj7 Dm7 Em7

  function criar(data, opts = {}) {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = 0.9;
    const alto = ac.createGain(); alto.gain.value = 1;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(alto); alto.connect(ac.destination);
    const gravacao = ac.createMediaStreamDestination();
    comp.connect(gravacao);

    // ruído branco determinístico (semente do mês) para os whooshes
    const ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    let s = data.seed >>> 0 || 7;
    const ch = ruido.getChannelData(0);
    for (let i = 0; i < ch.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; ch[i] = s / 2147483648 - 1; }

    const { eventos, total, positivo } = FC.recap.eventos(data, opts);
    let ativos = [];

    const guarda = (n) => { ativos.push(n); n.onended = () => { ativos = ativos.filter((x) => x !== n); }; return n; };

    function pad(quando, dur, notas, ganho = 0.045) {
      const g = ac.createGain();
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; f.Q.value = 0.4;
      g.connect(f); f.connect(master);
      g.gain.setValueAtTime(0, quando);
      g.gain.linearRampToValueAtTime(ganho, quando + Math.min(0.9, dur * 0.4));
      g.gain.setValueAtTime(ganho, quando + dur - 0.2);
      g.gain.linearRampToValueAtTime(0, quando + dur + 1.2);
      for (const m of notas) {
        for (const [tipo, det] of [["sine", -6], ["triangle", 5]]) {
          const o = guarda(ac.createOscillator());
          o.type = tipo; o.frequency.value = N(m); o.detune.value = det;
          o.connect(g); o.start(quando); o.stop(quando + dur + 1.3);
        }
      }
    }
    function whoosh(quando) {
      const src = guarda(ac.createBufferSource()); src.buffer = ruido;
      const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(260, quando); f.frequency.exponentialRampToValueAtTime(3200, quando + 0.32);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, quando); g.gain.linearRampToValueAtTime(0.16, quando + 0.12); g.gain.exponentialRampToValueAtTime(0.001, quando + 0.45);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(quando); src.stop(quando + 0.5);
    }
    function tick(quando, freq) {
      const o = guarda(ac.createOscillator()); o.type = "sine"; o.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, quando); g.gain.exponentialRampToValueAtTime(0.05, quando + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.035);
      o.connect(g); g.connect(master); o.start(quando); o.stop(quando + 0.05);
    }
    // batida leve: bumbo nos tempos, chimbal nos contratempos
    function bumbo(quando) {
      const o = guarda(ac.createOscillator()); o.type = "sine";
      o.frequency.setValueAtTime(130, quando); o.frequency.exponentialRampToValueAtTime(45, quando + 0.18);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, quando); g.gain.exponentialRampToValueAtTime(0.22, quando + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.3);
      o.connect(g); g.connect(master); o.start(quando); o.stop(quando + 0.32);
    }
    function chimbal(quando) {
      const src = guarda(ac.createBufferSource()); src.buffer = ruido;
      const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, quando); g.gain.exponentialRampToValueAtTime(0.035, quando + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.06);
      src.connect(f); f.connect(g); g.connect(master); src.start(quando, (quando * 7.3) % 0.8); src.stop(quando + 0.08);
    }
    function ding(quando) {
      for (const [m, a] of [[84, 0.07], [91, 0.035]]) {
        const o = guarda(ac.createOscillator()); o.type = "triangle"; o.frequency.value = N(m);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, quando); g.gain.exponentialRampToValueAtTime(a, quando + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.9);
        o.connect(g); g.connect(master); o.start(quando); o.stop(quando + 1);
      }
    }

    // agenda tudo a partir do instante t do vídeo
    function toca(t) {
      para();
      const agora = ac.currentTime + 0.03, em = (x) => agora + (x - t);
      const prog = positivo ? CLARO : ESCURO;
      const corpo = total - 4.5;   // a etapa final só tem o acorde
      const tempo = COMPASSO / 4;
      for (let b = Math.ceil(t / tempo) * tempo; b < corpo; b += tempo) {
        // a batida entra depois da abertura e respira nas trocas de etapa
        if (b < 1.6) continue;
        bumbo(em(b));
        chimbal(em(b + tempo / 2));
      }
      for (let k = 0, ini = 0; ini < corpo; k++, ini += COMPASSO) {
        const fim = Math.min(corpo, ini + COMPASSO);
        if (fim <= t) continue;
        const de = Math.max(ini, t);
        pad(em(de), fim - de, prog[k % prog.length]);
      }
      for (const e of eventos) {
        if (e.t < t - 0.01) continue;
        if (e.tipo === "whoosh") whoosh(em(e.t));
        else if (e.tipo === "tick") tick(em(e.t), e.freq);
        else if (e.tipo === "ding") ding(em(e.t));
        else if (e.tipo === "acorde") pad(em(e.t), 2.2, prog[0].concat([prog[0][0] + 24]), 0.07);
      }
    }
    function para() {
      for (const n of ativos) { try { n.onended = null; n.stop(); } catch (e) { /* já parou */ } }
      ativos = [];
    }

    return {
      toca, para,
      mudo(v) { alto.gain.setTargetAtTime(v ? 0 : 1, ac.currentTime, 0.02); },
      retoma: () => ac.resume(),
      fluxo: gravacao.stream,
      fecha() { para(); ac.close(); },
    };
  }

  FC.recapAudio = { criar };
})();
