const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Inicializar aplicación Express
const app = express();
const server = http.createServer(app);

// Inicializar servidor WebSocket
const wss = new WebSocket.Server({ 
    server,
    // Configuración para mantener conexiones vivas
    perMessageDeflate: {
        zlibDeflateOptions: {
            // Ver documentación de zlib para opciones de compresión
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        // Umbral de compresión: no comprimir mensajes pequeños
        threshold: 1024
    }
});

// Configuración para almacenamiento de alertas
const CONFIG = {
    MAX_ALERTAS: 100,
    UMBRAL_MINIMO_CONFIANZA: 0.3,
    TIEMPO_CONEXION_PERDIDA: 90000,  // 90 segundos (antes 60)
    TIEMPO_PING: 30000,              // 30 segundos (mantener)
    RUTA_LOGS: path.join(__dirname, 'logs'),
    GUARDAR_LOGS: true
};

// Crear carpeta de logs si no existe
if (CONFIG.GUARDAR_LOGS && !fs.existsSync(CONFIG.RUTA_LOGS)) {
    fs.mkdirSync(CONFIG.RUTA_LOGS, { recursive: true });
}

// Almacenar todas las alertas recibidas
const alertas = [];

// Almacenar todas las conexiones activas de clientes
const clientes = new Map(); // Usar Map para almacenar metadata adicional

// Registro de actividad del servidor
function log(mensaje, tipo = 'info') {
    const timestamp = new Date().toISOString();
    const tipoFormateado = tipo.toUpperCase().padEnd(8);
    const logEntry = `[${timestamp}] [${tipoFormateado}] ${mensaje}`;
    
    console.log(logEntry);
    
    if (CONFIG.GUARDAR_LOGS) {
        const fecha = new Date().toISOString().split('T')[0];
        const nombreArchivo = path.join(CONFIG.RUTA_LOGS, `server-${fecha}.log`);
        
        fs.appendFile(nombreArchivo, logEntry + '\n', (err) => {
            if (err) console.error(`Error al escribir log: ${err.message}`);
        });
    }
}

// Función para deduplicar alertas similares
function alertaEsDuplicada(nueva, tiempoMaximo = 5) {
    if (alertas.length === 0) return false;
    
    // Buscar alertas similares (mismo tipo y confianza similar) en los últimos segundos
    const ahora = new Date();
    
    for (let i = alertas.length - 1; i >= 0; i--) {
        const alerta = alertas[i];
        
        // Si la alerta es muy antigua, no seguir buscando
        const diferenciaTiempo = (ahora - new Date(`${alerta.fecha}T${alerta.hora}`)) / 1000;
        if (diferenciaTiempo > tiempoMaximo) break;
        
        // Comprobar si son alertas similares
        if (alerta.tipo === nueva.tipo) {
            // Comprobar si la ubicación es similar (si hay información)
            if (alerta.ubicacion && nueva.ubicacion) {
                // Si son la misma ubicación, es duplicado
                if (typeof alerta.ubicacion === 'string' && typeof nueva.ubicacion === 'string') {
                    if (alerta.ubicacion === nueva.ubicacion) return true;
                } else if (alerta.ubicacion.latitude && nueva.ubicacion.latitude) {
                    // Si son coordenadas cercanas (menos de 10 metros), es duplicado
                    const distancia = calcularDistancia(
                        alerta.ubicacion.latitude, alerta.ubicacion.longitude,
                        nueva.ubicacion.latitude, nueva.ubicacion.longitude
                    );
                    if (distancia < 10) return true;
                }
            } else {
                // Si no hay ubicación, comprobar por tiempo y confianza
                if (Math.abs(alerta.confianza - nueva.confianza) < 0.1) return true;
            }
        }
    }
    
    return false;
}

// Función para calcular distancia entre coordenadas
function calcularDistancia(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999; // Valor grande si faltan datos
    
    // Fórmula de Haversine
    const R = 6371e3; // Radio de la tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
}

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    const id = Date.now() + Math.random().toString(36).substring(2, 15);
    
    // Almacenar información del cliente
    clientes.set(ws, {
        id,
        ip,
        conectado: true,
        ultimoMensaje: Date.now(),
        tipo: 'desconocido', // 'app' o 'python'
    });
    
    log(`Cliente conectado desde ${ip}, asignado ID: ${id}`);
    log(`Total de clientes conectados: ${clientes.size}`);
    
    // Enviar confirmación de conexión
    ws.send(JSON.stringify({
        tipo: 'conexion',
        estado: 'conectado',
        id,
        mensaje: 'Conectado al servidor DracAI'
    }));
    
    // Enviar el historial de alertas al nuevo cliente
    if (alertas.length > 0) {
        const alertasRecientes = alertas.slice(-20); // Enviar solo las 20 más recientes
        log(`Enviando historial de ${alertasRecientes.length} alertas al cliente ${id}`);
        ws.send(JSON.stringify({
            tipo: 'historial',
            alertas: alertasRecientes
        }));
    }
    
    // Escuchar mensajes del cliente
    ws.on('message', (mensaje) => {
        try {
            const data = JSON.parse(mensaje);
            const clienteInfo = clientes.get(ws);
            clienteInfo.ultimoMensaje = Date.now();
            
            // Identificar tipo de cliente
            if (data.tipo === 'identificacion') {
                clienteInfo.tipo = data.cliente || 'desconocido';
                log(`Cliente ${id} identificado como: ${clienteInfo.tipo}`);
                return;
            }
            
            // Si es una alerta desde Python (debe tener los campos específicos)
            if (data.confianza !== undefined && data.fecha && data.hora) {
                // Ignorar alertas con confianza muy baja
                if (data.confianza < CONFIG.UMBRAL_MINIMO_CONFIANZA) {
                    log(`Alerta ignorada por baja confianza: ${data.confianza}`, 'debug');
                    return;
                }
                
                // Verificar si es una alerta duplicada
                if (alertaEsDuplicada(data)) {
                    log(`Alerta duplicada detectada y filtrada: ${data.tipo} (${data.confianza})`, 'debug');
                    return;
                }
                
                // Asignar un ID único a la alerta
                data.id = `alerta-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                
                // Añadir la alerta al historial
                alertas.push(data);
                if (data.ubicacion) {
                    if (typeof data.ubicacion === 'string') {
                        log(`Nueva alerta recibida - Tipo: ${data.tipo}, Confianza: ${data.confianza}, Ubicación: ${data.ubicacion}`);
                    } else if (data.ubicacion.latitude && data.ubicacion.longitude) {
                        const dir = data.ubicacion.direccion || 'Ubicación sin dirección';
                        log(`Nueva alerta recibida - Tipo: ${data.tipo}, Confianza: ${data.confianza.toFixed(2)}, Ubicación: ${dir} (${data.ubicacion.latitude}, ${data.ubicacion.longitude})`);
                    } else {
                        log(`Nueva alerta recibida - Tipo: ${data.tipo}, Confianza: ${data.confianza}, Ubicación: Datos incompletos`);
                    }
                } else {
                    log(`Nueva alerta recibida - Tipo: ${data.tipo}, Confianza: ${data.confianza}, Ubicación: No especificada`);
                }
                
                // Limitar el historial
                if (alertas.length > CONFIG.MAX_ALERTAS) {
                    alertas.shift();
                    log('Historial limitado a 100 alertas');
                }
                
                // Reenviar la alerta a todos los clientes conectados
                broadcastAlerta(data);
            }
        } catch (error) {
            log(`Error al procesar mensaje: ${error.message}`, 'error');
        }
    });
    
    // Comprobar la conexión periódicamente mediante pings
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
        const clienteInfo = clientes.get(ws);
        if (clienteInfo) {
            clienteInfo.ultimoMensaje = Date.now();
        }
    });
    
    // Manejar desconexión
    ws.on('close', () => {
        const clienteInfo = clientes.get(ws);
        const clienteId = clienteInfo ? clienteInfo.id : 'desconocido';
        const clienteTipo = clienteInfo ? clienteInfo.tipo : 'desconocido';
        
        log(`Cliente desconectado - ID: ${clienteId}, Tipo: ${clienteTipo}`);
        clientes.delete(ws);
        log(`Total de clientes restantes: ${clientes.size}`);
    });
    
    // Manejar errores
    ws.on('error', (error) => {
        log(`Error de WebSocket: ${error.message}`, 'error');
    });
});

// Verificar conexiones activas cada cierto tiempo
const intervalPing = setInterval(() => {
    const ahora = Date.now();
    
    wss.clients.forEach((ws) => {
        const clienteInfo = clientes.get(ws);
        
        if (!clienteInfo) {
            // Cliente sin información, cerrar
            return ws.terminate();
        }
        
        // Verificar tiempo desde el último mensaje
        const tiempoInactivo = ahora - clienteInfo.ultimoMensaje;
        
        if (tiempoInactivo > CONFIG.TIEMPO_CONEXION_PERDIDA) {
            log(`Cliente ${clienteInfo.id} (${clienteInfo.tipo}) inactivo por ${Math.round(tiempoInactivo/1000)}s - Desconectando`);
            clientes.delete(ws);
            return ws.terminate();
        }
        
        if (ws.isAlive === false) {
            log(`Cliente ${clienteInfo.id} no respondió al ping - Desconectando`);
            clientes.delete(ws);
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping(() => {});  // Esto envía el ping
    });
}, CONFIG.TIEMPO_PING);


// Limpiar el intervalo cuando el servidor se cierre
wss.on('close', () => {
    clearInterval(intervalPing);
    log('Servidor WebSocket cerrado', 'importante');
});

// Función para enviar una alerta a todos los clientes conectados
function broadcastAlerta(alerta) {
    let clientesApp = 0;
    let clientesPython = 0;
    let clientesActivos = 0;
    
    // Nuevo log para mostrar el tipo de alerta
    const ubicacionStr = alerta.ubicacion ? 
    (typeof alerta.ubicacion === 'string' ? 
        alerta.ubicacion : 
        `${alerta.ubicacion.direccion || 'Sin dirección'} (${alerta.ubicacion.latitude}, ${alerta.ubicacion.longitude})`
    ) : 'Ubicación no especificada';

    log(`Procesando alerta - Tipo: ${alerta.tipo}, Confianza: ${alerta.confianza.toFixed(2)}, Ubicación: ${ubicacionStr}`, 'alerta');
    
    clientes.forEach((info, cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            clientesActivos++;
            
            // Contar por tipo
            if (info.tipo === 'app') clientesApp++;
            if (info.tipo === 'python') clientesPython++;
            
            // Enviar alerta
            cliente.send(JSON.stringify({
                tipo: 'nueva_alerta',
                alerta: alerta
            }));
        }
    });
    
    log(`Alerta enviada a ${clientesActivos} clientes (${clientesApp} apps, ${clientesPython} detectores)`);
}

// Middleware para procesar JSON y datos de formulario
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos si existe la carpeta 'public'
const rutaPublic = path.join(__dirname, 'public');
if (fs.existsSync(rutaPublic)) {
    app.use(express.static(rutaPublic));
    log('Servicio de archivos estáticos activado');
}

// Ruta básica para verificar que el servidor esté funcionando
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>DracAI - Servidor WebSocket</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { color: #3b82f6; }
                .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
                .online { background-color: #dcfce7; color: #166534; }
                .info { background-color: #e0f2fe; color: #0c4a6e; }
            </style>
        </head>
        <body>
            <h1>DracAI - Servidor WebSocket</h1>
            <div class="status online">
                <strong>Estado:</strong> En funcionamiento
            </div>
            <div class="status info">
                <strong>Clientes conectados:</strong> ${clientes.size}<br>
                <strong>Alertas almacenadas:</strong> ${alertas.length}
            </div>
            <p>Este servidor gestiona las conexiones entre el sistema de detección y las aplicaciones cliente.</p>
            <p>Para más información, consulte la documentación del proyecto DracAI.</p>
        </body>
        </html>
    `);
});

// Ruta para obtener todas las alertas (acceso HTTP para pruebas)
app.get('/alertas', (req, res) => {
    res.json(alertas);
});

// Ruta para ver estadísticas del servidor
app.get('/stats', (req, res) => {
    // Contar clientes por tipo
    let clientesApp = 0;
    let clientesPython = 0;
    let clientesDesconocidos = 0;
    
    clientes.forEach((info) => {
        if (info.tipo === 'app') clientesApp++;
        else if (info.tipo === 'python') clientesPython++;
        else clientesDesconocidos++;
    });
    
    const stats = {
        estado: 'online',
        tiempo_actividad: process.uptime(),
        clientes: {
            total: clientes.size,
            app: clientesApp,
            python: clientesPython,
            desconocidos: clientesDesconocidos
        },
        alertas: {
            total: alertas.length,
            ultima: alertas.length > 0 ? alertas[alertas.length - 1] : null
        },
        memoria: process.memoryUsage()
    };
    
    res.json(stats);
});

// Puerto del servidor
const PORT = process.env.PORT || 8080;

// Iniciar el servidor
server.listen(PORT, () => {
    log(`Servidor WebSocket iniciado en puerto ${PORT}`, 'importante');
});

// Manejar cierre de servidor
process.on('SIGINT', () => {
    log('Recibida señal de terminación, cerrando servidor...', 'importante');
    
    // Cerrar conexiones WebSocket
    wss.clients.forEach((client) => {
        client.terminate();
    });
    
    // Cerrar servidor HTTP
    server.close(() => {
        log('Servidor HTTP cerrado', 'importante');
        process.exit(0);
    });
    
    // Forzar cierre después de 5 segundos
    setTimeout(() => {
        log('Forzando cierre del servidor', 'importante');
        process.exit(1);
    }, 5000);
});