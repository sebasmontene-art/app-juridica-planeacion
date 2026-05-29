# Planning dashboard juridico

Herramienta local editable para planear una plataforma juridica modular asistida por IA. No es la aplicacion productiva y no integra pagos, WhatsApp, IA real, autenticacion ni base de datos.

## Ejecutar

```bash
cd planning_dashboard
npm start
```

Si PowerShell bloquea `npm.ps1`, usa una de estas opciones:

```bash
npm.cmd start
node src/server.js
```

Luego abre:

```text
http://localhost:5000
```

Si aparece `EADDRINUSE`, significa que el puerto `5000` ya esta ocupado. Primero prueba abrir `http://localhost:5000`; si ya carga el dashboard, no necesitas iniciar otro servidor.

Para usar otro puerto:

```bash
set PORT=4178 && node src/server.js
```

## Guardado

El boton `Guardar cambios` persiste los cambios en archivos JSON dentro de:

```text
planning_dashboard/data/
```

JSON significa JavaScript Object Notation. En este dashboard es simplemente el formato de archivo donde se guardan las tablas y textos editables. No es una base de datos, no es un secreto y no se envia a internet por si solo; queda en el proyecto para que al cerrar y abrir se mantengan los cambios.

El boton `Exportar resumen` genera un resumen visual para imprimir o guardar como PDF desde el navegador. No hace pagos, no llama APIs externas y no envia datos a terceros.

## Replit

Para Replit se incluye:

```text
.replit
replit.nix
```

`replit.nix` declara Node.js 20. Si Replit muestra `node: command not found` o `npm: executable file not found`, normalmente significa que el entorno de deployment no cargo esa dependencia todavia; hay que actualizar desde GitHub y redeployar.

## Secciones

- Resumen editable del proyecto
- Semana 1 a Semana 6 con tareas tipo tabla
- Checkbox de hecho/no hecho por tarea
- Responsable, descripcion, tiempo, estado y notas
- Costos por investigar
- Decisiones
- Riesgos
- Modulos juridicos

## Reglas de uso

- No guardar secretos.
- No cargar expedientes reales de ciudadanos en esta fase.
- No confundir este dashboard con la aplicacion productiva.
- Usar datos ficticios o matrices de trabajo para la reunion.

## Tecnologia

Servidor local Node.js con modulos nativos. No tiene dependencias externas ni requiere internet.
