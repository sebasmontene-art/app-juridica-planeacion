const basePages = [
  { id: "resumen", title: "Resumen" },
  { id: "horizonte", title: "Horizonte 12 meses" },
  { id: "costos", title: "Costos" },
  { id: "decisiones", title: "Decisiones" },
  { id: "riesgos", title: "Riesgos" },
  { id: "modulos", title: "Modulos" }
];

let data = {};
let active = "resumen";
let filterText = "";
let autoSave = localStorage.getItem("planningAutoSave") === "true";
let saveTimer = null;
let highlightTaskId = "";
let newTaskId = "";
let lastSearchText = "";
const baseWeekCount = 6;
let editingObjective = null;
let editingSummary = null;
let weeksOpen = localStorage.getItem("planningWeeksOpen") !== "false";

const $ = (selector) => document.querySelector(selector);
const content = $("#content");
const saveState = $("#saveState");
const glossary = {
  MVP: "Producto Minimo Viable: primera version simple para validar el modulo antes de construir todo.",
  IA: "Inteligencia Artificial.",
  API: "Interfaz de programacion para conectar sistemas.",
  PDF: "Formato de documento portatil.",
  DOCX: "Formato editable de Microsoft Word."
};
const searchAliases = {
  sebastian: ["sebastian", "sebastián"],
  cesar: ["cesar", "césar", "socio"],
  socio: ["socio", "cesar", "césar"]
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function explain(value = "") {
  let text = escapeHtml(value);
  for (const [term, description] of Object.entries(glossary)) {
    text = text.replace(new RegExp(`\\b${term}\\b`, "g"), `<abbr title="${escapeHtml(description)}">${term}</abbr>`);
  }
  return text;
}

function plain(value = "") {
  return String(value).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function expandSearch(value = "") {
  const normalized = normalizeSearch(value);
  const additions = [];
  for (const [key, aliases] of Object.entries(searchAliases)) {
    if (normalized.includes(key) || aliases.some((alias) => normalized.includes(normalizeSearch(alias)))) {
      additions.push(...aliases);
    }
  }
  return normalizeSearch(`${value} ${additions.join(" ")}`);
}

function matchesSearch(item, query) {
  const haystack = normalizeSearch(`${item.section} ${item.title} ${item.detail}`);
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => {
    const aliases = searchAliases[token] || [token];
    return aliases.some((alias) => haystack.includes(normalizeSearch(alias)));
  });
}

function dirty() {
  saveState.textContent = "Cambios pendientes de guardar";
  if (autoSave) {
    saveState.textContent = "Cambios pendientes. Autoguardando...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveData("Autoguardado"), 1200);
  }
}

function field(label, value, attrs, type = "textarea") {
  const input = type === "input"
    ? `<input ${attrs} value="${escapeHtml(value)}">`
    : `<textarea ${attrs}>${escapeHtml(value)}</textarea>`;
  return `<label class="field"><span>${explain(label)}</span>${input}</label>`;
}

function listField(label, items, attrs) {
  return field(label, (items || []).join("\n"), attrs, "textarea");
}

function getPhases() {
  const weeks = (data.roadmap?.fases_6_semanas || [])
    .slice()
    .sort((a, b) => Number(a.semana) - Number(b.semana))
    .map((item) => ({ id: `semana-${item.semana}`, title: `Semana ${item.semana}`, week: Number(item.semana) }));
  const custom = (data.roadmap?.paginas || []).map((item) => ({ id: item.id, title: item.titulo, custom: true }));
  return [basePages[0], ...weeks, ...basePages.slice(1), ...custom];
}

function renderNav() {
  const phases = getPhases();
  const summary = phases.find((phase) => phase.id === "resumen");
  const weeks = phases.filter((phase) => phase.week);
  const rest = phases.filter((phase) => phase.id !== "resumen" && !phase.week);
  const renderItem = (phase) => {
    const count = phase.week ? data.roadmap.tareas.filter((task) => Number(task.semana_sugerida) === phase.week).length : "";
    const meta = phase.week ? data.roadmap.fases_6_semanas?.find((item) => Number(item.semana) === phase.week) : null;
    const title = meta ? `Semana ${phase.week}` : phase.title;
    const removable = (phase.week && phase.week > baseWeekCount) || phase.custom;
    return `<div class="nav-item ${active === phase.id ? "active-wrap" : ""}">
      <a href="#" class="${active === phase.id ? "active" : ""}" data-nav="${phase.id}">
        <span>${title}</span>${count ? `<small>${count}</small>` : ""}
      </a>
      ${removable ? `<button class="nav-delete" type="button" data-delete-nav="${phase.id}" title="Eliminar">×</button>` : ""}
    </div>`;
  };
  const links = `${renderItem(summary)}
    <div class="nav-group">
      <button class="nav-group-toggle" type="button" data-toggle-weeks>
        <span>${weeksOpen ? "▾" : "▸"} Tareas semanales</span><small>${weeks.length}</small>
      </button>
      <div class="nav-group-items ${weeksOpen ? "" : "collapsed"}">
        ${weeks.map(renderItem).join("")}
        <button class="nav-inline-add" type="button" data-add-week>+ Semana</button>
      </div>
    </div>
    ${rest.map(renderItem).join("")}`;
  const back = lastSearchText
    ? `<button class="nav-back-search" type="button" data-back-search><span>Volver a resultados</span><strong>${escapeHtml(lastSearchText)}</strong></button>`
    : "";
  const addControls = `<div class="nav-add">
    <button type="button" data-add-page>+ Pagina</button>
  </div>`;
  $("#nav").innerHTML = links + addControls + back;
}

function autoSizeTextareas(scope = document) {
  scope.querySelectorAll("textarea").forEach((textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  });
}

function finalizeRender() {
  autoSizeTextareas(content);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function progressForWeek(week) {
  const tasks = data.roadmap.tareas.filter((task) => Number(task.semana_sugerida) === week);
  const done = tasks.filter((task) => task.estado === "Cerrado").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return { tasks, done, percent };
}

function generalProgress() {
  const tasks = data.roadmap.tareas || [];
  const done = tasks.filter((task) => task.estado === "Cerrado").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const hue = Math.round((percent / 100) * 120);
  return { done, total: tasks.length, percent, color: `hsl(${hue} 58% 38%)` };
}

function ensureCostFields() {
  (data.costos?.costos || []).forEach((item) => {
    if (typeof item.decision_confirmada !== "boolean") item.decision_confirmada = item.estado_decision === "Decision tomada";
    if (!item.estado_decision) item.estado_decision = "Por investigar";
    if (!item.costo_mensual_estimado) item.costo_mensual_estimado = "";
    if (!item.proveedor_elegido) item.proveedor_elegido = "";
  });
}

function parseCost(value = "") {
  const cleaned = String(value).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function costDecisionTaken(item) {
  return item.decision_confirmada === true || item.estado_decision === "Decision tomada";
}

function costLabel(item) {
  return item.proveedor_elegido || item.proveedor || item.categoria || "Sin proveedor";
}

function costSummary() {
  const costs = data.costos?.costos || [];
  const decided = costs.filter(costDecisionTaken);
  const pending = costs.filter((item) => !costDecisionTaken(item));
  const total = decided.reduce((sum, item) => sum + parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo), 0);
  return { costs, decided, pending, total };
}

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "COP"
  }).format(value || 0);
}

