const SteamUser = require('steam-user');
const express = require('express');

const accountName = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;
const gamesToIdle = [550]; 

const client = new SteamUser();

// Variable global para guardar la función que envía el código a Steam
let funcionParaEnviarCodigo = null;

console.log('Iniciando el bot y conectando a Steam...');

if (!accountName || !password) {
    console.log('⚠️ ERROR: Faltan credenciales.');
} else {
    client.logOn({
        accountName: accountName,
        password: password
    });
}

client.on('loggedOn', () => {
    console.log(`¡Conectado exitosamente a la cuenta de ${accountName}!`);
    client.setPersona(SteamUser.EPersonaState.Online); 
    client.gamesPlayed(gamesToIdle);
    console.log(`Simulando estar jugando a los AppIDs: ${gamesToIdle.join(', ')}`);
});

// Cuando Steam pida el código, guardamos la función y avisamos
client.on('steamGuard', (domain, callback, lastCodeWrong) => {
    console.log(`🚨 STEAM GUARD ACTIVO: Steam envió un código a tu correo (${domain}).`);
    console.log(`>>> PARA ENVIARLO, entra ahora mismo a tu link de Render añadiendo: /auth?codigo=TU_CODIGO`);
    // Guardamos el callback (la llave para entrar)
    funcionParaEnviarCodigo = callback; 
});

client.on('error', (err) => {
    console.log(`❌ ERROR DE STEAM: ${err.message}`);
});

const app = express();
const port = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('🟢 Bot de Steam funcionando.');
});

// NUEVA RUTA: La puerta trasera para inyectar el código
app.get('/auth', (req, res) => {
    const codigoIngresado = req.query.codigo;
    
    if (codigoIngresado && funcionParaEnviarCodigo) {
        // Le pasamos el código directamente a Steam
        funcionParaEnviarCodigo(codigoIngresado);
        funcionParaEnviarCodigo = null; // Limpiamos la variable
        
        console.log(`Enviando el código ${codigoIngresado} a Steam...`);
        res.send(`<h2>✅ Código ${codigoIngresado} enviado al bot.</h2> Revisa la consola de Render para ver si funcionó.`);
    } else {
        res.send('❌ No se proporcionó ningún código o Steam no lo está pidiendo en este momento.');
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});