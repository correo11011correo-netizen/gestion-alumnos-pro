const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGCoVCwcpnaMepbx2ARELi_6wD76kGYw2FEgEox4hJmslIqgYY5gnOGaWe9LK5lsm3Lg/exec';
let userToken = null;
let clases = [];
let alumnos = [];

// Referencia a la consola de depuración visual
const debugLogElement = document.getElementById('debug-log');
const copyLogBtn = document.getElementById('copy-log-btn');

// Función para loguear visualmente en pantalla (para Android)
function logVisual(msg, type = 'info') {
    if (debugLogElement) {
        const entry = document.createElement('div');
        entry.style.borderBottom = '1px solid #222';
        entry.style.padding = '2px 0';
        entry.style.color = type === 'error' ? '#ff0000' : (type === 'warn' ? '#ffff00' : '#00ff00');
        entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugLogElement.appendChild(entry);
        debugLogElement.scrollTop = debugLogElement.scrollHeight; // Auto-scroll
    }
    console.log(msg); // Mantener console.log para entorno de desarrollo
}

if (copyLogBtn) {
    copyLogBtn.addEventListener('click', () => {
        if (debugLogElement) {
            const logText = debugLogElement.innerText; // Obtener todo el texto visible
            navigator.clipboard.writeText(logText).then(() => {
                logVisual("Log copiado al portapapeles.");
                alert("Log copiado al portapapeles!"); // Feedback adicional para Android
            }).catch(err => {
                logVisual(`Error al copiar log: ${err}`, 'error');
                alert(`Error al copiar log: ${err}`);
            });
        }
    });
}

logVisual("Script.js cargado correctamente.");

// Exponer funciones al ámbito global para que Google Sign-In pueda verlas
window.onSignIn = function(googleUser) {
    logVisual("Evento onSignIn disparado.");
    try {
        const profile = googleUser.getBasicProfile();
        logVisual(`Usuario autenticado: ${profile.getName()} (${profile.getEmail()})`);

        userToken = googleUser.getAuthResponse().id_token;
        logVisual("ID Token obtenido con éxito.");

        // UI Updates - FORZAR CAMBIOS CON VERIFICACIONES
        logVisual("Iniciando actualización de la interfaz de usuario...");
        const signinBtn = document.querySelector('.g-signin2');
        const signoutBtn = document.getElementById('signout-btn');
        const mainNav = document.getElementById('main-nav');
        const appContent = document.getElementById('app-content');

        if (signinBtn) {
            signinBtn.style.display = 'none';
            logVisual(`Estado del botón Sign-In: ${signinBtn.style.display}`);
        } else { logVisual("WARN: Botón Sign-In ('.g-signin2') no encontrado.", 'warn'); }

        if (signoutBtn) {
            signoutBtn.style.display = 'block';
            logVisual(`Estado del botón Sign-Out: ${signoutBtn.style.display}`);
        } else { logVisual("WARN: Botón Sign-Out ('#signout-btn') no encontrado.", 'warn'); }

        if (mainNav) {
            mainNav.style.display = 'flex';
            logVisual(`Estado de Navegación Principal: ${mainNav.style.display}`);
        } else { logVisual("WARN: Navegación principal ('#main-nav') no encontrada.", 'warn'); }

        if (appContent) {
            appContent.style.display = 'flex';
            logVisual(`Estado del Contenido de la Aplicación: ${appContent.style.display}`);
        } else { logVisual("WARN: Contenido de la aplicación ('#app-content') no encontrado.", 'warn'); }

        logVisual("Finalizada actualización visual post-login. Iniciando carga de datos...");
        initApp();
    } catch (error) {
        logVisual(`ERROR crítico en onSignIn: ${error.message}. Stack: ${error.stack}`, 'error');
    }
};

window.signOut = function() {
    logVisual("Cerrando sesión...");
    try {
        var auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(function () {
            logVisual('Sesión cerrada exitosamente.');
            userToken = null;
            
            const signinBtn = document.querySelector('.g-signin2');
            const signoutBtn = document.getElementById('signout-btn');
            const mainNav = document.getElementById('main-nav');
            const appContent = document.getElementById('app-content');

            if (signinBtn) signinBtn.style.display = 'block';
            if (signoutBtn) signoutBtn.style.display = 'none';
            if (mainNav) mainNav.style.display = 'none';
            if (appContent) appContent.style.display = 'none';
            logVisual("Interfaz de usuario actualizada post-logout.");
        });
    } catch (error) {
        logVisual(`ERROR en signOut: ${error.message}`, 'error');
    }
};

