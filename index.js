const SteamUser = require('steam-user');
const express = require('express');

const accountName = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;
const gamesToIdle = [550]; 

const client = new SteamUser();

console.log('Iniciando el bot y conectando a Steam...');

// 1. Verificamos que Render esté leyendo bien tus credenciales
if (!accountName || !password) {
    console.log('⚠️ ERROR: Las variables STEAM_USERNAME o STEAM_PASSWORD están vacías. Revisa la pestaña Environment en Render.');
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

// 2. Detector de bloqueos por Steam Guard (Correo)
client.on('steamGuard', (domain, callback, lastCodeWrong) => {
    console.log(`🚨 STEAM GUARD ACTIVO: Steam ha enviado un código de seguridad a tu correo (${domain}).`);
    console.log(`Debido a que Render está en otra ubicación, Steam ha bloqueado el acceso temporalmente.`);
});

// 3. Detector de contraseñas incorrectas o baneos
client.on('error', (err) => {
    console.log(`❌ ERROR DE STEAM: ${err.message}`);
});

const app = express();
const port = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('🟢 Bot de Steam funcionando.');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});