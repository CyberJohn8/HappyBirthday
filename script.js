// =====================================================
//  CONFIGURACIÓN
// =====================================================
const CORREO_AUTORIZADO = "Sarnmyjoygriffin@gmail.com"; // 👈 cambia por el correo real
const STORAGE_KEY       = "correoInvitado";

// =====================================================
//  REFERENCIAS DOM
// =====================================================
const mensajeEl   = document.getElementById("mensaje");
const panelCorreo = document.getElementById("panelCorreo");
const inputCorreo = document.getElementById("inputCorreo");
const btnGuardar  = document.getElementById("btnGuardar");
const btnCerrar   = document.getElementById("btnCerrar");
const canvas      = document.getElementById("mono");
const ctx         = canvas.getContext("2d");

// =====================================================
//  ESTADOS
// =====================================================
const ESTADO = { QUIEN_ERES: "quien", CHISMOSO: "chismoso", CUMPLE: "cumple" };
let estadoActual = ESTADO.QUIEN_ERES;

// =====================================================
//  AUDIO — MELODÍA ORQUESTADA (Web Audio API)
//  4 capas: melodía + bajo + armonía + campanitas
// =====================================================
let audioCtx          = null;
let masterGain        = null;
let compresor         = null;
let musicaActiva      = false;
let musicaPendiente   = false;   // 👈 NUEVO: quiere sonar pero espera desbloqueo
let melodiaLoopId     = null;
let audioDesbloqueado = false;

// Notas (melodía principal)
const MELODIA = [
  // Cum-ple-a-ños fe-liz
  { nota: 261.63, dur: 0.35 }, // Do4
  { nota: 261.63, dur: 0.35 },
  { nota: 293.66, dur: 0.7  }, // Re4
  { nota: 261.63, dur: 0.7  },
  { nota: 349.23, dur: 0.7  }, // Fa4
  { nota: 329.63, dur: 1.0  }, // Mi4
  // Cum-ple-a-ños fe-liz
  { nota: 261.63, dur: 0.35 },
  { nota: 261.63, dur: 0.35 },
  { nota: 293.66, dur: 0.7  },
  { nota: 261.63, dur: 0.7  },
  { nota: 392.00, dur: 0.7  }, // Sol4
  { nota: 349.23, dur: 1.0  }, // Fa4
  // Cum-ple-a-ños fe-liz
  { nota: 261.63, dur: 0.35 },
  { nota: 261.63, dur: 0.35 },
  { nota: 523.25, dur: 0.7  }, // Do5
  { nota: 440.00, dur: 0.7  }, // La4
  { nota: 349.23, dur: 0.7  }, // Fa4
  { nota: 329.63, dur: 0.7  }, // Mi4
  { nota: 293.66, dur: 1.0  }, // Re4
  // Cum-ple-a-ños fe-liz
  { nota: 466.16, dur: 0.35 }, // Sib4
  { nota: 466.16, dur: 0.35 },
  { nota: 440.00, dur: 0.7  }, // La4
  { nota: 349.23, dur: 0.7  }, // Fa4
  { nota: 392.00, dur: 0.7  }, // Sol4
  { nota: 349.23, dur: 1.4  }  // Fa4
];

const DURACION_MELODIA = MELODIA.reduce((s, n) => s + n.dur, 0);

// ----- Cadena maestra (ganancia + compresor) -----
function inicializarCadenaAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  compresor = audioCtx.createDynamicsCompressor();
  compresor.threshold.setValueAtTime(-20, audioCtx.currentTime);
  compresor.knee.setValueAtTime(30, audioCtx.currentTime);
  compresor.ratio.setValueAtTime(8, audioCtx.currentTime);
  compresor.attack.setValueAtTime(0.003, audioCtx.currentTime);
  compresor.release.setValueAtTime(0.25, audioCtx.currentTime);

  masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

  masterGain.connect(compresor);
  compresor.connect(audioCtx.destination);
}

// Desbloqueo por primer gesto del usuario
function desbloquearAudio() {
  inicializarCadenaAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  audioDesbloqueado = true;

  // Si estamos en cumple y la música quedó pendiente, arrancarla ahora
  if (estadoActual === ESTADO.CUMPLE && musicaPendiente && !musicaActiva) {
    iniciarMusica();
  }
}

["click", "touchstart", "keydown"].forEach(evt => {
  document.addEventListener(evt, desbloquearAudio, { once: true });
});

// =====================================================
//  INSTRUMENTOS
// =====================================================