function pieStyle(items) {
  const total = items.reduce((sum, item) => sum + parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo), 0);
  if (!total) return "background:#e5ecef";
  const colors = ["#246b61", "#7a5b2e", "#3d6f91", "#a63d40", "#5d6b7a", "#8a6f9e", "#47736b", "#b07d3c"];
  let cursor = 0;
  const stops = items.map((item, index) => {
    const value = parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo);
    const start = cursor;
    cursor += (value / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  return `background:conic-gradient(${stops.join(",")})`;
}

function costVisual(summary, compact = false) {
  const totalRows = summary.costs.length || 1;
  const definedPercent = Math.round((summary.decided.length / totalRows) * 100);
  const max = Math.max(...summary.decided.map((item) => parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo)), 1);
  const colors = ["#1f8f5f", "#2374d8", "#7a55d6", "#f08a16", "#13a88b", "#a63d40", "#5d6b7a"];
  const rows = summary.decided.map((item, index) => {
    const value = parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo);
    const percent = Math.round((value / max) * 100);
    const share = summary.total ? Math.round((value / summary.total) * 100) : 0;
    const color = colors[index % colors.length];
    return `<li>
      <div class="cost-line-head">
        <span><i style="background:${color}"></i>${explain(item.categoria)}</span>
        <strong>${share}%</strong>
      </div>
      <div class="cost-line-bar"><span style="width:${percent}%; background:${color}"></span></div>
      <small>${explain(costLabel(item))} - ${money(value)}</small>
    </li>`;
  }).join("");

  return `<div class="money-visual ${compact ? "compact" : ""}">
    <div class="money-left">
      <div class="money-badge">$</div>
      <div class="money-title">
        <h3>Costos operativos</h3>
        <p>Visualizacion dinamica de costos decididos</p>
      </div>
      <div class="bill-wrap">
        <div class="total-bubble">
          <span>Total definido</span>
          <strong>${money(summary.total)}</strong>
        </div>
        <div class="money-bill" style="--fill:${definedPercent}%">
          <div class="bill-fill"></div>
          <div class="bill-face">$</div>
          <div class="bill-lines"></div>
        </div>
      </div>
      <div class="budget-meter">
        <strong>${definedPercent}%</strong>
        <span>de rubros con decision tomada</span>
      </div>
      <div class="meter-track"><span style="width:${definedPercent}%"></span></div>
    </div>
    <ul class="cost-bars">${rows || "<li class=\"empty-cost\">Marca costos como decididos para ver la distribucion.</li>"}</ul>
  </div>`;
}

