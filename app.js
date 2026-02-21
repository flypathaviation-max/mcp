const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * MCP control definitions (ajusta a tu gusto)
 * steps:
 *  - step: incremento normal
 *  - stepFast: incremento con Shift
 */
const controls = {
  course:   { value: 165, min: 0, max: 359, step: 1,   stepFast: 10,  wrap: true  },
  speed:    { value: 100, min: 0, max: 450, step: 1,   stepFast: 10,  wrap: false },
  heading:  { value: 130, min: 0, max: 359, step: 1,   stepFast: 10,  wrap: true  },
  altitude: { value: 31000, min: 0, max: 45000, step: 100, stepFast: 1000, wrap: false },
  vs:       { value: 0,   min: -6000, max: 6000, step: 100, stepFast: 500,  wrap: false }
};

const ui = {
  course:   { valueEl: document.getElementById("courseValue"),   knobEl: document.getElementById("courseKnob"),   markerEl: document.getElementById("courseMarker") },
  speed:    { valueEl: document.getElementById("speedValue"),    knobEl: document.getElementById("speedKnob"),    markerEl: document.getElementById("speedMarker") },
  heading:  { valueEl: document.getElementById("headingValue"),  knobEl: document.getElementById("headingKnob"),  markerEl: document.getElementById("headingMarker") },
  altitude: { valueEl: document.getElementById("altitudeValue"), knobEl: document.getElementById("altitudeKnob"), markerEl: document.getElementById("altitudeMarker") },
  vs:       { valueEl: document.getElementById("vsValue"),       knobEl: document.getElementById("vsKnob"),       markerEl: document.getElementById("vsMarker") },
};

function normalizeWrap(val, min, max){
  const range = (max - min) + 1;
  let x = (val - min) % range;
  if (x < 0) x += range;
  return x + min;
}

function setValue(key, nextVal){
  const c = controls[key];
  if (c.wrap) {
    c.value = normalizeWrap(nextVal, c.min, c.max);
  } else {
    c.value = clamp(nextVal, c.min, c.max);
  }
  render(key);
}

function deltaValue(key, delta, fast=false){
  const c = controls[key];
  const step = fast ? c.stepFast : c.step;
  setValue(key, c.value + delta * step);
}

function angleForControl(key){
  // Visual simple: mapea el valor al ángulo del marcador (0..300° aprox) para que no sea 360 completo.
  const c = controls[key];
  const t = (c.value - c.min) / (c.max - c.min);
  const start = -140;      // grados
  const sweep = 280;       // grados
  return start + t * sweep;
}

function render(key){
  const c = controls[key];
  const u = ui[key];

  u.valueEl.textContent = c.value;

  // Accesibilidad (slider)
  u.knobEl.setAttribute("aria-valuenow", String(c.value));

  const a = angleForControl(key);
  u.markerEl.style.transform = `translate(-50%, -100%) rotate(${a}deg)`;
}

function renderAll(){
  Object.keys(controls).forEach(render);
}

// Botones + / -
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const target = btn.dataset.target;
  if (!controls[target]) return;

  const fast = e.shiftKey;
  deltaValue(target, action === "inc" ? +1 : -1, fast);
});

// Rueda del ratón sobre knob o display (sube/baja)
Object.keys(ui).forEach((key) => {
  const u = ui[key];
  const wheelTargets = [u.knobEl, u.valueEl.closest(".display")];

  wheelTargets.forEach((el) => {
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const fast = e.shiftKey;
      const dir = e.deltaY < 0 ? +1 : -1; // rueda arriba = incrementa
      deltaValue(key, dir, fast);
    }, { passive:false });
  });
});

// Drag (arrastrar) sobre el knob: delta por movimiento vertical y horizontal
function attachDrag(key){
  const { knobEl } = ui[key];
  let dragging = false;
  let lastX = 0, lastY = 0;
  let acc = 0;

  const onDown = (e) => {
    dragging = true;
    knobEl.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
    acc = 0;
  };

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = lastY - e.clientY; // arriba positivo
    lastX = e.clientX;
    lastY = e.clientY;

    // mezcla: vertical pesa más
    const raw = (dy * 1.0) + (dx * 0.35);

    // acumulador para no ir demasiado sensible
    acc += raw;

    // cada ~10px => 1 "click"
    const threshold = 10;
    const fast = e.shiftKey;

    while (acc >= threshold) { deltaValue(key, +1, fast); acc -= threshold; }
    while (acc <= -threshold){ deltaValue(key, -1, fast); acc += threshold; }
  };

  const onUp = () => { dragging = false; };

  knobEl.addEventListener("pointerdown", onDown);
  knobEl.addEventListener("pointermove", onMove);
  knobEl.addEventListener("pointerup", onUp);
  knobEl.addEventListener("pointercancel", onUp);

  // Teclado (flechas)
  knobEl.addEventListener("keydown", (e) => {
    const fast = e.shiftKey;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); deltaValue(key, +1, fast); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); deltaValue(key, -1, fast); }
    if (e.key === "Home") { e.preventDefault(); setValue(key, controls[key].min); }
    if (e.key === "End")  { e.preventDefault(); setValue(key, controls[key].max); }
  });
}

Object.keys(ui).forEach(attachDrag);

// Reset
document.getElementById("resetBtn").addEventListener("click", () => {
  controls.course.value = 165;
  controls.speed.value = 100;
  controls.heading.value = 130;
  controls.altitude.value = 31000;
  controls.vs.value = 0;
  renderAll();
});

renderAll();
