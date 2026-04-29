const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGCoVCwcpnaMepbx2ARELi_6wD76kGYw2FEgEox4hJmslIqgYY5gnOGaWe9LK5lsm3Lg/exec';
let userToken = null;
let clases = [];
let alumnos = [];

console.log("Script.js cargado correctamente.");

// Exponer funciones al ámbito global para que Google Sign-In pueda verlas
window.onSignIn = function(googleUser) {
    console.log("Evento onSignIn disparado.");
    try {
        const profile = googleUser.getBasicProfile();
        console.log('Usuario autenticado:', profile.getName(), profile.getEmail());

        userToken = googleUser.getAuthResponse().id_token;
        console.log("ID Token obtenido.");

        // UI Updates - Asegurar que los elementos existen antes de manipularlos
        const authContainer = document.querySelector('.g-signin2');
        const signoutBtn = document.getElementById('signout-btn');
        const mainNav = document.getElementById('main-nav');
        const appContent = document.getElementById('app-content');

        if (authContainer) authContainer.style.display = 'none';
        if (signoutBtn) signoutBtn.style.display = 'block';
        if (mainNav) mainNav.style.display = 'flex';
        if (appContent) {
            appContent.style.display = 'flex';
            appContent.classList.add('active'); // Por si hay CSS que dependa de esto
        }

        console.log("Interfaz de usuario actualizada post-login.");
        initApp();
    } catch (error) {
        console.error("Error en onSignIn:", error);
    }
};

window.signOut = function() {
    console.log("Cerrando sesión...");
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('Sesión cerrada exitosamente.');
        userToken = null;
        
        document.querySelector('.g-signin2').style.display = 'block';
        document.getElementById('signout-btn').style.display = 'none';
        document.getElementById('main-nav').style.display = 'none';
        document.getElementById('app-content').style.display = 'none';
    });
};

async function callBackend(action, method = 'GET', data = null) {
    console.log(`Llamando al backend: ${action} [${method}]`);
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        console.log(`Respuesta del backend (${action}):`, result);
        return result;
    } catch (error) {
        console.error(`Error en callBackend (${action}):`, error);
        return { status: 'error', message: error.toString() };
    }
}

async function initApp() {
    console.log("Inicializando aplicación y cargando datos...");
    await refreshData();
}

async function refreshData() {
    try {
        const resClases = await callBackend('getClases');
        if (resClases.status === 'success') {
            clases = resClases.data || [];
            renderCursos();
            updateClasesSelect();
        }

        const resAlumnos = await callBackend('getAlumnos');
        if (resAlumnos.status === 'success') {
            alumnos = resAlumnos.data || [];
            renderAlumnos();
        }
    } catch (error) {
        console.error("Error al refrescar datos:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado.");
    const cursoForm = document.getElementById('cursoForm');
    const selectHora = document.getElementById('c_horaInicio');
    const statusMsg = document.getElementById('availability-badge');

    // --- GENERAR SELECTOR DE HORAS ---
    const generateHours = () => {
        if (!selectHora) return;
        selectHora.innerHTML = '<option value="">-- Selecciona Hora --</option>';
        for (let h = 8; h <= 21; h++) {
            for (let m of ['00', '30']) {
                if (h === 21 && m === '30') continue;
                const time = `${h.toString().padStart(2, '0')}:${m}`;
                selectHora.innerHTML += `<option value="${time}">${time}</option>`;
            }
        }
    };
    generateHours();

    window.switchTab = (tabName) => {
        console.log(`Cambiando a pestaña: ${tabName}`);
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) targetTab.classList.add('active');

        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
            const attr = btn.getAttribute('onclick');
            return attr && attr.includes(tabName);
        });
        if (activeBtn) activeBtn.classList.add('active');
        
        if (tabName === 'alumnos') updateClasesSelect();
    };

    // --- LOGICA DE CRUCE Y DISPONIBILIDAD ---
    const checkCruces = () => {
        if (!selectHora || !statusMsg) return true;
        const hInicio = selectHora.value;
        const duracion = parseFloat(document.getElementById('c_duracion').value);
        const dias = Array.from(document.querySelectorAll('.c_dias:checked')).map(cb => cb.value);
        const modalidad = document.getElementById('c_modalidad').value;

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
                    return false;
                }
            }
        }
        statusMsg.innerText = `✅ DISPONIBLE (Termina ${Math.floor(totalMinFin/60)}:${(totalMinFin%60).toString().padStart(2,'0')})`;
        statusMsg.className = "status-msg success";
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

            const res = await callBackend('addClase', 'POST', nuevaClase);
            if (res.status === 'success') {
                await refreshData();
                cursoForm.reset();
                checkCruces();
            } else {
                alert('Error al guardar el curso: ' + res.message);
            }
        });
    }

    window.renderCursos = () => {
        const container = document.getElementById('cursosContainer');
        if (!container) return;
        container.innerHTML = '';
        if (clases.length === 0) {
            container.innerHTML = '<p class="empty-msg">No hay cursos programados.</p>';
            return;
        }

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
    };

    window.deleteClase = async (id) => {
        if(confirm('¿Eliminar curso?')){
            const res = await callBackend('deleteClase', 'POST', { id: id });
            if (res.status === 'success') {
                await refreshData();
            } else {
                alert('Error al eliminar: ' + res.message);
            }
        }
    };

    window.updateClasesSelect = () => {
        const s = document.getElementById('a_claseId');
        if (!s) return;
        s.innerHTML = '<option value="">-- Elige Curso --</option>';
        clases.forEach(c => {
            s.innerHTML += `<option value="${c.id}">${c.nombre} (${c.horainicio} con ${c.profesor})</option>`;
        });
    };

    const alumnoForm = document.getElementById('alumnoForm');
    if (alumnoForm) {
        alumnoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nuevoAlumno = {
                id: 'A-' + Date.now(),
                nombre: document.getElementById('a_nombre').value,
                dni: document.getElementById('a_dni').value,
                cuotaEstado: document.getElementById('a_cuota').value,
                claseId: document.getElementById('a_claseId').value,
                asistencias: 0
            };

            const res = await callBackend('addAlumno', 'POST', nuevoAlumno);
            if (res.status === 'success') {
                await refreshData();
                e.target.reset();
            } else {
                alert('Error al inscribir: ' + res.message);
            }
        });
    }

    window.renderAlumnos = (filtro = 'todos') => {
        const table = document.getElementById('alumnosTable');
        if (!table) return;
        table.innerHTML = '';
        let list = filtro === 'deudores' ? alumnos.filter(a => a.cuotaestado === 'debe') : alumnos;
        
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
    };

    window.addAsis = async (id) => { 
        const res = await callBackend('addAsistencia', 'POST', { id: id });
        if (res.status === 'success') await refreshData();
    };

    window.toggleCuota = async (id) => { 
        const res = await callBackend('toggleCuota', 'POST', { id: id });
        if (res.status === 'success') await refreshData();
    };

    window.delAlu = async (id) => { 
        if(confirm('¿Borrar?')){
            const res = await callBackend('deleteAlumno', 'POST', { id: id });
            if (res.status === 'success') await refreshData();
        }
    };
});