// 🎹 1) MELODÍA PRINCIPAL — triangle + octava (campana/piano)
function tocarMelodia(freq, duracion, t0) {
  const durReal = duracion * 0.92;

  const osc1 = audioCtx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, t0);

  const osc2 = audioCtx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 2, t0);

  const g1 = audioCtx.createGain();
  g1.gain.setValueAtTime(0.0001, t0);
  g1.gain.exponentialRampToValueAtTime(0.32, t0 + 0.015);
  g1.gain.exponentialRampToValueAtTime(0.0001, t0 + durReal);

  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(0.10, t0 + 0.015);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + durReal * 0.9);

  osc1.connect(g1).connect(masterGain);
  osc2.connect(g2).connect(masterGain);
  osc1.start(t0); osc1.stop(t0 + durReal + 0.05);
  osc2.start(t0); osc2.stop(t0 + durReal + 0.05);
}

// 🎸 2) BAJO — sine grave una octava abajo
function tocarBajo(freq, duracion, t0) {
  const durReal = duracion * 1.05;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq / 2, t0);

  const filtro = audioCtx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(400, t0);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durReal);

  osc.connect(filtro).connect(g).connect(masterGain);
  osc.start(t0); osc.stop(t0 + durReal + 0.05);
}

// 🎺 3) ARMONÍA — sawtooth filtrado (3ª menor abajo)
function tocarArmonia(freq, duracion, t0) {
  const durReal = duracion * 0.95;

  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq * 0.8, t0);

  const filtro = audioCtx.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.setValueAtTime(1200, t0);
  filtro.Q.setValueAtTime(1.2, t0);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durReal);

  osc.connect(filtro).connect(g).connect(masterGain);
  osc.start(t0); osc.stop(t0 + durReal + 0.05);
}

// ✨ 4) CAMPANITAS — sine agudo una octava arriba, decay corto
function tocarCampanitas(freq, duracion, t0) {
  const durReal = Math.min(duracion * 0.6, 0.5);

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 2, t0);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durReal);

  osc.connect(g).connect(masterGain);
  osc.start(t0); osc.stop(t0 + durReal + 0.05);
}

// =====================================================
//  PROGRAMACIÓN DE LA VUELTA COMPLETA
// =====================================================
function esNotaFuerte(indice) {
  return [0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25].includes(indice);
}

function programarVuelta(t0) {
  let t = t0;

  MELODIA.forEach((n, i) => {
    // 1) Melodía principal siempre
    tocarMelodia(n.nota, n.dur, t);

    // 2) Bajo en notas fuertes
    if (esNotaFuerte(i) || i === 0) {
      tocarBajo(n.nota, n.dur, t);
    }

    // 3) Armonía en notas largas
    if (n.dur >= 0.6) {
      tocarArmonia(n.nota, n.dur, t);
    }

    // 4) Campanitas en notas agudas o cada 2 notas
    if (i % 2 === 0 || n.nota >= 440) {
      tocarCampanitas(n.nota, n.dur, t);
    }

    t += n.dur;
  });
}

function iniciarMusica() {
  if (musicaActiva) return;
  if (!audioDesbloqueado) return;   // esperará al primer gesto
  if (!audioCtx) return;

  musicaActiva    = true;
  musicaPendiente = false;          // ya está sonando, no hay pendiente

  const programarSiguiente = () => {
    if (!musicaActiva) return;
    const ahora = audioCtx.currentTime;
    programarVuelta(ahora + 0.05);
    melodiaLoopId = setTimeout(programarSiguiente, (DURACION_MELODIA - 0.05) * 1000);
  };
  programarSiguiente();
}

