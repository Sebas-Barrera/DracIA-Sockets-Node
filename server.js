const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Inicializar aplicación Express
const app = express();
const server = http.createServer(app);

// Inicializar servidor WebSocket
const wss = new WebSocket.Server({ server });

// Almacenar todas las alertas recibidas
const alertas = [];
// Almacenar todas las conexiones activas de clientes (apps) servidor-websocket
const clientes = [];

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
    console.log('Cliente conectado');
    
    // Añadir este cliente a la lista de conexiones
    clientes.push(ws);
    
    // Enviar el historial de alertas al nuevo cliente
    if (alertas.length > 0) {
        ws.send(JSON.stringify({
            tipo: 'historial',
            alertas: alertas
        }));
    }
    
    // Escuchar mensajes del cliente
    ws.on('message', (mensaje) => {
        try {
            const data = JSON.parse(mensaje);
            console.log('Mensaje recibido:', data);
            
            // Si es una alerta desde Python
            if (data.confianza && data.fecha && data.hora) {
                // Añadir la alerta al historial
                alertas.push(data);
                
                // Limitar el historial a 100 alertas
                if (alertas.length > 100) {
                    alertas.shift();
                }
                
                // Reenviar la alerta a todos los clientes conectados
                broadcastAlerta(data);
                
                console.log(`Alerta recibida con confianza: ${data.confianza}`);
            }
        } catch (error) {
            console.error('Error al procesar mensaje:', error);
        }
    });
    
    // Manejar desconexión
    ws.on('close', () => {
        console.log('Cliente desconectado');
        // Eliminar este cliente de la lista
        const index = clientes.indexOf(ws);
        if (index !== -1) {
            clientes.splice(index, 1);
        }
    });
});

// Función para enviar una alerta a todos los clientes conectados
function broadcastAlerta(alerta) {
    clientes.forEach(cliente => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(JSON.stringify({
                tipo: 'nueva_alerta',
                alerta: alerta
            }));
        }
    });
}

// Ruta básica para verificar que el servidor esté funcionando
app.get('/', (req, res) => {
    res.send('Servidor de WebSocket funcionando');
});

// Ruta para obtener todas las alertas (acceso HTTP para pruebas)
app.get('/alertas', (req, res) => {
    res.json(alertas);
});

// Puerto del servidor
const PORT = process.env.PORT || 8080;

// Iniciar el servidor
server.listen(PORT, () => {
    console.log(`Servidor WebSocket iniciado en puerto ${PORT}`);
});