function reportTable(headers, rows) {
  return `<div class="table-wrap report-table"><table>
    <thead><tr>${headers.map((header) => `<th>${explain(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table></div>`;
}

function objectiveView(kind, id, text) {
  const editing = editingObjective?.kind === kind && String(editingObjective.id) === String(id);
  return `<div class="objective-card">
    <div class="objective-head">
      <span>${kind === "week" ? "Objetivo de la semana" : "Objetivo de la pagina"}</span>
      ${editing ? "" : `<button class="icon-button" type="button" data-edit-objective-kind="${kind}" data-edit-objective-id="${escapeHtml(id)}" title="Editar objetivo">✎</button>`}
    </div>
    ${editing
      ? `<textarea data-objective-draft>${escapeHtml(text || "")}</textarea>
        <div class="objective-actions">
          <button type="button" data-save-objective>Guardar</button>
          <button class="secondary" type="button" data-cancel-objective>Cancelar</button>
        </div>`
      : `<p>${explain(text || "Sin objetivo definido.")}</p>`}
  </div>`;
}

function editableSummaryCard(title, text, group, key, wide = false) {
  const id = `${group}.${key}`;
  const editing = editingSummary === id;
  return `<article class="report-card ${wide ? "wide" : ""}">
    <div class="objective-head">
      <h3>${explain(title)}</h3>
      ${editing ? "" : `<button class="icon-button" type="button" data-edit-summary="${id}" title="Editar">✎</button>`}
    </div>
    ${editing
      ? `<textarea data-summary-draft>${escapeHtml(text || "")}</textarea>
        <div class="objective-actions">
          <button type="button" data-save-summary="${id}">Guardar</button>
          <button class="secondary" type="button" data-cancel-summary>Cancelar</button>
        </div>`
      : `<p>${explain(text || "Sin texto definido.")}</p>`}
  </article>`;
}

function flattenSearchResults() {
  const results = [];
  const add = (section, target, title, detail, taskId = "") => {
    results.push({ section, target, title: String(title || ""), detail: String(detail || ""), taskId });
  };

  const p = data.plan_general.resumen_ejecutivo;
  add("Resumen", "resumen", "Objetivo general", p.objetivo_general);
  add("Resumen", "resumen", "Problema que resuelve", p.problema_resuelve);
  add("Resumen", "resumen", "Propuesta de valor", p.propuesta_valor);

  data.roadmap.tareas.forEach((task) => {
    if (task.pagina_id) {
      const page = (data.roadmap.paginas || []).find((item) => item.id === task.pagina_id);
      add(page?.titulo || "Pagina", task.pagina_id, task.titulo, `${task.descripcion} ${task.responsable} ${task.apoyo} ${task.estado} ${task.criterio_aprobacion} ${task.observaciones}`, task.id);
    } else {
      add(`Semana ${task.semana_sugerida}`, `semana-${task.semana_sugerida}`, task.titulo, `${task.descripcion} ${task.responsable} ${task.apoyo} ${task.estado} ${task.criterio_aprobacion} ${task.observaciones}`, task.id);
    }
  });
  (data.roadmap.horizonte_12_meses || []).forEach((item) => {
    add("Horizonte 12 meses", "horizonte", item.periodo, `${item.enfoque} ${item.objetivo} ${item.entregables} ${item.condicion}`);
  });
  (data.costos.costos || []).forEach((item) => {
    add("Costos", "costos", item.categoria, `${item.proveedor} ${item.riesgo} ${item.responsable_investigar} ${item.decision}`);
  });
  (data.decisiones.decisiones || []).forEach((item) => {
    add("Decisiones", "decisiones", item.decision, `${item.fecha} ${item.responsable} ${item.fundamento} ${item.estado}`);
  });
  (data.riesgos.riesgos || []).forEach((item) => {
    add("Riesgos", "riesgos", item.riesgo, `${item.nivel} ${item.impacto} ${item.mitigacion} ${item.estado}`);
  });
  (data.modulos.modulos || []).forEach((item) => {
    add("Modulos", "modulos", item.nombre, `${item.tipo} ${item.prioridad} ${item.estado} ${item.observaciones}`);
  });
  return results;
}

function renderSearchResults() {
  const scope = active;
  const results = flattenSearchResults().filter((item) => matchesSearch(item, filterText));
  const scoped = scope === "resumen" ? results : results.filter((item) => item.target === scope);
  const label = scope === "resumen" ? "todo el plan" : getPhases().find((phase) => phase.id === scope)?.title || "esta pagina";
  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div>
        <h2>Busqueda en el plan</h2>
        <p>${scoped.length} resultado(s) para "${escapeHtml(filterText)}" en ${escapeHtml(label)}.</p>
      </div>
    </div>
    <div class="search-results">
      ${scoped.map((item) => `<button class="search-result" type="button" data-go="${item.target}">
        ${item.taskId ? `<input type="hidden" data-task-target value="${escapeHtml(item.taskId)}">` : ""}
        <strong>${explain(item.section)}</strong>
        <span>${explain(item.title)}</span>
        <small>${explain(plain(item.detail).slice(0, 220))}${plain(item.detail).length > 220 ? "..." : ""}</small>
      </button>`).join("") || "<p>No encontre coincidencias. Prueba con otra palabra.</p>"}
    </div>
  </section>`;
}

function renderSummary() {
  const p = data.plan_general.resumen_ejecutivo;
  const a = data.plan_general.alcance_mvp;
  const overall = generalProgress();
  const buildWeekRows = (weeks) => weeks.map((week) => {
    const meta = data.roadmap.fases_6_semanas?.find((item) => Number(item.semana) === week);
    const progress = progressForWeek(week);
    return `<tr>
      <td><strong>Semana ${week}</strong><br>${explain(meta?.titulo || "")}</td>
      <td>${explain(meta?.objetivo || "")}</td>
      <td>${progress.done}/${progress.tasks.length}</td>
      <td><div class="progress"><span style="width:${progress.percent}%"></span></div><small>${progress.percent}% hecho</small></td>
    </tr>`;
  });
  const weekNumbers = (data.roadmap.fases_6_semanas || []).map((phase) => Number(phase.semana)).sort((a, b) => a - b);
  const baseWeekRows = buildWeekRows(weekNumbers.filter((week) => week <= baseWeekCount));
  const extraWeekRows = buildWeekRows(weekNumbers.filter((week) => week > baseWeekCount));
  const horizonRows = (data.roadmap.horizonte_12_meses || []).map((item) => `<tr>
    <td>${explain(item.periodo)}</td>
    <td>${explain(item.enfoque)}</td>
    <td>${explain(item.objetivo)}</td>
    <td>${explain(item.condicion)}</td>
  </tr>`);
  const moduleRows = (data.modulos.modulos || []).map((item) => `<tr>
    <td>${explain(item.nombre)}</td>
    <td>${explain(item.tipo)}</td>
    <td>${explain(item.prioridad)}</td>
    <td>${explain(item.estado)}</td>
  </tr>`);
  const costs = costSummary();
  const pendingCriticalCosts = costs.pending.filter((item) => /critico|whatsapp|pagos|ia|hosting|base de datos|almacenamiento|escalamiento/i.test(`${item.decision} ${item.categoria}`));
  const costRows = pendingCriticalCosts.map((item) => `<tr>
    <td>${explain(item.categoria)}</td>
    <td>${explain(item.responsable_investigar)}</td>
    <td>${explain(item.fecha_limite)}</td>
    <td>${explain(item.decision)}</td>
  </tr>`);
  const decidedCostRows = costs.decided.map((item) => `<tr>
    <td>${explain(item.categoria)}</td>
    <td>${explain(costLabel(item))}</td>
    <td>${money(parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo))}</td>
    <td>${explain(item.decision)}</td>
  </tr>`);
  const decisionRows = (data.decisiones.decisiones || []).map((item) => `<tr>
    <td>${explain(item.fecha)}</td>
    <td>${explain(item.decision)}</td>
    <td>${explain(item.estado)}</td>
  </tr>`);
  const taskDetailBlocks = weekNumbers.map((week) => {
    const meta = data.roadmap.fases_6_semanas?.find((item) => Number(item.semana) === week);
    const progress = progressForWeek(week);
    const rows = progress.tasks.map((task) => `<tr>
      <td class="task-check">${task.estado === "Cerrado" ? "✓" : ""}</td>
      <td><strong>${explain(task.titulo)}</strong><br><small>${explain(task.descripcion || "")}</small></td>
      <td>${explain(task.responsable || "")}</td>
      <td>${explain(task.estado || "")}</td>
    </tr>`).join("");
    return `<article class="report-card wide task-week-block">
      <div class="progress-head">
        <div>
          <h3>Semana ${week}: ${explain(meta?.titulo || "")}</h3>
          <p>${progress.done} de ${progress.tasks.length} tareas cerradas.</p>
        </div>
        <strong>${progress.percent}%</strong>
      </div>
      <div class="progress"><span style="width:${progress.percent}%"></span></div>
      ${reportTable(["", "Tarea y descripcion", "Responsable", "Estado"], [rows])}
    </article>`;
  }).join("");

  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div>
        <h2>Resumen vivo del plan</h2>
        <p>Este informe se arma con lo que muevan en semanas, horizonte, modulos, costos y decisiones. Es la vista para conversar y luego exportar.</p>
      </div>
    </div>
    <article class="report-card wide progress-card">
      <div class="progress-head">
        <div>
          <h3>Progreso general de tareas</h3>
          <p>${overall.done} de ${overall.total} tareas cerradas.</p>
        </div>
        <strong style="color:${overall.color}">${overall.percent}%</strong>
      </div>
      <div class="progress general"><span style="width:${overall.percent}%; background:${overall.color}"></span></div>
      <small>Rojo indica avance bajo; verde indica avance alto.</small>
    </article>
    <div class="report-grid">
      ${editableSummaryCard(p.nombre_proyecto, p.objetivo_general, "resumen_ejecutivo", "objetivo_general", true)}
      ${editableSummaryCard("Problema", p.problema_resuelve, "resumen_ejecutivo", "problema_resuelve")}
      ${editableSummaryCard("Publico objetivo", p.publico_objetivo, "resumen_ejecutivo", "publico_objetivo")}
      ${editableSummaryCard("Propuesta de valor", p.propuesta_valor, "resumen_ejecutivo", "propuesta_valor")}
      <article class="report-card">
        <h3>Entra en el MVP</h3>
        <ul>${(a.entra || []).map((item) => `<li>${explain(item)}</li>`).join("")}</ul>
      </article>
      <article class="report-card">
        <h3>No entra en el MVP</h3>
        <ul>${(a.no_entra || []).map((item) => `<li>${explain(item)}</li>`).join("")}</ul>
      </article>
    </div>
    <article class="report-card wide">
      <h3>Avance de las primeras 6 semanas</h3>
      ${reportTable(["Semana", "Objetivo", "Hechas", "Avance"], baseWeekRows)}
    </article>
    ${extraWeekRows.length ? `<article class="report-card wide">
      <h3>Semanas adicionales</h3>
      ${reportTable(["Semana", "Objetivo", "Hechas", "Avance"], extraWeekRows)}
    </article>` : ""}
    <article class="report-card wide">
      <h3>Horizonte estrategico de 12 meses</h3>
      ${reportTable(["Periodo", "Enfoque", "Objetivo", "Condicion"], horizonRows)}
    </article>
    <article class="report-card wide">
      <h3>Modulos juridicos</h3>
      ${reportTable(["Modulo", "Tipo", "Prioridad", "Estado"], moduleRows)}
    </article>
    <article class="report-card wide">
      <h3>Costos criticos por investigar</h3>
      ${reportTable(["Categoria", "Responsable", "Fecha limite", "Decision"], costRows)}
    </article>
    <article class="report-card wide">
      <h3>Decisiones de costos tomadas</h3>
      ${costVisual(costs, true)}
      ${decidedCostRows.length ? reportTable(["Categoria", "Proveedor", "Costo mensual", "Decision"], decidedCostRows) : "<p>Aun no hay decisiones de costo tomadas.</p>"}
    </article>
    <article class="report-card wide">
      <h3>Decisiones registradas</h3>
      ${reportTable(["Fecha", "Decision", "Estado"], decisionRows)}
    </article>
    <article class="report-card wide">
      <h3>Tareas por semana</h3>
      <p>Detalle operativo para revisar responsables, estado y avance antes de exportar.</p>
    </article>
    ${taskDetailBlocks}
  </section>`;
  finalizeRender();
}

function taskRow(task) {
  const done = task.estado === "Cerrado";
  return `<tr data-task="${task.id}">
    <td class="check-cell"><input type="checkbox" data-task-key="done" ${done ? "checked" : ""}></td>
    <td>${field("Nombre", task.titulo, 'data-task-key="titulo"', "input")}</td>
    <td>${field("Descripcion", task.descripcion, 'data-task-key="descripcion"')}</td>
    <td>${field("Responsable", task.responsable, 'data-task-key="responsable"', "input")}</td>
    <td>${field("Tiempo", task.tiempo_estimado, 'data-task-key="tiempo_estimado"', "input")}</td>
    <td>
      <select data-task-key="estado">
        ${["Pendiente", "En analisis", "Aprobado", "En implementacion", "Bloqueado", "Cerrado"].map((state) => `<option ${task.estado === state ? "selected" : ""}>${state}</option>`).join("")}
      </select>
    </td>
    <td>${field("Notas", task.observaciones || task.criterio_aprobacion || "", 'data-task-key="observaciones"')}</td>
    <td class="row-actions">
      <button class="secondary" data-duplicate-task="${task.id}" type="button">Duplicar</button>
      <button class="danger" data-delete-task="${task.id}" type="button">Eliminar</button>
    </td>
  </tr>`;
}

function insertTaskButton(week, index) {
  return `<tr class="insert-row">
    <td colspan="8"><button class="insert-task" type="button" data-insert-task-week="${week}" data-insert-task-index="${index}">+ Agregar tarea aqui</button></td>
  </tr>`;
}

function insertPageTaskButton(pageId, index) {
  return `<tr class="insert-row">
    <td colspan="8"><button class="insert-task" type="button" data-insert-task-page="${escapeHtml(pageId)}" data-insert-task-index="${index}">+ Agregar tarea aqui</button></td>
  </tr>`;
}

function renderWeek(week) {
  const allTasks = data.roadmap.tareas.filter((task) => Number(task.semana_sugerida) === week);
  const tasks = allTasks.filter((task) => JSON.stringify(task).toLowerCase().includes(filterText.toLowerCase()));
  const done = allTasks.filter((task) => task.estado === "Cerrado").length;
  const percent = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;
  const hue = Math.round((percent / 100) * 120);
  const color = `hsl(${hue} 58% 38%)`;
  const meta = data.roadmap.fases_6_semanas?.find((item) => Number(item.semana) === week);
  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div>
        <h2>Semana ${week}: ${explain(meta?.titulo || "")}</h2>
        <p>${done} de ${allTasks.length} tareas marcadas como hechas.</p>
      </div>
    </div>
    ${objectiveView("week", week, meta?.objetivo || "")}
    <article class="report-card wide progress-card">
      <div class="progress-head">
        <div>
          <h3>Progreso de la semana</h3>
          <p>${done} de ${allTasks.length} tareas cerradas.</p>
        </div>
        <strong style="color:${color}">${percent}%</strong>
      </div>
      <div class="progress general"><span style="width:${percent}%; background:${color}"></span></div>
    </article>
    <div class="table-wrap simple-table">
      <table>
        <thead>
          <tr>
            <th>Hecho</th>
            <th>Nombre</th>
            <th>Descripcion</th>
            <th>Responsable</th>
            <th>Tiempo</th>
            <th>Estado</th>
            <th>Notas / aprobacion</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${insertTaskButton(week, 0)}${tasks.map((task, index) => `${taskRow(task)}${insertTaskButton(week, index + 1)}`).join("")}</tbody>
      </table>
    </div>
  </section>`;
  finalizeRender();
  if (highlightTaskId) {
    const row = content.querySelector(`[data-task="${CSS.escape(highlightTaskId)}"]`);
    if (row) {
      row.classList.add("highlight-row");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => row.classList.remove("highlight-row"), 2800);
    }
    highlightTaskId = "";
  }
  if (newTaskId) {
    const row = content.querySelector(`[data-task="${CSS.escape(newTaskId)}"]`);
    if (row) {
      row.classList.add("new-task-row");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => row.classList.remove("new-task-row"), 1600);
    }
    newTaskId = "";
  }
}

