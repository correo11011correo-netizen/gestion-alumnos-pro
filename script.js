document.addEventListener('DOMContentLoaded', () => {
    let clases = JSON.parse(localStorage.getItem('insti_clases')) || [];
    let alumnos = JSON.parse(localStorage.getItem('insti_alumnos')) || [];

    const cursoForm = document.getElementById('cursoForm');
    const selectHora = document.getElementById('c_horaInicio');
    const statusMsg = document.getElementById('availability-badge');

    // --- GENERAR SELECTOR DE HORAS (08:00 a 21:00 cada 30 min) ---
    const generateHours = () => {
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
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        event.currentTarget.classList.add('active');
        if (tabName === 'alumnos') updateClasesSelect();
    };

    // --- LOGICA DE CRUCE Y DISPONIBILIDAD ---
    const checkCruces = () => {
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
            
            const compartenDia = dias.some(d => clase.dias.includes(d));
            if (compartenDia) {
                const [chI, cmI] = clase.horaInicio.split(':').map(Number);
                const [chF, cmF] = clase.horaFin.split(':').map(Number);
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

    // Escuchar cambios para validar en tiempo real
    [selectHora, document.getElementById('c_duracion'), document.getElementById('c_modalidad')].forEach(el => {
        el.addEventListener('change', checkCruces);
    });
    document.querySelectorAll('.c_dias').forEach(el => el.addEventListener('change', checkCruces));

    cursoForm.addEventListener('submit', (e) => {
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
            tipo: 'Personalizado', // Simplificado
            dias: Array.from(document.querySelectorAll('.c_dias:checked')).map(cb => cb.value),
            horaInicio: hInicio,
            horaFin: horaFin,
            duracion: duracion
        };

        clases.push(nuevaClase);
        saveDB();
        cursoForm.reset();
        checkCruces();
    });

    const renderCursos = () => {
        const container = document.getElementById('cursosContainer');
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
                            <span><i class="ri-calendar-line"></i> ${c.dias.join(',')} | ${c.horaInicio} - ${c.horaFin}</span>
                            <button class="btn-delete-mobile" onclick="deleteClase('${c.id}')"><i class="ri-delete-bin-line"></i></button>
                        </div>
                    </div>
                `;
            });
            card.innerHTML = html;
            container.appendChild(card);
        }
    };

    window.deleteClase = (id) => {
        if(confirm('¿Eliminar curso?')){
            clases = clases.filter(c => c.id !== id);
            alumnos = alumnos.filter(a => a.claseId !== id);
            saveDB();
        }
    };

    // --- ALUMNOS ---
    const updateClasesSelect = () => {
        const s = document.getElementById('a_claseId');
        s.innerHTML = '<option value="">-- Elige Curso --</option>';
        clases.forEach(c => {
            s.innerHTML += `<option value="${c.id}">${c.nombre} (${c.horaInicio} con ${c.profesor})</option>`;
        });
    };

    document.getElementById('alumnoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        alumnos.push({
            id: 'A-' + Date.now(),
            nombre: document.getElementById('a_nombre').value,
            dni: document.getElementById('a_dni').value,
            cuotaEstado: document.getElementById('a_cuota').value,
            claseId: document.getElementById('a_claseId').value,
            asistencias: 0
        });
        saveDB();
        e.target.reset();
    });

    window.renderAlumnos = (filtro = 'todos') => {
        const table = document.getElementById('alumnosTable');
        table.innerHTML = '';
        let list = filtro === 'deudores' ? alumnos.filter(a => a.cuotaEstado === 'debe') : alumnos;
        
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
                <td><span class="badge-mobile ${a.cuotaEstado}" onclick="toggleCuota('${a.id}')">${a.cuotaEstado.toUpperCase()}</span></td>
                <td><button class="btn-delete-mobile" onclick="delAlu('${a.id}')"><i class="ri-delete-bin-line"></i></button></td>
            `;
            table.appendChild(tr);
        });
    };

    window.addAsis = (id) => { const x = alumnos.find(i=>i.id===id); if(x){x.asistencias++; saveDB();} };
    window.toggleCuota = (id) => { const x = alumnos.find(i=>i.id===id); if(x){x.cuotaEstado = x.cuotaEstado==='aldia'?'debe':'aldia'; saveDB();} };
    window.delAlu = (id) => { if(confirm('¿Borrar?')){alumnos=alumnos.filter(i=>i.id!==id); saveDB();} };

    const saveDB = () => {
        localStorage.setItem('insti_clases', JSON.stringify(clases));
        localStorage.setItem('insti_alumnos', JSON.stringify(alumnos));
        renderCursos();
        renderAlumnos();
    };

    renderCursos();
    renderAlumnos();
});