function detenerMusica() {
  musicaActiva    = false;
  musicaPendiente = false;          // 👈 limpiar bandera
  if (melodiaLoopId) {
    clearTimeout(melodiaLoopId);
    melodiaLoopId = null;
  }
  if (masterGain) {
    try {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch (e) {}
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx          = null;
    masterGain        = null;
    compresor         = null;
    audioDesbloqueado = false;
  }
}

// =====================================================
//  DIBUJO DEL MONO
// =====================================================
function dibujarBaseMono(t, offsetY, sonrisa, tipoOjos) {
  const cx = canvas.width / 2;
  const cy = 160 + offsetY;

  // Sombra
  const escalaSombra = 1 - Math.min(Math.abs(offsetY) / 100, 0.5);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx, 285, 55 * escalaSombra, 12 * escalaSombra, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cuerpo
  ctx.fillStyle = "#8B5A2B";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 60, 55, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  // Panza
  ctx.fillStyle = "#D2B48C";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 75, 32, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orejas
  ctx.fillStyle = "#8B5A2B";
  ctx.beginPath(); ctx.arc(cx - 55, cy - 15, 18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 55, cy - 15, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#F5DEB3";
  ctx.beginPath(); ctx.arc(cx - 55, cy - 15, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 55, cy - 15, 10, 0, Math.PI * 2); ctx.fill();

  // Cabeza
  ctx.fillStyle = "#A0522D";
  ctx.beginPath();
  ctx.arc(cx, cy - 20, 50, 0, Math.PI * 2);
  ctx.fill();

  // Cara
  ctx.fillStyle = "#F5DEB3";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, 38, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ojos
  const parpadeo = Math.sin(t / 700) > 0.95 ? 0.1 : 1;
  if (tipoOjos === "feliz") {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx - 15, cy - 15, 8, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 15, cy - 15, 8, Math.PI, 0); ctx.stroke();
  } else if (tipoOjos === "sospechoso") {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 22, cy - 20); ctx.lineTo(cx - 8, cy - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8, cy - 20);  ctx.lineTo(cx + 22, cy - 20); ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(cx - 15, cy - 16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 15, cy - 16, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(cx - 15, cy - 20, 6, 8 * parpadeo, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 15, cy - 20, 6, 8 * parpadeo, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx - 13, cy - 23, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 17, cy - 23, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Nariz
  ctx.fillStyle = "#5C3317";
  ctx.beginPath(); ctx.ellipse(cx, cy + 2, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3E2010";
  ctx.beginPath(); ctx.arc(cx - 4, cy + 3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy + 3, 1.5, 0, Math.PI * 2); ctx.fill();

  // Boca
  ctx.strokeStyle = "#5C3317";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const radioBoca = 6 + sonrisa * 12;
  const inicio = 0.15 * Math.PI - sonrisa * 0.05 * Math.PI;
  const fin    = 0.85 * Math.PI + sonrisa * 0.05 * Math.PI;
  ctx.arc(cx, cy + 12, radioBoca, inicio, fin);
  ctx.stroke();

  // Mejillas
  ctx.fillStyle = `rgba(255,120,150,${0.3 + sonrisa * 0.3})`;
  ctx.beginPath(); ctx.arc(cx - 28, cy + 8, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 28, cy + 8, 7, 0, Math.PI * 2); ctx.fill();
}

function dibujarEstrella(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    const x1 = x + Math.cos(a) * r;
    const y1 = y + Math.sin(a) * r;
    const a2 = a + Math.PI / 5;
    const x2 = x + Math.cos(a2) * r * 0.45;
    const y2 = y + Math.sin(a2) * r * 0.45;
    if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
}

// --- Animación 1: ¿Quién eres? ---
function animQuienEres(t) {
  dibujarBaseMono(t, 0, 0, "normal");
  const cx = canvas.width / 2;
  const cy = 160;

  const ang = Math.sin(t / 250) * 0.4;
  ctx.strokeStyle = "#8B5A2B";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 45, cy + 50);
  ctx.quadraticCurveTo(cx - 70, cy + 10 + Math.sin(t / 400) * 5, cx - 25 + ang * 20, cy - 55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 45, cy + 50);
  ctx.lineTo(cx + 65, cy + 80);
  ctx.stroke();

  ctx.fillStyle = "#4D96FF";
  ctx.font = "bold 22px sans-serif";
  const yQ = cy - 70 + Math.sin(t / 300) * 6;
  ctx.fillText("?", cx - 70, yQ);
  ctx.fillText("?", cx + 55, yQ + 15);
  ctx.fillText("?", cx + 10, yQ - 20 + Math.sin(t / 250) * 5);
}

// --- Animación 2: No seas chismoso ---
function animChismoso(t) {
  const negar = Math.sin(t / 200) * 4;
  const cx = canvas.width / 2 + negar;
  const cy = 160;

  dibujarBaseMono(t, 0, -0.3, "sospechoso");

  ctx.strokeStyle = "#8B5A2B";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 45, cy + 50);
  ctx.quadraticCurveTo(cx - 30, cy + 80, cx + 30, cy + 60);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 45, cy + 50);
  ctx.quadraticCurveTo(cx + 30, cy + 80, cx - 30, cy + 60);
  ctx.stroke();

  ctx.strokeStyle = "#d9534f";
  ctx.lineWidth = 4;
  const yN = cy - 75 + Math.sin(t / 300) * 5;
  ctx.beginPath(); ctx.arc(cx + 70, yN, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 62, yN - 8); ctx.lineTo(cx + 78, yN + 8); ctx.stroke();
}

// --- Animación 3: Fiesta FLUIDA (independiente de la música) ---
function animFiesta(t) {
  const salto = Math.abs(Math.sin(t / 220)) * 30;
  const swing = Math.sin(t / 130) * 18;

  dibujarBaseMono(t, -salto, 1, "feliz");

  const cx = canvas.width / 2;
  const cy = 160 - salto;

  // Brazos arriba oscilando
  ctx.strokeStyle = "#8B5A2B";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 45, cy + 50);
  ctx.lineTo(cx - 80 + swing, cy - 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 45, cy + 50);
  ctx.lineTo(cx + 80 - swing, cy - 5);
  ctx.stroke();

  // Confeti
  const colores = ["#FF6B9D", "#FFD93D", "#6BCB77", "#4D96FF", "#FF8C42"];
  for (let i = 0; i < 30; i++) {
    const x = (i * 41 + t / 18) % canvas.width;
    const y = ((i * 57 + t / 12) % (canvas.height + 40)) - 20;
    ctx.fillStyle = colores[i % colores.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t / 300 + i);
    ctx.fillRect(-3, -5, 6, 10);
    ctx.restore();
  }

  // Globos
  const globos = [
    { x: 45,  color: "#FF6B9D", fase: 0   },
    { x: 275, color: "#4D96FF", fase: 1.2 },
    { x: 160, color: "#FFD93D", fase: 2.4 }
  ];
  globos.forEach((g) => {
    const y = 60 + Math.sin(t / 400 + g.fase) * 15;
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.ellipse(g.x, y, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.x, y + 18);
    ctx.lineTo(g.x, y + 45);
    ctx.stroke();
  });

  // Estrellitas
  ctx.fillStyle = "#FFD93D";
  for (let i = 0; i < 5; i++) {
    const ang = (t / 400) + i * (Math.PI * 2 / 5);
    dibujarEstrella(cx + Math.cos(ang) * 70, cy - 30 + Math.sin(ang) * 40, 4);
  }
}

