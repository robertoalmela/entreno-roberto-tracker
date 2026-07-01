const STORAGE_KEY = 'entreno-roberto-state-v1';

const templates = {
  A: {
    title: 'Día A · Torso',
    exercises: [
      ['Press banca barra o mancuernas', '3×10 · peso de 15, haces 10'],
      ['Remo con mancuerna o barra', '3×10 · espalda firme'],
      ['Press militar', '2×10 · sin forzar cuello'],
      ['Elevaciones laterales', '2×12 · controladas'],
      ['Curl barra Z', '2×10'],
      ['Tríceps francés o extensión', '2×10']
    ]
  },
  B: {
    title: 'Día B · Pierna/full body',
    exercises: [
      ['Peso muerto rumano', '3×10 · espalda neutra'],
      ['Sentadilla goblet o barra ligera', '3×10'],
      ['Zancadas o búlgaras asistidas', '2×8 por pierna'],
      ['Remo o flexiones', '2×10'],
      ['Plancha', '2×30–45 s']
    ]
  }
};

let state = loadState();
let timerInterval = null;

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { sessions: [], active: null }; }
  catch { return { sessions: [], active: null }; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtTime = iso => new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
const fmtDate = iso => new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
const minutesBetween = (a,b=new Date().toISOString()) => Math.max(0, Math.round((new Date(b)-new Date(a))/60000));
const pad = n => String(n).padStart(2,'0');
function formatDuration(min){ return `${pad(Math.floor(min/60))}:${pad(min%60)}`; }

function startWorkout(type){
  if(state.active && !confirm('Ya hay una sesión activa. ¿Descartarla y empezar otra?')) return;
  const tpl = templates[type];
  state.active = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type,
    title: tpl.title,
    start: new Date().toISOString(),
    exercises: tpl.exercises.map(([name,target]) => ({
      name, target,
      sets: defaultSets(target).map(() => ({ weight:'', reps:'', reserve:'5', technique:'si' }))
    }))
  };
  saveState();
  render();
}

function defaultSets(target){
  const match = target.match(/(\d+)×/);
  const count = match ? Number(match[1]) : 2;
  return Array.from({length: count});
}

function updateActiveFromDOM(){
  if(!state.active) return;
  $$('.set-row').forEach(row => {
    const e = Number(row.dataset.exercise);
    const s = Number(row.dataset.set);
    const set = state.active.exercises[e].sets[s];
    set.weight = row.querySelector('[data-field="weight"]').value;
    set.reps = row.querySelector('[data-field="reps"]').value;
    set.reserve = row.querySelector('[data-field="reserve"]').value;
    set.technique = row.querySelector('[data-field="technique"]').value;
  });
  saveState();
  renderRecommendationsOnly();
}

function addSet(exIndex){
  state.active.exercises[exIndex].sets.push({ weight:'', reps:'', reserve:'5', technique:'si' });
  saveState(); render();
}

function removeSet(exIndex,setIndex){
  state.active.exercises[exIndex].sets.splice(setIndex,1);
  saveState(); render();
}

function finishWorkout(){
  if(!state.active) return;
  updateActiveFromDOM();
  const hasData = state.active.exercises.some(ex => ex.sets.some(s => Number(s.reps) > 0));
  if(!hasData && !confirm('No has apuntado ninguna serie. ¿Guardar la sesión vacía igualmente?')) return;
  const session = { ...state.active, end: new Date().toISOString() };
  state.sessions.unshift(session);
  state.active = null;
  saveState(); render();
}

function recommendation(ex){
  const valid = ex.sets.filter(s => Number(s.reps) > 0 && Number(s.weight) >= 0);
  if(!valid.length) return { cls:'', text:'Rellena al menos una serie.' };
  const avgReserve = valid.reduce((a,s)=>a+Number(s.reserve),0)/valid.length;
  const minReps = Math.min(...valid.map(s=>Number(s.reps)));
  const badTechnique = valid.some(s=>s.technique === 'no');
  if(badTechnique || avgReserve <= 1 || minReps < 8) return { cls:'down', text:'Baja peso o reduce una serie. Queremos técnica limpia y sin sufrir.' };
  if(avgReserve >= 4 && minReps >= 10) return { cls:'up', text:'Verde: próxima vez sube 1–2 kg, o mantén peso y haz +2 reps.' };
  if(avgReserve >= 2) return { cls:'same', text:'Amarillo bueno: repite el mismo peso hasta que salga más fácil.' };
  return { cls:'down', text:'Demasiado justo: baja un poco y deja más margen.' };
}

function calcVolume(session){
  return session.exercises.reduce((total,ex)=> total + ex.sets.reduce((a,s)=> a + (Number(s.weight)||0)*(Number(s.reps)||0),0),0);
}
function calcSets(session){ return session.exercises.reduce((a,ex)=> a + ex.sets.filter(s=>Number(s.reps)>0).length,0); }

function render(){
  $('#todayLabel').textContent = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'short' });
  $('#startA').onclick = () => startWorkout('A');
  $('#startB').onclick = () => startWorkout('B');
  $('#finishWorkout').onclick = finishWorkout;
  $('#exportCsv').onclick = exportCsv;
  $('#exportJson').onclick = exportJson;
  $('#clearData').onclick = clearData;
  ['calcWeight','calcReps','calcReserve'].forEach(id => $('#'+id).oninput = renderCalculator);
  renderActive(); renderStats(); renderCalculator(); startTimer();
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});

