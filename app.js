const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const controls = {
  course:   { value: 165,   min: 0,     max: 359,   step: 1,   stepFast: 10,   wrap: true  },
  speed:    { value: 100,   min: 0,     max: 450,   step: 1,   stepFast: 10,   wrap: false },
  heading:  { value: 130,   min: 0,     max: 359,   step: 1,   stepFast: 10,   wrap: true  },
  altitude: { value: 31000, min: 0,     max: 45000, step: 100, stepFast: 1000, wrap: false },
  vs:       { value: 0,     min: -6000, max: 6000,  step: 100, stepFast: 500,  wrap: false }
};

const ui = {
  course:   { disp: $("#courseDisp"),   knob: $("#courseKnob"),   ptr: $("#coursePtr") },
  speed:    { disp: $("#speedDisp"),    knob: $("#speedKnob"),    ptr: $("#speedPtr") },
  heading:  { disp: $("#headingDisp"),  knob: $("#headingKnob"),  ptr: $("#headingPtr") },
  altitude: { disp: $("#altitudeDisp"), knob: $("#altitudeKnob"), ptr: $("#altitudePtr") },
  vs:       { disp: $("#vsDisp"),       wheel: $("#vsWheel") }
};

function $(sel){ return document.querySelector(sel); }

function normalizeWrap(val, min, max){
  const range = (max - min) + 1;
  let x = (val - min) % range;
  if (x < 0) x += range;
  return x + min;
}

function setValue(key, nextVal){
  const c = controls[key];
  c.value = c.wrap ? normalizeWrap(nextVal, c.min, c.max) : clamp(nextVal, c.min, c.max);
  render(key);
}

function deltaValue(key, dir, fast=false){
  const c = controls[key];
  const step = fast ? c.stepFast : c.step;
  setValue(key, c.value + dir * step);
}

function angleFor(key){
  // Mapeo visual (no 360 completo) para dar sensación MCP
  const c = controls[key];
  const t = (c.value - c.min) / (c.max - c.min);
  const start = -120;
  const sweep = 240;
  return start + t * sweep;
}

function render(key){
  const c = controls[key];
  const u = ui[key];

  if (u.disp) u.disp.textContent = String(c.value);

  if (u.knob){
    u.knob.setAttribute("aria-valuenow", String(c.value));
    u.ptr.style.transform = `translate(-50%, -100%) rotate(${angleFor(key)}deg)`;
  }
  if (u.wheel){
    u.wheel.setAttribute("aria-valuenow", String(c.value));
    // feedback visual: mueve el “stripe” un pelín con el valor
    const stripe = u.wheel.querySelector(".thumbwheel__stripe");
    const t = (c.value - c.min) / (c.max - c.min);
    stripe.style.transform = `translate(-50%, -50%) translateY(${(0.5 - t) * 8}px)`;
  }
}

function renderAll(){ Object.keys(controls).forEach(render); }

/* Botones +/- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const key = b.dataset.target;
  if (!controls[key]) return;
  const fast = e.shiftKey;
  deltaValue(key, b.dataset.action === "inc" ? +1 : -1, fast);
});

/* Rueda ratón sobre knobs y displays */
function addWheel(el, key){
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    const fast = e.shiftKey;
    const dir = e.deltaY < 0 ? +1 : -1;
    deltaValue(key, dir, fast);
  }, { passive:false });
}

["course","speed","heading","altitude"].forEach((key)=>{
  const u = ui[key];
  addWheel(u.knob, key);
  addWheel(u.disp.closest(".disp"), key);
});

addWheel(ui.vs.wheel, "vs");
addWheel(ui.vs.disp.closest(".disp"), "vs");

/* Drag knobs (arrastrar) */
function attachDragKnob(key){
  const el = ui[key].knob;
  let dragging=false, lastX=0, lastY=0, acc=0;

  el.addEventListener("pointerdown", (e)=>{
    dragging=true;
    el.setPointerCapture(e.pointerId);
    lastX=e.clientX; lastY=e.clientY;
    acc=0;
  });
  el.addEventListener("pointermove", (e)=>{
    if(!dragging) return;
    const dx = e.clientX - lastX;
    const dy = lastY - e.clientY;
    lastX=e.clientX; lastY=e.clientY;

    const raw = (dy * 1.0) + (dx * 0.35);
    acc += raw;

    const threshold = 10;
    const fast = e.shiftKey;
    while(acc >= threshold){ deltaValue(key, +1, fast); acc -= threshold; }
    while(acc <= -threshold){ deltaValue(key, -1, fast); acc += threshold; }
  });
  const stop = ()=> dragging=false;
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);

  // teclado
  el.addEventListener("keydown", (e)=>{
    const fast = e.shiftKey;
    if (e.key === "ArrowUp" || e.key === "ArrowRight"){ e.preventDefault(); deltaValue(key, +1, fast); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft"){ e.preventDefault(); deltaValue(key, -1, fast); }
    if (e.key === "Home"){ e.preventDefault(); setValue(key, controls[key].min); }
    if (e.key === "End"){ e.preventDefault(); setValue(key, controls[key].max); }
  });
}

["course","speed","heading","altitude"].forEach(attachDragKnob);

/* Drag thumbwheel V/S */
(function attachVsDrag(){
  const el = ui.vs.wheel;
  let dragging=false, lastY=0, acc=0;

  el.addEventListener("pointerdown", (e)=>{
    dragging=true;
    el.setPointerCapture(e.pointerId);
    lastY=e.clientY;
    acc=0;
  });
  el.addEventListener("pointermove", (e)=>{
    if(!dragging) return;
    const dy = lastY - e.clientY; // arriba +
    lastY=e.clientY;
    acc += dy;

    const threshold = 8;
    const fast = e.shiftKey;
    while(acc >= threshold){ deltaValue("vs", +1, fast); acc -= threshold; }
    while(acc <= -threshold){ deltaValue("vs", -1, fast); acc += threshold; }
  });
  const stop=()=> dragging=false;
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);

  el.addEventListener("keydown", (e)=>{
    const fast = e.shiftKey;
    if (e.key === "ArrowUp"){ e.preventDefault(); deltaValue("vs", +1, fast); }
    if (e.key === "ArrowDown"){ e.preventDefault(); deltaValue("vs", -1, fast); }
    if (e.key === "Home"){ e.preventDefault(); setValue("vs", controls.vs.min); }
    if (e.key === "End"){ e.preventDefault(); setValue("vs", controls.vs.max); }
  });
})();

/* Reset */
$("#resetBtn").addEventListener("click", ()=>{
  controls.course.value=165;
  controls.speed.value=100;
  controls.heading.value=130;
  controls.altitude.value=31000;
  controls.vs.value=0;
  renderAll();
});

renderAll();