function renderHorizon() {
  simpleRows(
    "roadmap.horizonte_12_meses",
    ["periodo", "enfoque", "objetivo", "entregables", "condicion"],
    "Horizonte 12 meses",
    "Este horizonte evita confundir el MVP de 6 semanas con la construccion completa de la plataforma."
  );
}

function costRow(item, index) {
  return `<tr data-cost-row="${index}">
    <td class="check-cell"><input type="checkbox" data-cost-key="decision_confirmada" ${costDecisionTaken(item) ? "checked" : ""}></td>
    <td>${field("Categoria", item.categoria || "", `data-cost-key="categoria"`)}</td>
    <td>${field("Proveedor candidato", item.proveedor || "", `data-cost-key="proveedor"`)}</td>
    <td>${field("Proveedor elegido", item.proveedor_elegido || "", `data-cost-key="proveedor_elegido"`)}</td>
    <td>${field("Costo mensual estimado", item.costo_mensual_estimado || "", `data-cost-key="costo_mensual_estimado"`, "input")}</td>
    <td>${field("Costo por uso", item.costo_por_uso || "", `data-cost-key="costo_por_uso"`)}</td>
    <td>
      <label class="field"><span>Estado decision</span>
        <select data-cost-key="estado_decision">
          ${["Por investigar", "En analisis", "Decision tomada", "Descartado"].map((state) => `<option ${item.estado_decision === state ? "selected" : ""}>${state}</option>`).join("")}
        </select>
      </label>
    </td>
    <td>${field("Decision / fundamento", item.decision || "", `data-cost-key="decision"`)}</td>
    <td>${field("Riesgo", item.riesgo || "", `data-cost-key="riesgo"`)}</td>
    <td class="row-actions"><button class="secondary" data-duplicate-cost="${index}" type="button">Duplicar</button><button class="danger" data-delete-cost="${index}" type="button">Eliminar</button></td>
  </tr>`;
}

