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
            const logText = Array.from(debugLogElement.children).map(div => div.innerText).join('
'); // Obtener todo el texto visible
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

// Bandera para asegurar que gapi se inicializa una vez
let gapiInitialized = false;

// Función llamada cuando platform.js ha terminado de cargar
window.googleApiLoaded = function() {
    logVisual("Librería Google Platform.js cargada con éxito. Iniciando gapi.client...");
    if (!gapiInitialized) {
        gapi.load('client:auth2', initGapiClient);
        gapiInitialized = true;
    }
};

// Inicializa la API de Google Client
function initGapiClient() {
    logVisual("gapi.client:auth2 cargado. Iniciando gapi.auth2...");
    gapi.auth2.init({
        client_id: '462599480572-6cnminb9tv7se0qovc14hn2ljbufqf0h.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.deployments https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/script.external_request openid'
    }).then(function() {
        logVisual("gapi.auth2.init completado. Escuchando estado de sesión...");
        // Escuchar cambios de estado de sesión
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInStatus);
        updateSignInStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    }, function(error) {
        logVisual(`ERROR en gapi.auth2.init: ${JSON.stringify(error)}`, 'error');
        // Fallback si la inicialización falla
        showFallbackUI("Error al iniciar sesión de Google. Por favor, verifica tu conexión y la configuración de la aplicación.");
    });
}

function updateSignInStatus(isSignedIn) {
    logVisual(`Estado de sesión de Google: ${isSignedIn}`);
    const signinBtnContainer = document.querySelector('.g-signin2');
    const signoutBtn = document.getElementById('signout-btn');
    const mainNav = document.getElementById('main-nav');
    const appContent = document.getElementById('app-content');

    if (isSignedIn) {
        const googleUser = gapi.auth2.getAuthInstance().currentUser.get();
        window.onSignIn(googleUser); // Llama a la función onSignIn existente
    } else {
        userToken = null;
        if (signinBtnContainer) signinBtnContainer.style.display = 'block';
        if (signoutBtn) signoutBtn.style.display = 'none';
        if (mainNav) mainNav.style.display = 'none';
        if (appContent) appContent.style.display = 'none';
        logVisual("Interfaz de usuario restablecida para no autenticado.");
    }
}

// Exponer funciones al ámbito global para que Google Sign-In pueda verlas (y para el DOM)
window.onSignIn = function(googleUser) {
    logVisual("Evento onSignIn (global) disparado.");
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
        logVisual(`ERROR crítico en onSignIn (global): ${error.message}. Stack: ${error.stack}`, 'error');
    }
};

window.signOut = function() {
    logVisual("Cerrando sesión...");
    try {
        var auth2 = gapi.auth2.getAuthInstance();
        if (auth2) {
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
        } else { logVisual("WARN: gapi.auth2.getAuthInstance() no disponible para signOut.", 'warn'); }
    } catch (error) {
        logVisual(`ERROR en signOut: ${error.message}. Stack: ${error.stack}`, 'error');
    }
};

// --- Fallback UI para errores de inicialización ---
function showFallbackUI(message) {
    logVisual(`Mostrando Fallback UI: ${message}`, 'error');
    const authContainer = document.getElementById('auth-container');
    const appContent = document.getElementById('app-content');
    if (authContainer) {
        authContainer.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red;">${message}</div>`;
        authContainer.style.display = 'block';
    }
    if (appContent) appContent.style.display = 'none';
    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'none';
}

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
        logVisual(`Body POST: ${options.body.substring(0, 200)}...`);
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
    logVisual("DOM completamente cargado. Preparando inicialización de Google API...");
    // Llama a initGoogleApi solo si la librería de Google aún no ha cargado
    // Esto es un parche si el onload de platform.js no se dispara
    setTimeout(() => {
        if (typeof gapi === 'undefined' || !gapiInitialized) {
            logVisual("WARN: gapi no detectado o no inicializado en 3s. Intentando fallback init.", 'warn');
            initGoogleApi(); // Forzar inicialización si onload no funcionó
        }
    }, 3000); // Dar 3 segundos para que platform.js cargue y dispare onload
});
