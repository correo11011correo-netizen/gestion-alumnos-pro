document.addEventListener('DOMContentLoaded', () => {
    const alumnoForm = document.getElementById('alumnoForm');
    const alumnosTable = document.getElementById('alumnosTable');
    const searchInput = document.getElementById('search');

    // Inicializar DB local
    let alumnos = JSON.parse(localStorage.getItem('alumnos_pro')) || [];

    const saveToLocal = () => {
        localStorage.setItem('alumnos_pro', JSON.stringify(alumnos));
        renderAlumnos();
    };

    const renderAlumnos = (filtered = null) => {
        const data = filtered || alumnos;
        alumnosTable.innerHTML = '';

        if (data.length === 0) {
            alumnosTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">No hay alumnos registrados</td></tr>';
            return;
        }

        data.forEach((alumno, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${alumno.dni}</td>
                <td><strong>${alumno.nombre}</strong></td>
                <td><span class="badge">${alumno.curso}</span></td>
                <td class="actions">
                    <button class="btn-icon" onclick="editAlumno('${alumno.dni}')">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteAlumno('${alumno.dni}')">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </td>
            `;
            alumnosTable.appendChild(tr);
        });
    };

    alumnoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nuevoAlumno = {
            nombre: document.getElementById('nombre').value,
            dni: document.getElementById('dni').value,
            curso: document.getElementById('curso').value,
            id: Date.now()
        };

        // Evitar duplicados por DNI
        if (alumnos.some(a => a.dni === nuevoAlumno.dni)) {
            alert('El alumno con este DNI ya existe.');
            return;
        }

        alumnos.push(nuevoAlumno);
        saveToLocal();
        alumnoForm.reset();
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = alumnos.filter(a => 
            a.nombre.toLowerCase().includes(term) || 
            a.dni.includes(term) ||
            a.curso.toLowerCase().includes(term)
        );
        renderAlumnos(filtered);
    });

    // Funciones globales para botones de acción
    window.deleteAlumno = (dni) => {
        if (confirm('¿Eliminar este alumno?')) {
            alumnos = alumnos.filter(a => a.dni !== dni);
            saveToLocal();
        }
    };

    window.editAlumno = (dni) => {
        const alumno = alumnos.find(a => a.dni === dni);
        if (alumno) {
            document.getElementById('nombre').value = alumno.nombre;
            document.getElementById('dni').value = alumno.dni;
            document.getElementById('curso').value = alumno.curso;
            // Eliminar temporalmente para "actualizar" al guardar
            alumnos = alumnos.filter(a => a.dni !== dni);
            renderAlumnos();
        }
    };

    renderAlumnos();
});