function renderActive(){
  const panel = $('#workoutPanel');
  if(!state.active){
    panel.classList.add('hidden');
    $('#activeStatus').textContent = 'Sin sesión activa';
    return;
  }
  panel.classList.remove('hidden');
  $('#sessionKind').textContent = state.active.type === 'A' ? 'Torso' : 'Pierna/full body';
  $('#sessionTitle').textContent = state.active.title;
  $('#sessionMeta').textContent = `Inicio ${fmtTime(state.active.start)} · rellena durante el entreno`;
  $('#activeStatus').textContent = `${state.active.title} activa`;
  $('#exerciseList').innerHTML = state.active.exercises.map((ex,eIndex) => {
    const rec = recommendation(ex);
    return `<article class="exercise-card">
      <div class="exercise-top"><div><h3>${ex.name}</h3><div class="target">${ex.target}</div></div><button data-add-set="${eIndex}">+ serie</button></div>
      <table class="sets"><thead><tr><th>Serie</th><th>Kg</th><th>Reps</th><th>Me quedaban</th><th>Técnica</th><th></th></tr></thead><tbody>
      ${ex.sets.map((set,sIndex)=>`<tr class="set-row" data-exercise="${eIndex}" data-set="${sIndex}">
        <td>${sIndex+1}</td>
        <td><input data-field="weight" type="number" step="0.5" value="${set.weight}" placeholder="20"></td>
        <td><input data-field="reps" type="number" step="1" value="${set.reps}" placeholder="10"></td>
        <td><select data-field="reserve">
          ${[5,4,3,2,1,0].map(v=>`<option value="${v}" ${String(set.reserve)===String(v)?'selected':''}>${v}${v===5?'+':''}</option>`).join('')}
        </select></td>
        <td><select data-field="technique"><option value="si" ${set.technique==='si'?'selected':''}>Sí</option><option value="no" ${set.technique==='no'?'selected':''}>No</option></select></td>
        <td><button data-remove-set="${eIndex}:${sIndex}" class="ghost">×</button></td>
      </tr>`).join('')}
      </tbody></table>
      <div class="recommendation ${rec.cls}" data-rec="${eIndex}">${rec.text}</div>
    </article>`;
  }).join('');
  $$('#exerciseList input, #exerciseList select').forEach(el => el.oninput = updateActiveFromDOM);
  $$('[data-add-set]').forEach(btn => btn.onclick = () => addSet(Number(btn.dataset.addSet)));
  $$('[data-remove-set]').forEach(btn => btn.onclick = () => { const [e,s] = btn.dataset.removeSet.split(':').map(Number); removeSet(e,s); });
}

function renderRecommendationsOnly(){
  if(!state.active) return;
  state.active.exercises.forEach((ex,i)=>{
    const el = document.querySelector(`[data-rec="${i}"]`);
    if(el){ const rec = recommendation(ex); el.className = `recommendation ${rec.cls}`; el.textContent = rec.text; }
  });
  renderStats();
}

function renderStats(){
  const sessions = state.sessions;
  const totalVolume = sessions.reduce((a,s)=>a+calcVolume(s),0);
  const totalSets = sessions.reduce((a,s)=>a+calcSets(s),0);
  const last = sessions[0];
  $('#statsGrid').innerHTML = [
    ['Sesiones', sessions.length],
    ['Series', totalSets],
    ['Volumen kg×rep', Math.round(totalVolume)],
    ['Última', last ? `${fmtDate(last.start)} · ${formatDuration(minutesBetween(last.start,last.end))}` : '—']
  ].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#history').innerHTML = sessions.length ? sessions.slice(0,8).map(s => `<div class="history-item"><div><strong>${s.title}</strong><br><span class="muted">${fmtDate(s.start)} · ${fmtTime(s.start)} · ${formatDuration(minutesBetween(s.start,s.end))}</span></div><span class="badge">${calcSets(s)} series · ${Math.round(calcVolume(s))} vol</span></div>`).join('') : '<p class="muted">Todavía no hay sesiones guardadas.</p>';
}

function renderCalculator(){
  const w = Number($('#calcWeight').value);
  const reps = Number($('#calcReps').value || 10);
  const reserve = Number($('#calcReserve').value);
  const el = $('#calcResult');
  el.className = 'result-box';
  if(!w){ el.textContent = 'Rellena el peso y te doy una recomendación.'; return; }
  if(reserve >= 4 && reps >= 10){ el.classList.add('good'); el.textContent = `Verde: ${w} kg sirve para reinicio. Próxima vez: ${w} kg con +2 reps o ${w+1}–${w+2.5} kg.`; }
  else if(reserve >= 2){ el.classList.add('warn'); el.textContent = `Amarillo: mantén ${w} kg hasta que te queden 4 reps limpias.`; }
  else { el.classList.add('bad'); el.textContent = `Rojo: baja a ${Math.max(0, Math.round((w*0.9)*2)/2)} kg aprox. Queremos margen.`; }
}

function startTimer(){
  if(timerInterval) clearInterval(timerInterval);
  const tick = () => { $('#timer').textContent = state.active ? formatDuration(minutesBetween(state.active.start)) : '00:00'; };
  tick(); timerInterval = setInterval(tick, 30000);
}

function exportJson(){ download('entrenos-roberto.json', JSON.stringify(state.sessions, null, 2), 'application/json'); }
function exportCsv(){
  const rows = [['fecha','sesion','inicio','duracion_min','ejercicio','serie','peso','reps','reps_en_recámara','tecnica']];
  state.sessions.forEach(s => s.exercises.forEach(ex => ex.sets.forEach((set,i) => rows.push([fmtDate(s.start),s.title,fmtTime(s.start),minutesBetween(s.start,s.end),ex.name,i+1,set.weight,set.reps,set.reserve,set.technique]))));
  download('entrenos-roberto.csv', rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'), 'text/csv');
}
function download(name, content, type){
  const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function clearData(){ if(confirm('¿Borrar historial y sesión activa?')){ state={sessions:[],active:null}; saveState(); render(); } }

render();