function insertCostButton(index) {
  return `<tr class="insert-row">
    <td colspan="10"><button class="insert-task" type="button" data-insert-cost-index="${index}">+ Agregar costo aqui</button></td>
  </tr>`;
}

function renderCosts() {
  ensureCostFields();
  const summary = costSummary();
  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div>
        <h2>Costos y decisiones</h2>
        <p>Usen esta pagina para comparar proveedores, estimar costo mensual y marcar cuando una decision ya fue tomada.</p>
      </div>
    </div>
    <div class="cost-dashboard">
      <article class="report-card">
        <h3>Total mensual decidido</h3>
        <strong>${money(summary.total)}</strong>
        <p>${summary.decided.length} decision(es) tomadas.</p>
      </article>
      <article class="report-card">
        <h3>Pendientes</h3>
        <strong>${summary.pending.length}</strong>
        <p>Costos por investigar o analizar.</p>
      </article>
      <article class="report-card wide">
        ${costVisual(summary)}
      </article>
    </div>
    <div class="table-wrap simple-table"><table>
      <thead><tr><th>Decidido</th><th>Categoria</th><th>Proveedor candidato</th><th>Proveedor elegido</th><th>Costo mensual estimado</th><th>Costo por uso</th><th>Estado</th><th>Decision</th><th>Riesgo</th><th></th></tr></thead>
      <tbody>${insertCostButton(0)}${summary.costs.map((item, index) => `${costRow(item, index)}${insertCostButton(index + 1)}`).join("")}</tbody>
    </table></div>
  </section>`;
  finalizeRender();
}

function renderCustomPage(page) {
  const allTasks = data.roadmap.tareas.filter((task) => task.pagina_id === page.id);
  const tasks = allTasks.filter((task) => JSON.stringify(task).toLowerCase().includes(filterText.toLowerCase()));
  const done = allTasks.filter((task) => task.estado === "Cerrado").length;
  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div>
        <h2>${explain(page.titulo)}</h2>
        <p>${done} de ${allTasks.length} tareas marcadas como hechas.</p>
      </div>
    </div>
    ${objectiveView("page", page.id, page.descripcion || "")}
    <div class="table-wrap simple-table">
      <table>
        <thead>
          <tr>
            <th>Hecho</th>
            <th>Nombre</th>
            <th>Descripcion</th>
            <th>Responsable</th>
            <th>Tiempo</th>
            <th>Estado</th>
            <th>Notas / aprobacion</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${insertPageTaskButton(page.id, 0)}${tasks.map((task, index) => `${taskRow(task)}${insertPageTaskButton(page.id, index + 1)}`).join("")}</tbody>
      </table>
    </div>
  </section>`;
  finalizeRender();
  if (newTaskId) {
    const row = content.querySelector(`[data-task="${CSS.escape(newTaskId)}"]`);
    if (row) {
      row.classList.add("new-task-row");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => row.classList.remove("new-task-row"), 1600);
    }
    newTaskId = "";
  }
}