// --- Loop principal ---
function loop(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (estadoActual === ESTADO.CUMPLE) animFiesta(t);
  else if (estadoActual === ESTADO.CHISMOSO) animChismoso(t);
  else animQuienEres(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// =====================================================
//  LÓGICA DE ESTADOS
// =====================================================
function setEstado(estado) {
  estadoActual = estado;
  mensajeEl.classList.remove("festejo", "chismoso");
  panelCorreo.style.display = "none";
  btnCerrar.style.display = "none";

  if (estado === ESTADO.CUMPLE) {
    // Unimos los 3 mensajes en uno solo (\n + CSS white-space: pre-line)
    mensajeEl.textContent =
      "🎉 ¡FELIZ CUMPLEAÑOS! 🎉\n" +
      "🎂 Sammy 🐵\n" +
      "Ahora eres miembro del\n" +
      "Club de los 🦧\n" +
      " 🦧 = VIEJOS ";
    mensajeEl.classList.add("festejo");
    btnCerrar.style.display = "inline-block";

    // Forzar música activa: se reintenta al desbloquear audio si hace falta
    musicaPendiente = true;
    iniciarMusica();
  } else if (estado === ESTADO.CHISMOSO) {
    mensajeEl.textContent = "🙉 No seas chismoso... esta tarjeta no es para ti 🙈";
    mensajeEl.classList.add("chismoso");
    btnCerrar.style.display = "inline-block";
    panelCorreo.style.display = "flex";
    musicaPendiente = false;
    detenerMusica();
  } else {
    mensajeEl.textContent = "🐒 ¿Quién eres? Ingresa tu correo para ver la sorpresa... 🙊";
    panelCorreo.style.display = "flex";
    musicaPendiente = false;
    detenerMusica();
  }
}

function evaluarCorreo(correo) {
  const limpio = (correo || "").toLowerCase().trim();
  if (!limpio)                              return setEstado(ESTADO.QUIEN_ERES);
  if (limpio === CORREO_AUTORIZADO.toLowerCase()) return setEstado(ESTADO.CUMPLE);
  setEstado(ESTADO.CHISMOSO);
}

// Al cargar: comparación automática con lo guardado
window.addEventListener("DOMContentLoaded", () => {
  evaluarCorreo(localStorage.getItem(STORAGE_KEY));
});

btnGuardar.addEventListener("click", () => {
  const valor = inputCorreo.value.trim();
  if (!valor) return inputCorreo.focus();
  localStorage.setItem(STORAGE_KEY, valor);
  evaluarCorreo(valor);
});

inputCorreo.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnGuardar.click();
});

btnCerrar.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  setEstado(ESTADO.QUIEN_ERES);
});
