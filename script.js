document.addEventListener('DOMContentLoaded', () => {
    // ESTADO LOCAL (DB)
    let clases = JSON.parse(localStorage.getItem('insti_clases')) || [];
    let alumnos = JSON.parse(localStorage.getItem('insti_alumnos')) || [];

    // TABS LOGIC
    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.currentTarget.classList.add('active');
        if (tabName === 'alumnos') updateClasesSelect();
    };

    // --- LÓGICA DE CURSOS / LOCAL ---
    const cursoForm = document.getElementById('cursoForm');
    const cursosContainer = document.getElementById('cursosContainer');

    const isLocalOccupied = (diasSeleccionados, inicio, fin) => {
        // Simple validación de cruce de horarios para cursos presenciales
        const numInicio = parseInt(inicio.replace(':',''));
        const numFin = parseInt(fin.replace(':',''));
        
        for (let clase of clases) {
            if (clase.modalidad === 'Virtual') continue;
            
            // Check si comparten días
            const compartenDia = diasSeleccionados.some(d => clase.dias.includes(d));
            if (compartenDia) {
                const numCInicio = parseInt(clase.horaInicio.replace(':',''));
                const numCFin = parseInt(clase.horaFin.replace(':',''));
                
                // Lógica de superposición de tiempos
                if ((numInicio >= numCInicio && numInicio < numCFin) || 
                    (numFin > numCInicio && numFin <= numCFin) ||
                    (numInicio <= numCInicio && numFin >= numCFin)) {
                    return `El local ya está ocupado por "${clase.nombre}" (${clase.profesor}) esos días de ${clase.horaInicio} a ${clase.horaFin}`;
                }
            }
        }
        return false;
    };

    cursoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const diasElegidos = Array.from(document.querySelectorAll('.c_dias:checked')).map(cb => cb.value);
        if (diasElegidos.length === 0) return alert('Debes seleccionar al menos un día.');

        const modalidad = document.getElementById('c_modalidad').value;
        const hInicio = document.getElementById('c_horaInicio').value;
        const hFin = document.getElementById('c_horaFin').value;

        if (modalidad === 'Presencial') {
            const ocupadoMsg = isLocalOccupied(diasElegidos, hInicio, hFin);
            if (ocupadoMsg) return alert(`🚨 ERROR DE LOCAL:\n${ocupadoMsg}`);
        }

        const nuevaClase = {
            id: 'C-' + Date.now(),
            nombre: document.getElementById('c_nombre').value,
            profesor: document.getElementById('c_profesor').value,
            modalidad: modalidad,
            tipo: document.getElementById('c_tipo').value,
            dias: diasElegidos,
            horaInicio: hInicio,
            horaFin: hFin
        };

        clases.push(nuevaClase);
        saveDB();
        cursoForm.reset();
    });

    const renderCursos = () => {
        cursosContainer.innerHTML = '';
        if (clases.length === 0) {
            cursosContainer.innerHTML = '<p style="color:#64748b;">No hay cursos configurados. El local está libre.</p>';
            return;
        }

        // Agrupar por profesor
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
                const modClass = c.modalidad === 'Virtual' ? 'virtual' : '';
                html += `
                    <div class="curso-item ${modClass}">
                        <div class="curso-title">
                            <span>${c.nombre} (${c.tipo})</span>
                            <span class="badge ${c.modalidad.toLowerCase()}">${c.modalidad}</span>
                        </div>
                        <div class="curso-details">
                            <i class="ri-calendar-event-line"></i> ${c.dias.join(', ')} | <i class="ri-time-line"></i> ${c.horaInicio} a ${c.horaFin}
                            <button class="btn-icon delete" style="float:right; font-size:1rem;" onclick="deleteClase('${c.id}')"><i class="ri-delete-bin-line"></i></button>
                        </div>
                    </div>
                `;
            });
            card.innerHTML = html;
            cursosContainer.appendChild(card);
        }
    };

    window.deleteClase = (id) => {
        if(confirm('¿Eliminar curso? Se borrarán las inscripciones asociadas a este horario.')){
            clases = clases.filter(c => c.id !== id);
            alumnos = alumnos.filter(a => a.claseId !== id);
            saveDB();
        }
    };

    // --- LÓGICA DE ALUMNOS ---
    const alumnoForm = document.getElementById('alumnoForm');
    const selectClase = document.getElementById('a_claseId');
    const alumnosTable = document.getElementById('alumnosTable');

    const updateClasesSelect = () => {
        selectClase.innerHTML = '<option value="">-- Elige un Curso Activo --</option>';
        clases.forEach(c => {
            selectClase.innerHTML += `<option value="${c.id}">${c.nombre} con Prof. ${c.profesor} (${c.modalidad})</option>`;
        });
    };

    alumnoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dni = document.getElementById('a_dni').value;
        const claseId = document.getElementById('a_claseId').value;
        
        if(!claseId) return alert('Debes seleccionar un curso.');

        if (alumnos.some(a => a.dni === dni && a.claseId === claseId)) {
            return alert('El alumno ya está inscripto en esta clase exacta.');
        }

        const nuevoAlumno = {
            id: 'A-' + Date.now(),
            nombre: document.getElementById('a_nombre').value,
            dni: dni,
            cuotaEstado: document.getElementById('a_cuota').value,
            claseId: claseId,
            asistencias: 0
        };

        alumnos.push(nuevoAlumno);
        saveDB();
        alumnoForm.reset();
    });

    window.renderAlumnos = (filtro = 'todos') => {
        alumnosTable.innerHTML = '';
        let filtrados = alumnos;
        if (filtro === 'deudores') filtrados = alumnos.filter(a => a.cuotaEstado === 'debe');

        if(filtrados.length === 0){
            alumnosTable.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No hay registros</td></tr>';
            return;
        }

        filtrados.forEach(a => {
            const claseInfo = clases.find(c => c.id === a.claseId) || {nombre: 'Clase Eliminada', profesor: 'N/A', modalidad: ''};
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.dni}</td>
                <td><strong>${a.nombre}</strong></td>
                <td>${claseInfo.nombre}<br><small style="color:#94a3b8">Prof. ${claseInfo.profesor}</small></td>
                <td>
                    <button class="btn-icon add" onclick="addAsistencia('${a.id}')"><i class="ri-add-circle-line"></i></button> 
                    <strong>${a.asistencias}</strong> clases
                </td>
                <td>
                    <span class="badge ${a.cuotaEstado}" onclick="toggleCuota('${a.id}')" style="cursor:pointer">
                        ${a.cuotaEstado === 'aldia' ? 'Al Día' : 'DEBE CUOTA'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon delete" onclick="deleteAlumno('${a.id}')"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            alumnosTable.appendChild(tr);
        });
    };

    window.addAsistencia = (id) => {
        const a = alumnos.find(x => x.id === id);
        if(a) { a.asistencias++; saveDB(); }
    };

    window.toggleCuota = (id) => {
        const a = alumnos.find(x => x.id === id);
        if(a) { 
            a.cuotaEstado = a.cuotaEstado === 'aldia' ? 'debe' : 'aldia'; 
            saveDB(); 
        }
    };

    window.deleteAlumno = (id) => {
        if(confirm('¿Dar de baja a este alumno?')){
            alumnos = alumnos.filter(a => a.id !== id);
            saveDB();
        }
    };

    const saveDB = () => {
        localStorage.setItem('insti_clases', JSON.stringify(clases));
        localStorage.setItem('insti_alumnos', JSON.stringify(alumnos));
        renderCursos();
        renderAlumnos();
    };

    // INIT
    renderCursos();
    renderAlumnos();
});