function insertRowButton(path, index, colspan) {
  return `<tr class="insert-row">
    <td colspan="${colspan}"><button class="insert-task" type="button" data-insert-row-path="${escapeHtml(path)}" data-insert-row-index="${index}">+ Agregar fila aqui</button></td>
  </tr>`;
}

function simpleRows(path, keys, title, intro) {
  const rows = path.split(".").reduce((acc, key) => acc[key], data);
  content.innerHTML = `<section class="work-page">
    <div class="page-title">
      <div><h2>${explain(title)}</h2><p>${explain(intro)}</p></div>
    </div>
    <div class="table-wrap simple-table"><table>
      <thead><tr>${keys.map((key) => `<th>${key.replaceAll("_", " ")}</th>`).join("")}<th></th></tr></thead>
      <tbody>${insertRowButton(path, 0, keys.length + 1)}${rows.map((row, index) => `<tr data-row="${index}" data-path="${path}">
        ${keys.map((key) => `<td>${field(key, row[key] || "", `data-row-key="${key}"`)}</td>`).join("")}
        <td class="row-actions"><button class="secondary" data-duplicate-row="${path}" data-index="${index}" type="button">Duplicar</button><button class="danger" data-delete-row="${path}" data-index="${index}" type="button">Eliminar</button></td>
      </tr>${insertRowButton(path, index + 1, keys.length + 1)}`).join("")}</tbody>
    </table></div>
  </section>`;
  finalizeRender();
}

function render() {
  renderNav();
  if (filterText.trim()) return renderSearchResults();
  const phase = getPhases().find((item) => item.id === active);
  if (active === "resumen") return renderSummary();
  if (phase?.week) return renderWeek(phase.week);
  if (active === "horizonte") return renderHorizon();
  if (active === "costos") return renderCosts();
  if (active === "decisiones") return simpleRows("decisiones.decisiones", ["fecha", "decision", "responsable", "fundamento", "impacto", "estado", "pendiente_asociado"], "Decisiones", "Registro para dejar claro que se aprobo, por que y que queda pendiente.");
  if (active === "riesgos") return simpleRows("riesgos.riesgos", ["riesgo", "nivel", "impacto", "mitigacion", "responsable", "estado"], "Riesgos", "Matriz simple para revisar antes de construir.");
  if (active === "modulos") return simpleRows("modulos.modulos", ["nombre", "tipo", "prioridad", "complejidad_juridica", "complejidad_tecnica", "nivel_riesgo", "estado", "observaciones"], "Modulos juridicos", "Lista editable de verticales juridicas futuras.");
  const customPage = (data.roadmap.paginas || []).find((item) => item.id === active);
  if (customPage) return renderCustomPage(customPage);
}

function getTask(id) {
  return data.roadmap.tareas.find((task) => task.id === id);
}

function getRows(path) {
  return path.split(".").reduce((acc, key) => acc[key], data);
}

content.addEventListener("input", (event) => {
  const target = event.target;
  if (target.tagName === "TEXTAREA") autoSizeTextareas(target.parentElement || content);
  if (target.dataset.plan) {
    const [group, key] = target.dataset.plan.split(".");
    data.plan_general[group][key] = target.value;
    dirty();
  }
  if (target.dataset.list) {
    const [group, key] = target.dataset.list.split(".");
    data.plan_general[group][key] = target.value.split("\n").map((item) => item.trim()).filter(Boolean);
    dirty();
  }
  if (target.dataset.taskKey && target.dataset.taskKey !== "done") {
    const task = getTask(target.closest("[data-task]").dataset.task);
    task[target.dataset.taskKey] = target.value;
    dirty();
  }
  if (target.dataset.rowKey) {
    const tr = target.closest("[data-row]");
    getRows(tr.dataset.path)[Number(tr.dataset.row)][target.dataset.rowKey] = target.value;
    dirty();
  }
  if (target.dataset.costKey) {
    const row = target.closest("[data-cost-row]");
    const item = data.costos.costos[Number(row.dataset.costRow)];
    item[target.dataset.costKey] = target.type === "checkbox" ? target.checked : target.value;
    if (target.dataset.costKey === "decision_confirmada") {
      item.estado_decision = target.checked ? "Decision tomada" : "Por investigar";
    }
    dirty();
  }
});

