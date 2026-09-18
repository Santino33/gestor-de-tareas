// app.js — punto de entrada: conecta tareas.js con el DOM. Sesión 8 (módulos).
import { crearTarea, renderizarTarea, cargarTareas, guardarTareas } from "./tareas.js";

let tareas = [];

const listaEl = document.getElementById("lista-tareas");
const formEl = document.getElementById("form-tarea");
const inputTituloEl = document.getElementById("input-titulo");
const inputPrioridadEl = document.getElementById("input-prioridad");

const pintarTodo = () => {
  listaEl.innerHTML = "";
  tareas.forEach((tarea) =>
    renderizarTarea(tarea, listaEl, {
      onToggle: alternarCompletada,
      onEliminar: eliminarTarea,
    })
  );
};

function alternarCompletada(id) {
  tareas = tareas.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t));
  guardarTareas(tareas);
  pintarTodo();
}

function eliminarTarea(id) {
  tareas = tareas.filter((t) => t.id !== id);
  guardarTareas(tareas);
  pintarTodo();
}

formEl.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const titulo = inputTituloEl.value.trim();
  if (!titulo) return;
  tareas.push(crearTarea(titulo, inputPrioridadEl.value));
  guardarTareas(tareas);
  pintarTodo();
  formEl.reset();
});

async function iniciar() {
  tareas = await cargarTareas();
  if (tareas.length === 0) {
    tareas = [crearTarea("Aprender el Bloque 3: PWA", "alta")];
    guardarTareas(tareas);
  }
  pintarTodo();
}

iniciar();