async function callBackend(action, method = 'GET', data = null) {
    logVisual(`Llamada API: ${action} [${method}]. Data: ${JSON.stringify(data)}`);
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.append('action', action);
    
    const options = {
        method: method,
        mode: 'cors'
    };

    if (method === 'POST' && data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        logVisual(`HTTP Status para ${action}: ${response.status} (${response.statusText})`);
        const responseText = await response.text(); // Leer texto para posible error JSON
        logVisual(`Raw response text for ${action}: ${responseText.substring(0, 200)}...`); // Log primeros 200 chars

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. Response: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (jsonError) {
            throw new Error(`JSON parse error for ${action}: ${jsonError.message}. Raw: ${responseText}`);
        }
        
        logVisual(`Respuesta API (${action}): Status: ${result.status}, Message: ${result.message || 'N/A'}`);
        return result;
    } catch (error) {
        logVisual(`ERROR en callBackend (${action}): ${error.message}. Stack: ${error.stack}`, 'error');
        return { status: 'error', message: error.toString() };
    }
}

async function initApp() {
    logVisual("Iniciando carga de datos remotos de la aplicación...");
    await refreshData();
}

async function refreshData() {
    logVisual("Refrescando datos de Cursos y Alumnos...");
    try {
        const resClases = await callBackend('getClases');
        if (resClases.status === 'success') {
            clases = resClases.data || [];
            logVisual(`Cursos cargados: ${clases.length}. Datos: ${JSON.stringify(clases.slice(0,1))}` );
            renderCursos();
            updateClasesSelect();
        } else {
            logVisual(`Error al cargar cursos: ${resClases.message}. Raw: ${JSON.stringify(resClases)}`, 'warn');
        }

        const resAlumnos = await callBackend('getAlumnos');
        if (resAlumnos.status === 'success') {
            alumnos = resAlumnos.data || [];
            logVisual(`Alumnos cargados: ${alumnos.length}. Datos: ${JSON.stringify(alumnos.slice(0,1))}`);
            renderAlumnos();
        } else {
            logVisual(`Error al cargar alumnos: ${resAlumnos.message}. Raw: ${JSON.stringify(resAlumnos)}`, 'warn');
        }
    } catch (error) {
        logVisual(`ERROR crítico en refreshData: ${error.message}. Stack: ${error.stack}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    logVisual("DOM completamente cargado.");
    const cursoForm = document.getElementById('cursoForm');
    const selectHora = document.getElementById('c_horaInicio');
    const statusMsg = document.getElementById('availability-badge');

    // --- GENERAR SELECTOR DE HORAS ---
    const generateHours = () => {
        if (!selectHora) { logVisual("WARN: selectHora no encontrado.", 'warn'); return; }
        selectHora.innerHTML = '<option value="">-- Selecciona Hora --</option>';
        for (let h = 8; h <= 21; h++) {
            for (let m of ['00', '30']) {
                if (h === 21 && m === '30') continue;
                const time = `${h.toString().padStart(2, '0')}:${m}`;
                const opt = document.createElement('option');
                opt.value = time;
                opt.innerText = time;
                selectHora.appendChild(opt);
            }
        }
        logVisual("Selector de horas generado.");
    };
    generateHours();

    window.switchTab = (tabName) => {
        logVisual(`Cambiando pestaña a: ${tabName}`);
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) targetTab.classList.add('active');
        else logVisual(`WARN: Pestaña target '#tab-${tabName}' no encontrada.`, 'warn');

        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
            const attr = btn.getAttribute('onclick');
            return attr && attr.includes(tabName);
        });
        if (activeBtn) activeBtn.classList.add('active');
        else logVisual(`WARN: Botón de pestaña para '${tabName}' no encontrado.`, 'warn');
        
        if (tabName === 'alumnos') updateClasesSelect();
    };

    // --- LOGICA DE CRUCE Y DISPONIBILIDAD ---
    const checkCruces = () => {
        if (!selectHora || !statusMsg) { logVisual("WARN: Elementos selectHora o statusMsg no encontrados en checkCruces.", 'warn'); return true; }
        const hInicio = selectHora.value;
        const duracion = parseFloat(document.getElementById('c_duracion').value);
        const dias = Array.from(document.querySelectorAll('.c_dias:checked')).map(cb => cb.value);
        const modalidad = document.getElementById('c_modalidad').value;

        logVisual(`Verificando cruces: Inicio=${hInicio}, Duracion=${duracion}, Dias=${dias.join(',')}, Modalidad=${modalidad}`);

        if (!hInicio || dias.length === 0 || modalidad === 'Virtual') {
            statusMsg.innerText = "Selecciona horario para verificar...";
            statusMsg.className = "status-msg";
            return true;
        }

        const [h, m] = hInicio.split(':').map(Number);
        const totalMinInicio = h * 60 + m;
        const totalMinFin = totalMinInicio + (duracion * 60);

        for (let clase of clases) {
            if (clase.modalidad === 'Virtual') continue;
            const compartenDia = dias.some(d => (clase.dias || []).includes(d));
            if (compartenDia) {
                const [chI, cmI] = (clase.horainicio || "00:00").split(':').map(Number);
                const [chF, cmF] = (clase.horafin || "00:00").split(':').map(Number);
                const cMinI = chI * 60 + cmI;
                const cMinF = chF * 60 + cmF;

                if ((totalMinInicio >= cMinI && totalMinInicio < cMinF) || 
                    (totalMinFin > cMinI && totalMinFin <= cMinF) ||
                    (totalMinInicio <= cMinI && totalMinFin >= cMinF)) {
                    statusMsg.innerText = `❌ OCUPADO por ${clase.nombre}`;
                    statusMsg.className = "status-msg error";
                    logVisual(`Cruce detectado con ${clase.nombre}.`, 'warn');
                    return false;
                }
            }
        }
        statusMsg.innerText = `✅ DISPONIBLE (Termina ${Math.floor(totalMinFin/60)}:${(totalMinFin%60).toString().padStart(2,'0')})`;
        statusMsg.className = "status-msg success";
        logVisual("Horario disponible.");
        return true;
    };

    if (selectHora) {
        [selectHora, document.getElementById('c_duracion'), document.getElementById('c_modalidad')].forEach(el => {
            if (el) el.addEventListener('change', checkCruces);
        });
        document.querySelectorAll('.c_dias').forEach(el => el.addEventListener('change', checkCruces));
    }

    if (cursoForm) {
        cursoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            logVisual("Formulario de curso enviado.");
            if (!checkCruces()) return alert('El local está ocupado en ese horario.');

            const hInicio = selectHora.value;
            const duracion = parseFloat(document.getElementById('c_duracion').value);
            const [h, m] = hInicio.split(':').map(Number);
            const totalMinFin = (h * 60 + m) + (duracion * 60);
            const horaFin = `${Math.floor(totalMinFin/60).toString().padStart(2,'0')}:${(totalMinFin%60).toString().padStart(2,'0')}`;

            const nuevaClase = {
                id: 'C-' + Date.now(),
                nombre: document.getElementById('c_nombre').value,
                profesor: document.getElementById('c_profesor').value,
                modalidad: document.getElementById('c_modalidad').value,
                dias: Array.from(document.querySelectorAll('.c_dias:checked')).map(cb => cb.value),
                horaInicio: hInicio,
                horaFin: horaFin,
                duracion: duracion
            };
            logVisual(`Datos de nueva clase: ${JSON.stringify(nuevaClase)}`);

            const res = await callBackend('addClase', 'POST', nuevaClase);
            if (res.status === 'success') {
                logVisual("Clase guardada con éxito, refrescando datos...");
                await refreshData();
                cursoForm.reset();
                checkCruces();
            } else {
                logVisual(`ERROR: Falló al guardar clase: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
                alert('Error al guardar el curso: ' + res.message);
            }
        });
    }

    window.renderCursos = () => {
        const container = document.getElementById('cursosContainer');
        if (!container) { logVisual("WARN: Contenedor de cursos no encontrado.", 'warn'); return; }
        container.innerHTML = '';
        if (clases.length === 0) {
            container.innerHTML = '<p class="empty-msg">No hay cursos programados.</p>';
            logVisual("No hay cursos programados para renderizar.");
            return;
        }
        logVisual(`Renderizando ${clases.length} cursos.`);

        const profes = {};
        clases.forEach(c => {
            if (!profes[c.profesor]) profes[c.profesor] = [];
            profes[c.profesor].push(c);
        });

        for (let prof in profes) {
            const card = document.createElement('div');
            card.className = 'profe-card';
            let html = `<div class="profe-header"><i class="ri-user-star-line"></i> Prof. ${prof}</div>`;
            profes[prof].forEach(c => {
                html += `
                    <div class="curso-item ${c.modalidad === 'Virtual' ? 'virtual' : ''}">
                        <div class="curso-main">${c.nombre}</div>
                        <div class="curso-sub">
                            <span><i class="ri-calendar-line"></i> ${(c.dias || []).join(',')} | ${c.horainicio} - ${c.horafin}</span>
                            <button class="btn-delete-mobile" onclick="deleteClase('${c.id}')"><i class="ri-delete-bin-line"></i></button>
                        </div>
                    </div>
                `;
            });
            card.innerHTML = html;
            container.appendChild(card);
        }
        logVisual("Cursos renderizados exitosamente.");
    };

    window.deleteClase = async (id) => {
        logVisual(`Intentando eliminar clase con ID: ${id}`);
        if(confirm('¿Eliminar curso?')){
            const res = await callBackend('deleteClase', 'POST', { id: id });
            if (res.status === 'success') {
                logVisual("Clase eliminada con éxito, refrescando datos...");
                await refreshData();
            } else {
                logVisual(`ERROR: Falló al eliminar clase: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
                alert('Error al eliminar: ' + res.message);
            }
        }
    };

    window.updateClasesSelect = () => {
        const s = document.getElementById('a_claseId');
        if (!s) { logVisual("WARN: Select de clases de alumno no encontrado.", 'warn'); return; }
        s.innerHTML = '<option value="">-- Elige Curso --</option>';
        if (clases.length === 0) { logVisual("No hay clases para el selector de alumnos."); return; }
        clases.forEach(c => {
            s.innerHTML += `<option value="${c.id}">${c.nombre} (${c.horainicio} con ${c.profesor})</option>`;
        });
        logVisual(`Selector de clases de alumno actualizado con ${clases.length} opciones.`);
    };

    const alumnoForm = document.getElementById('alumnoForm');
    if (alumnoForm) {
        alumnoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            logVisual("Formulario de alumno enviado.");
            const nuevoAlumno = {
                id: 'A-' + Date.now(),
                nombre: document.getElementById('a_nombre').value,
                dni: document.getElementById('a_dni').value,
                cuotaEstado: document.getElementById('a_cuota').value,
                claseId: document.getElementById('a_claseId').value,
                asistencias: 0
            };
            logVisual(`Datos de nuevo alumno: ${JSON.stringify(nuevoAlumno)}`);

            const res = await callBackend('addAlumno', 'POST', nuevoAlumno);
            if (res.status === 'success') {
                logVisual("Alumno inscrito con éxito, refrescando datos...");
                await refreshData();
                e.target.reset();
            } else {
                logVisual(`ERROR: Falló al inscribir alumno: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
                alert('Error al inscribir: ' + res.message);
            }
        });
    }

    window.renderAlumnos = (filtro = 'todos') => {
        const table = document.getElementById('alumnosTable');
        if (!table) { logVisual("WARN: Tabla de alumnos no encontrada.", 'warn'); return; }
        table.innerHTML = '';
        let list = filtro === 'deudores' ? alumnos.filter(a => a.cuotaestado === 'debe') : alumnos;
        logVisual(`Renderizando ${list.length} alumnos (Filtro: ${filtro}).`);
        
        if (list.length === 0) {
            // Podrías añadir un mensaje de "no hay alumnos" en la tabla
            logVisual("No hay alumnos para renderizar.");
        }

        list.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${a.nombre}</strong><br><small>${a.dni}</small></td>
                <td>
                    <div class="asistencia-box">
                        <button class="btn-plus" onclick="addAsis('${a.id}')">+</button>
                        <span>${a.asistencias}</span>
                    </div>
                </td>
                <td><span class="badge-mobile ${a.cuotaestado}" onclick="toggleCuota('${a.id}')">${(a.cuotaestado || "").toUpperCase()}</span></td>
                <td><button class="btn-delete-mobile" onclick="delAlu('${a.id}')"><i class="ri-delete-bin-line"></i></button></td>
            `;
            table.appendChild(tr);
        });
        logVisual("Alumnos renderizados exitosamente.");
    };

    window.addAsis = async (id) => { 
        logVisual(`Añadiendo asistencia a alumno con ID: ${id}`);
        const res = await callBackend('addAsistencia', 'POST', { id: id });
        if (res.status === 'success') {
            logVisual("Asistencia añadida con éxito, refrescando datos...");
            await refreshData();
        } else {
            logVisual(`ERROR: Falló al añadir asistencia: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
        }
    };

    window.toggleCuota = async (id) => { 
        logVisual(`Cambiando estado de cuota para alumno con ID: ${id}`);
        const res = await callBackend('toggleCuota', 'POST', { id: id });
        if (res.status === 'success') {
            logVisual("Estado de cuota cambiado con éxito, refrescando datos...");
            await refreshData();
        } else {
            logVisual(`ERROR: Falló al cambiar cuota: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
        }
    };

    window.delAlu = async (id) => { 
        logVisual(`Intentando eliminar alumno con ID: ${id}`);
        if(confirm('¿Borrar alumno?')){
            const res = await callBackend('deleteAlumno', 'POST', { id: id });
            if (res.status === 'success') {
                logVisual("Alumno eliminado con éxito, refrescando datos...");
                await refreshData();
            } else {
                logVisual(`ERROR: Falló al eliminar alumno: ${res.message}. Raw: ${JSON.stringify(res)}`, 'error');
                alert('Error al eliminar alumno: ' + res.message);
            }
        }
    };
});