content.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.costKey) {
    const row = target.closest("[data-cost-row]");
    const item = data.costos.costos[Number(row.dataset.costRow)];
    item[target.dataset.costKey] = target.type === "checkbox" ? target.checked : target.value;
    if (target.dataset.costKey === "estado_decision") {
      item.decision_confirmada = target.value === "Decision tomada";
    }
    if (target.dataset.costKey === "decision_confirmada") {
      item.estado_decision = target.checked ? "Decision tomada" : "Por investigar";
    }
    dirty();
    render();
    return;
  }
  if (!target.dataset.taskKey) return;
  const task = getTask(target.closest("[data-task]").dataset.task);
  if (target.dataset.taskKey === "done") {
    task.estado = target.checked ? "Cerrado" : "Pendiente";
  } else {
    task[target.dataset.taskKey] = target.value;
  }
  dirty();
  render();
});

content.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.backSearch !== undefined) {
    filterText = lastSearchText;
    $("#search").value = lastSearchText;
    render();
    scrollToTop();
    return;
  }
  if (button.dataset.go) {
    const taskTarget = button.querySelector("[data-task-target]");
    highlightTaskId = taskTarget?.value || "";
    lastSearchText = filterText;
    filterText = "";
    $("#search").value = "";
    active = button.dataset.go;
    render();
    scrollToTop();
    return;
  }
  if (button.dataset.editObjectiveKind) {
    editingObjective = {
      kind: button.dataset.editObjectiveKind,
      id: button.dataset.editObjectiveId
    };
    render();
    scrollToTop();
    return;
  }
  if (button.dataset.cancelObjective !== undefined) {
    editingObjective = null;
    render();
    scrollToTop();
    return;
  }
  if (button.dataset.saveObjective !== undefined) {
    const value = content.querySelector("[data-objective-draft]")?.value || "";
    if (editingObjective?.kind === "week") {
      const meta = data.roadmap.fases_6_semanas.find((item) => Number(item.semana) === Number(editingObjective.id));
      if (meta) meta.objetivo = value;
    }
    if (editingObjective?.kind === "page") {
      const page = (data.roadmap.paginas || []).find((item) => item.id === editingObjective.id);
      if (page) page.descripcion = value;
    }
    editingObjective = null;
    dirty();
    render();
    scrollToTop();
    return;
  }
  if (button.dataset.editSummary) {
    editingSummary = button.dataset.editSummary;
    render();
    return;
  }
  if (button.dataset.cancelSummary !== undefined) {
    editingSummary = null;
    render();
    return;
  }
  if (button.dataset.saveSummary) {
    const [group, key] = button.dataset.saveSummary.split(".");
    data.plan_general[group][key] = content.querySelector("[data-summary-draft]")?.value || "";
    editingSummary = null;
    dirty();
    render();
    return;
  }
  if (button.dataset.addTask) {
    const id = `task_${Date.now()}`;
    data.roadmap.tareas.push({
      id,
      titulo: "Nueva tarea",
      descripcion: "",
      responsable: "Sebastian",
      apoyo: "",
      semana_sugerida: Number(button.dataset.addTask),
      tiempo_estimado: "1 h",
      prioridad: "Media",
      estado: "Pendiente",
      criterio_aprobacion: "",
      riesgos: "",
      observaciones: ""
    });
    newTaskId = id;
  }
  if (button.dataset.insertTaskWeek) {
    const week = Number(button.dataset.insertTaskWeek);
    const insertIndex = Number(button.dataset.insertTaskIndex);
    const weekTaskIds = data.roadmap.tareas
      .map((task, index) => ({ task, index }))
      .filter((item) => Number(item.task.semana_sugerida) === week);
    const globalIndex = insertIndex >= weekTaskIds.length
      ? (weekTaskIds.at(-1)?.index ?? data.roadmap.tareas.length - 1) + 1
      : weekTaskIds[insertIndex].index;
    const id = `task_${Date.now()}`;
    data.roadmap.tareas.splice(globalIndex, 0, {
      id,
      titulo: "Nueva tarea",
      descripcion: "",
      responsable: "Sebastian",
      apoyo: "",
      semana_sugerida: week,
      tiempo_estimado: "1 h",
      prioridad: "Media",
      estado: "Pendiente",
      criterio_aprobacion: "",
      riesgos: "",
      observaciones: ""
    });
    newTaskId = id;
  }
  if (button.dataset.insertTaskPage) {
    const pageId = button.dataset.insertTaskPage;
    const insertIndex = Number(button.dataset.insertTaskIndex);
    const pageTaskIds = data.roadmap.tareas
      .map((task, index) => ({ task, index }))
      .filter((item) => item.task.pagina_id === pageId);
    const globalIndex = insertIndex >= pageTaskIds.length
      ? (pageTaskIds.at(-1)?.index ?? data.roadmap.tareas.length - 1) + 1
      : pageTaskIds[insertIndex].index;
    const id = `task_${Date.now()}`;
    data.roadmap.tareas.splice(globalIndex, 0, {
      id,
      titulo: "Nueva tarea",
      descripcion: "",
      responsable: "Sebastian",
      apoyo: "",
      pagina_id: pageId,
      tiempo_estimado: "1 h",
      prioridad: "Media",
      estado: "Pendiente",
      criterio_aprobacion: "",
      riesgos: "",
      observaciones: ""
    });
    newTaskId = id;
  }
  if (button.dataset.duplicateTask) {
    const original = getTask(button.dataset.duplicateTask);
    data.roadmap.tareas.push({ ...structuredClone(original), id: `task_${Date.now()}`, titulo: `${original.titulo} copia` });
  }
  if (button.dataset.deleteTask && confirm("Eliminar esta tarea?")) {
    data.roadmap.tareas = data.roadmap.tareas.filter((task) => task.id !== button.dataset.deleteTask);
  }
  if (button.dataset.addRow) {
    const rows = getRows(button.dataset.addRow);
    rows.push(Object.fromEntries(Object.keys(rows[0] || { nombre: "" }).map((key) => [key, ""])));
  }
  if (button.dataset.insertRowPath) {
    const rows = getRows(button.dataset.insertRowPath);
    const template = Object.fromEntries(Object.keys(rows[0] || { nombre: "" }).map((key) => [key, ""]));
    rows.splice(Number(button.dataset.insertRowIndex), 0, template);
  }
  if (button.dataset.insertCostIndex) {
    data.costos.costos.splice(Number(button.dataset.insertCostIndex), 0, {
      categoria: "nuevo costo",
      proveedor: "",
      proveedor_elegido: "",
      costo_gratuito: "",
      costo_mensual_bajo: "",
      costo_mensual_estimado: "",
      costo_por_uso: "",
      limite_plan_gratuito: "",
      riesgo: "",
      fuente_pendiente_verificacion: "",
      responsable_investigar: "Sebastian",
      fecha_limite: "",
      decision_confirmada: false,
      estado_decision: "Por investigar",
      decision: ""
    });
  }
  if (button.dataset.duplicateCost) {
    const index = Number(button.dataset.duplicateCost);
    data.costos.costos.splice(index + 1, 0, structuredClone(data.costos.costos[index]));
  }
  if (button.dataset.deleteCost && confirm("Eliminar este costo?")) {
    data.costos.costos.splice(Number(button.dataset.deleteCost), 1);
  }
  if (button.dataset.duplicateRow) {
    const rows = getRows(button.dataset.duplicateRow);
    rows.splice(Number(button.dataset.index) + 1, 0, structuredClone(rows[Number(button.dataset.index)]));
  }
  if (button.dataset.deleteRow && confirm("Eliminar este registro?")) {
    getRows(button.dataset.deleteRow).splice(Number(button.dataset.index), 1);
  }
  dirty();
  render();
});

