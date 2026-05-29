import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const planningDir = path.resolve(__dirname, "..", "data");
const port = Number(process.env.PORT || 5000);

const files = {
  plan_general: "plan_general.json",
  modulos: "modulos.json",
  roadmap: "roadmap.json",
  arquitectura_funcional: "arquitectura_funcional.json",
  arquitectura_tecnica: "arquitectura_tecnica.json",
  costos: "costos.json",
  plataformas: "plataformas.json",
  riesgos: "riesgos.json",
  decisiones: "decisiones.json",
  responsables: "responsables.json",
  biblioteca_juridica: "biblioteca_juridica.json"
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf"
};

async function readJsonData() {
  const data = {};
  for (const [key, filename] of Object.entries(files)) {
    const raw = await fs.readFile(path.join(planningDir, filename), "utf8");
    data[key] = JSON.parse(raw);
  }
  return data;
}

async function writeJsonData(payload) {
  await fs.mkdir(planningDir, { recursive: true });
  for (const [key, value] of Object.entries(payload || {})) {
    if (!files[key]) continue;
    await fs.writeFile(path.join(planningDir, files[key]), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}

function markdown(data) {
  const plan = data.plan_general || {};
  const modules = data.modulos?.modulos || [];
  const tasks = data.roadmap?.tareas || [];
  const risks = data.riesgos?.riesgos || [];
  const decisions = data.decisiones?.decisiones || [];
  const costs = data.costos?.costos || [];
  const decidedCosts = costs.filter((item) => item.decision_confirmada === true || item.estado_decision === "Decision tomada");
  const pendingCosts = costs.filter((item) => !(item.decision_confirmada === true || item.estado_decision === "Decision tomada"));
  const parseCost = (value = "") => {
    const number = Number(String(value).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  };
  const totalCost = decidedCosts.reduce((sum, item) => sum + parseCost(item.costo_mensual_estimado || item.costo_mensual_bajo), 0);
  const horizon = data.roadmap?.horizonte_12_meses || [];
  const phaseMeta = data.roadmap?.fases_6_semanas || [];
  const knowledge = data.biblioteca_juridica || {};
  const weeks = (data.roadmap?.fases_6_semanas || []).map((item) => Number(item.semana)).sort((a, b) => a - b);

  return `# Plan resumen - Plataforma juridica modular

Generado: ${new Date().toISOString()}

## Siglas usadas

- MVP: Producto Minimo Viable, primera version simple para validar antes de construir todo.
- IA: Inteligencia Artificial.
- API: Interfaz de programacion para conectar sistemas.

## Resumen ejecutivo

- Proyecto: ${plan.resumen_ejecutivo?.nombre_proyecto || ""}
- Objetivo: ${plan.resumen_ejecutivo?.objetivo_general || ""}
- Publico objetivo: ${plan.resumen_ejecutivo?.publico_objetivo || ""}
- Propuesta de valor: ${plan.resumen_ejecutivo?.propuesta_valor || ""}
- Enfoque: las primeras 6 semanas no construyen toda la plataforma; preparan planeacion, arquitectura, costeo y MVP gratuito de animales para escalar gradualmente durante 12 meses.

## Alcance MVP

### Entra
${(plan.alcance_mvp?.entra || []).map((item) => `- ${item}`).join("\n")}

### No entra
${(plan.alcance_mvp?.no_entra || []).map((item) => `- ${item}`).join("\n")}

## Plan por semanas

${weeks.map((week) => {
  const weekTasks = tasks.filter((task) => Number(task.semana_sugerida) === week);
  const meta = phaseMeta.find((item) => Number(item.semana) === week);
  return `### Semana ${week}: ${meta?.titulo || ""}

${meta?.objetivo || ""}

| Hecho | Tarea | Responsable | Tiempo | Estado | Criterio |
| --- | --- | --- | --- | --- | --- |
${weekTasks.map((task) => `| ${task.estado === "Cerrado" ? "Si" : "No"} | ${task.titulo || ""} | ${task.responsable || ""} | ${task.tiempo_estimado || ""} | ${task.estado || ""} | ${task.criterio_aprobacion || ""} |`).join("\n")}`;
}).join("\n\n")}

## Horizonte estrategico de 12 meses

| Periodo | Enfoque | Objetivo | Entregables | Condicion |
| --- | --- | --- | --- | --- |
${horizon.map((item) => `| ${item.periodo || ""} | ${item.enfoque || ""} | ${item.objetivo || ""} | ${item.entregables || ""} | ${item.condicion || ""} |`).join("\n")}

## Paginas adicionales

${(data.roadmap?.paginas || []).map((page) => {
  const pageTasks = tasks.filter((task) => task.pagina_id === page.id);
  return `### ${page.titulo || ""}

${page.descripcion || ""}

| Hecho | Tarea | Responsable | Tiempo | Estado | Criterio |
| --- | --- | --- | --- | --- | --- |
${pageTasks.map((task) => `| ${task.estado === "Cerrado" ? "Si" : "No"} | ${task.titulo || ""} | ${task.responsable || ""} | ${task.tiempo_estimado || ""} | ${task.estado || ""} | ${task.criterio_aprobacion || ""} |`).join("\n")}`;
}).join("\n\n")}

## Modulos juridicos

${modules.map((item) => `- ${item.nombre}: ${item.tipo}, prioridad ${item.prioridad}, estado ${item.estado}`).join("\n")}

## Riesgos principales

${risks.map((item) => `- ${item.riesgo}: ${item.nivel} | mitigacion: ${item.mitigacion}`).join("\n")}

## Costos por investigar

${pendingCosts.map((item) => `- ${item.categoria}: responsable ${item.responsable_investigar}, decision ${item.decision}`).join("\n")}

## Decisiones de costos tomadas

- Total mensual estimado: ${totalCost}

${decidedCosts.map((item) => `- ${item.categoria}: ${item.proveedor_elegido || item.proveedor || ""}, costo mensual ${item.costo_mensual_estimado || item.costo_mensual_bajo || ""}, decision ${item.decision}`).join("\n")}

## WhatsApp y pagos

- WhatsApp: ${plan.whatsapp?.recomendacion_preliminar || ""}
- Canal vs pasarela: ${plan.whatsapp?.diferencia_canal_pasarela || ""}
- Pagos: ${plan.pagos?.validacion_pago || ""}

## Obsidian y NotebookLM

- Obsidian: ${(knowledge.obsidian?.usos || []).join("; ")}
- NotebookLM: ${(knowledge.notebooklm?.usos || []).join("; ")}
- Regla: ${knowledge.regla_datos || ""}

## Decisiones

${decisions.map((item) => `- ${item.fecha} - ${item.decision} (${item.estado})`).join("\n")}
`;
}

function htmlSummary(data) {
  const md = markdown(data);
  const html = md
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\| Hecho \| Tarea \| Responsable \| Tiempo \| Estado \| Criterio \|\n\| --- \| --- \| --- \| --- \| --- \| --- \|\n([\s\S]*?)(?=<h3>|<h2>|$)/g, (_match, rows) => {
      const trs = rows.trim().split("\n").filter(Boolean).map((row) => {
        const cells = row.split("|").slice(1, -1).map((cell) => `<td>${cell.trim()}</td>`).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table><thead><tr><th>Hecho</th><th>Tarea</th><th>Responsable</th><th>Tiempo</th><th>Estado</th><th>Criterio</th></tr></thead><tbody>${trs}</tbody></table>`;
    });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan resumen</title><style>
    body{font-family:Arial,sans-serif;line-height:1.45;color:#1d2a2f;margin:36px}
    h1{font-size:26px} h2{margin-top:28px;border-bottom:1px solid #ccd6d8;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:10px 0 22px;font-size:12px}
    th,td{border:1px solid #cfd8dc;padding:6px;text-align:left;vertical-align:top}
    th{background:#eef4f2} li{margin:4px 0}
    @media print{body{margin:18mm}}
  </style></head><body><p>${html}</p></body></html>`;
}

function esc(text) {
  return String(text || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function htmlResumen(data) {
  const plan = data.plan_general || {};
  const re = plan.resumen_ejecutivo || {};
  const modules = data.modulos?.modulos || [];
  const tasks = data.roadmap?.tareas || [];
  const risks = data.riesgos?.riesgos || [];
  const decisions = data.decisiones?.decisiones || [];
  const costs = data.costos?.costos || [];
  const phaseMeta = data.roadmap?.fases_6_semanas || [];
  const horizon = data.roadmap?.horizonte_12_meses || [];
  const extraPages = data.roadmap?.paginas || [];

  const decidedCosts = costs.filter((c) => c.decision_confirmada === true || c.estado_decision === "Decision tomada");
  const pendingCosts = costs.filter((c) => !(c.decision_confirmada === true || c.estado_decision === "Decision tomada"));
  const parseCost = (v = "") => { const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const totalCost = decidedCosts.reduce((s, c) => s + parseCost(c.costo_mensual_estimado || c.costo_mensual_bajo), 0);
  const fmt = (n) => new Intl.NumberFormat("es-CO").format(n);

  const allTasks = tasks.filter((t) => !t.pagina_id);
  const done = allTasks.filter((t) => t.estado === "Cerrado").length;
  const pct = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;
  const pctColor = pct >= 70 ? "#2e7d52" : pct >= 35 ? "#b07d1a" : "#c0392b";

  function table(headers, rows) {
    if (!rows.length) return `<p style="color:#888;font-size:12px">Sin datos</p>`;
    return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function weekBlock(week) {
    const meta = phaseMeta.find((m) => Number(m.semana) === Number(week));
    if (!meta) return "";
    const wTasks = tasks.filter((t) => Number(t.semana_sugerida) === Number(week) && !t.pagina_id);
    const wDone = wTasks.filter((t) => t.estado === "Cerrado").length;
    const wPct = wTasks.length ? Math.round((wDone / wTasks.length) * 100) : 0;
    const wColor = wPct >= 70 ? "#2e7d52" : wPct >= 35 ? "#b07d1a" : "#c0392b";
    return `
    <div class="week-block">
      <div class="week-header">
        <div>
          <strong>Semana ${week}</strong>
          <span class="week-sub">${esc(meta.titulo || "")}</span>
        </div>
        <span class="pct-badge" style="color:${wColor}">${wPct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${wPct}%;background:${wColor}"></div></div>
      <p class="week-obj">${esc(meta.objetivo || "")}</p>
      ${wTasks.length ? table(["✓", "Tarea", "Responsable", "Tiempo", "Estado", "Criterio"],
        wTasks.map((t) => [t.estado === "Cerrado" ? "Si" : "No", t.titulo || "", t.responsable || "", t.tiempo_estimado || "", t.estado || "", t.criterio_aprobacion || ""])) : ""}
    </div>`;
  }

  const weeks6 = [1,2,3,4,5,6];
  const extraWeeks = [...new Set(tasks.filter((t) => !t.pagina_id && Number(t.semana_sugerida) > 6).map((t) => Number(t.semana_sugerida)))].sort((a,b) => a-b);

  const now = new Date().toLocaleString("es-CO");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Plan Resumen - Plataforma Juridica Modular</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1d2a2f;background:#f4f6f7;padding:24px}
  h1{font-size:22px;font-weight:700;color:#1d2a2f;margin-bottom:4px}
  h2{font-size:15px;font-weight:700;color:#1d2a2f;margin:0 0 10px}
  h3{font-size:13px;font-weight:700;color:#1d2a2f;margin:16px 0 8px}
  .meta{font-size:11px;color:#7a9098;margin-bottom:20px}
  .card{background:#fff;border:1px solid #dde3e5;border-radius:8px;padding:18px;margin-bottom:14px}
  .card-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .progress-bar{height:8px;background:#e0e6e8;border-radius:4px;overflow:hidden;margin:6px 0}
  .progress-fill{height:100%;border-radius:4px;transition:width .3s}
  .progress-head{display:flex;justify-content:space-between;align-items:flex-start}
  .big-pct{font-size:22px;font-weight:700}
  .label-sm{font-size:11px;color:#7a9098;margin-bottom:2px}
  ul{padding-left:18px;margin:6px 0} li{margin:3px 0}
  table{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0}
  th{background:#eef4f2;font-weight:600;color:#1d2a2f;padding:6px 8px;text-align:left;border:1px solid #dde3e5}
  td{padding:5px 8px;border:1px solid #dde3e5;vertical-align:top;color:#1d2a2f}
  tr:nth-child(even) td{background:#f9fbfb}
  .week-block{background:#fff;border:1px solid #dde3e5;border-radius:8px;padding:16px;margin-bottom:12px}
  .week-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .week-sub{display:block;font-size:11px;color:#7a9098;font-weight:400;margin-top:2px}
  .pct-badge{font-size:16px;font-weight:700}
  .week-obj{font-size:12px;color:#5a6e74;margin:6px 0 10px;font-style:italic}
  .section-title{font-size:16px;font-weight:700;color:#1d2a2f;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #dde3e5}
  .tag{display:inline-block;background:#e8f2ee;color:#2e7d52;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600}
  .tag.pago{background:#e8eef4;color:#1a4a7d}
  .tag.suscripcion{background:#f4eee8;color:#7d4a1a}
  @media print{
    body{background:#fff;padding:12px}
    .card,.week-block{break-inside:avoid;border:1px solid #ccc}
    .section-title{break-before:auto}
  }
</style>
</head>
<body>
<h1>Planeacion de plataforma juridica modular</h1>
<p class="meta">Exportado: ${esc(now)}</p>

<!-- Progreso general -->
<div class="card">
  <div class="progress-head">
    <div>
      <div style="font-weight:700;font-size:13px">Progreso general de tareas</div>
      <div style="font-size:11px;color:#7a9098;margin-top:2px">${done} de ${allTasks.length} tareas cerradas.</div>
    </div>
    <div class="big-pct" style="color:${pctColor}">${pct}%</div>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pctColor}"></div></div>
  <div style="font-size:11px;color:#7a9098;margin-top:4px">Rojo indica avance bajo; verde indica avance alto.</div>
</div>

<!-- Objetivo general -->
<div class="card">
  <div class="label-sm">Plataforma juridica modular asistida por inteligencia artificial</div>
  <p style="margin-top:6px">${esc(re.objetivo_general || "")}</p>
</div>

<!-- Problema / Publico objetivo -->
<div class="card-row">
  <div class="card" style="margin:0">
    <h2>Problema</h2>
    <p>${esc(re.problema || "")}</p>
  </div>
  <div class="card" style="margin:0">
    <h2>Publico objetivo</h2>
    <p>${esc(re.publico_objetivo || "")}</p>
  </div>
</div>

<!-- Propuesta de valor / MVP -->
<div class="card-row">
  <div class="card" style="margin:0">
    <h2>Propuesta de valor</h2>
    <p>${esc(re.propuesta_valor || "")}</p>
  </div>
  <div class="card" style="margin:0">
    <h2>Entra en el MVP</h2>
    <ul>${(plan.alcance_mvp?.entra || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
  </div>
</div>

<!-- No entra MVP -->
<div class="card" style="max-width:50%">
  <h2>No entra en el MVP</h2>
  <ul>${(plan.alcance_mvp?.no_entra || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
</div>

<!-- Semanas 1-6 -->
<div class="section-title">Avance de las primeras 6 semanas</div>
<div class="card" style="padding:0;overflow:hidden">
  <table style="margin:0">
    <thead><tr><th>SEMANA</th><th>OBJETIVO</th><th>HECHAS</th><th>AVANCE</th></tr></thead>
    <tbody>
    ${weeks6.map((w) => {
      const m = phaseMeta.find((p) => Number(p.semana) === w) || {};
      const wt = tasks.filter((t) => Number(t.semana_sugerida) === w && !t.pagina_id);
      const wd = wt.filter((t) => t.estado === "Cerrado").length;
      const wp = wt.length ? Math.round((wd / wt.length) * 100) : 0;
      const wc = wp >= 70 ? "#2e7d52" : wp >= 35 ? "#b07d1a" : "#c0392b";
      return `<tr>
        <td><strong>Semana ${w}</strong><br><span style="font-size:10px;color:#7a9098">${esc(m.titulo || "")}</span></td>
        <td>${esc(m.objetivo || "")}</td>
        <td style="white-space:nowrap">${wd}/${wt.length}</td>
        <td style="min-width:80px"><div class="progress-bar"><div class="progress-fill" style="width:${wp}%;background:${wc}"></div></div><span style="font-size:10px;color:${wc}">${wp}% hecho</span></td>
      </tr>`;
    }).join("")}
    </tbody>
  </table>
</div>

<!-- Horizonte 12 meses -->
<div class="section-title">Horizonte estrategico de 12 meses</div>
<div class="card" style="padding:0;overflow:hidden">
  ${table(["PERIODO","ENFOQUE","OBJETIVO","CONDICION"], horizon.map((h) => [h.periodo||"", h.enfoque||"", h.objetivo||"", h.condicion||""]))}
</div>

<!-- Modulos juridicos -->
<div class="section-title">Modulos juridicos</div>
<div class="card" style="padding:0;overflow:hidden">
  ${table(["MODULO","TIPO","PRIORIDAD","ESTADO"], modules.map((m) => [m.nombre||"", m.tipo||"", m.prioridad||"", m.estado||""]))}
</div>

<!-- Costos criticos por investigar -->
${pendingCosts.length ? `<div class="section-title">Costos criticos por investigar</div>
<div class="card" style="padding:0;overflow:hidden">
  ${table(["CATEGORIA","RESPONSABLE","FECHA LIMITE","DECISION"], pendingCosts.map((c) => [c.categoria||"", c.responsable_investigar||c.responsable||"", c.fecha_limite||"", c.decision||""]))}
</div>` : ""}

<!-- Decisiones de costos tomadas -->
${decidedCosts.length ? `<div class="section-title">Decisiones de costos tomadas</div>
<div class="card">
  <p style="font-size:12px;color:#7a9098;margin-bottom:10px">Total mensual estimado: <strong style="color:#1d2a2f">$${fmt(totalCost)} COP</strong></p>
  ${table(["CATEGORIA","PROVEEDOR ELEGIDO","COSTO MENSUAL","DECISION"], decidedCosts.map((c) => [c.categoria||"", c.proveedor_elegido||c.proveedor||"", c.costo_mensual_estimado||c.costo_mensual_bajo||"", c.decision||""]))}
</div>` : ""}

<!-- Decisiones registradas -->
${decisions.length ? `<div class="section-title">Decisiones registradas</div>
<div class="card" style="padding:0;overflow:hidden">
  ${table(["FECHA","DECISION","ESTADO"], decisions.map((d) => [d.fecha||"", d.decision||"", d.estado||""]))}
</div>` : ""}

<!-- Tareas por semana -->
<div class="section-title">Tareas por semana</div>
${weeks6.map((w) => weekBlock(w)).join("")}
${extraWeeks.length ? `<div style="font-weight:700;margin:16px 0 8px;color:#7a9098">Semanas adicionales</div>${extraWeeks.map((w) => weekBlock(w)).join("")}` : ""}

<!-- Paginas adicionales -->
${extraPages.length ? `<div class="section-title">Paginas adicionales</div>${extraPages.map((pg) => {
  const pgTasks = tasks.filter((t) => t.pagina_id === pg.id);
  return `<div class="week-block"><h3>${esc(pg.titulo||"")}</h3><p class="week-obj">${esc(pg.objetivo||pg.descripcion||"")}</p>${pgTasks.length ? table(["✓","Tarea","Responsable","Tiempo","Estado","Criterio"], pgTasks.map((t) => [t.estado==="Cerrado"?"Si":"No", t.titulo||"", t.responsable||"", t.tiempo_estimado||"", t.estado||"", t.criterio_aprobacion||""])) : ""}</div>`;
}).join("")}` : ""}

<script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));<\/script>
</body>
</html>`;
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function send(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  if (Buffer.isBuffer(payload)) {
    res.end(payload);
    return;
  }
  res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
}

function sendDownload(res, filename, buffer, type) {
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  });
  res.end(buffer);
}

function safeStaticPath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const fullPath = path.resolve(publicDir, `.${requested}`);
  if (!fullPath.startsWith(publicDir)) return null;
  return fullPath;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/data") {
      return send(res, 200, await readJsonData());
    }
    if (req.method === "GET" && req.url === "/healthz") {
      return send(res, 200, { ok: true, status: "healthy" });
    }
    if (req.method === "POST" && req.url === "/api/save") {
      await writeJsonData(await body(req));
      return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
    }
    if (req.method === "POST" && req.url === "/api/export") {
      const payload = await body(req);
      await writeJsonData(payload);
      const html = htmlResumen(payload);
      return send(res, 200, html, "text/html; charset=utf-8");
    }

    const staticPath = safeStaticPath(new URL(req.url, `http://localhost:${port}`).pathname);
    if (!staticPath) return send(res, 403, "Ruta no permitida", "text/plain; charset=utf-8");
    const content = await fs.readFile(staticPath);
    return send(res, 200, content, mime[path.extname(staticPath)] || "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT") return send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    console.error(error);
    return send(res, 500, { ok: false, error: error.message });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${port} ya esta en uso. Abre http://localhost:${port} si el dashboard ya esta corriendo, o inicia otra instancia con:`);
    console.error("  set PORT=4178 && node src/server.js");
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => {
  console.log(`Planning dashboard: http://localhost:${port}`);
});