$("#nav").addEventListener("click", (event) => {
  const back = event.target.closest("[data-back-search]");
  if (back) {
    event.preventDefault();
    filterText = lastSearchText;
    $("#search").value = lastSearchText;
    render();
    return;
  }
  if (event.target.closest("[data-add-week]")) {
    event.preventDefault();
    const weeks = (data.roadmap.fases_6_semanas || []).map((item) => Number(item.semana));
    const nextWeek = (Math.max(0, ...weeks) || 0) + 1;
    const title = prompt("Nombre de la nueva semana", `Semana ${nextWeek}: nueva fase`);
    if (!title) return;
    data.roadmap.fases_6_semanas.push({
      semana: nextWeek,
      titulo: title.replace(/^Semana\s+\d+:\s*/i, ""),
      objetivo: "Definir objetivo de esta semana."
    });
    active = `semana-${nextWeek}`;
    dirty();
    render();
    return;
  }
  if (event.target.closest("[data-add-page]")) {
    event.preventDefault();
    const title = prompt("Nombre de la nueva pagina", "Nueva pagina");
    if (!title) return;
    data.roadmap.paginas = data.roadmap.paginas || [];
    const id = `pagina_${Date.now()}`;
    data.roadmap.paginas.push({
      id,
      titulo: title,
      descripcion: "Pagina de tareas editable."
    });
    active = id;
    dirty();
    render();
    return;
  }
  if (event.target.closest("[data-toggle-weeks]")) {
    event.preventDefault();
    weeksOpen = !weeksOpen;
    localStorage.setItem("planningWeeksOpen", String(weeksOpen));
    render();
    return;
  }
  const deleteNav = event.target.closest("[data-delete-nav]");
  if (deleteNav) {
    event.preventDefault();
    const id = deleteNav.dataset.deleteNav;
    if (id.startsWith("semana-")) {
      const week = Number(id.replace("semana-", ""));
      if (week > baseWeekCount && confirm("Eliminar esta semana agregada y sus tareas?")) {
        data.roadmap.fases_6_semanas = data.roadmap.fases_6_semanas.filter((item) => Number(item.semana) !== week);
        data.roadmap.tareas = data.roadmap.tareas.filter((task) => Number(task.semana_sugerida) !== week);
        active = "resumen";
        dirty();
        render();
      }
      return;
    }
    if ((data.roadmap.paginas || []).some((page) => page.id === id) && confirm("Eliminar esta pagina agregada y sus tareas?")) {
      data.roadmap.paginas = (data.roadmap.paginas || []).filter((item) => item.id !== id);
      data.roadmap.tareas = data.roadmap.tareas.filter((task) => task.pagina_id !== id);
      active = "resumen";
      dirty();
      render();
    }
    return;
  }
  const link = event.target.closest("[data-nav]");
  if (!link) return;
  event.preventDefault();
  lastSearchText = "";
  highlightTaskId = "";
  filterText = "";
  $("#search").value = "";
  active = link.dataset.nav;
  render();
  scrollToTop();
});

$("#search").addEventListener("input", (event) => {
  filterText = event.target.value;
  if (!filterText.trim()) {
    lastSearchText = "";
    highlightTaskId = "";
    active = "resumen";
  }
  render();
});

async function saveData(label = "Guardado") {
  await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  saveState.textContent = `${label}: ${new Date().toLocaleString()}`;
}

$("#saveBtn").addEventListener("click", () => saveData("Guardado manual"));

$("#autoSaveToggle").checked = autoSave;
$("#autoSaveToggle").addEventListener("change", (event) => {
  autoSave = event.target.checked;
  localStorage.setItem("planningAutoSave", String(autoSave));
  saveState.textContent = autoSave ? "Autoguardado activado" : "Autoguardado desactivado. Usa Guardar cambios.";
});

$("#exportBtn").addEventListener("click", async () => {
  saveState.textContent = "Generando resumen...";
  const res = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const html = await res.text();
  const win = window.open("", "_blank");
  win.document.open();
  win.document.write(html);
  win.document.close();
  saveState.textContent = `PDF listo: ${new Date().toLocaleString()}`;
});

$("#menuToggle").addEventListener("click", () => {
  if (document.body.classList.contains("presentation")) {
    document.body.classList.remove("presentation");
  } else {
    document.body.classList.toggle("nav-collapsed");
  }
});

data = await (await fetch("/api/data")).json();
saveState.textContent = "Datos cargados. Empiecen por Resumen o Semana 1.";
render();
