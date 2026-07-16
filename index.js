const SteamUser = require('steam-user');
const express = require('express');

// 1. Cargar las credenciales desde las variables de Render
const accountName = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;

// 2. IDs de los juegos (Ejemplo: 550 para Left 4 Dead 2)
const gamesToIdle = [550]; 

const client = new SteamUser();

// 3. Conectar a Steam sin 2FA
console.log('Iniciando el bot y conectando a Steam...');
client.logOn({
    accountName: accountName,
    password: password
});

client.on('loggedOn', () => {
    console.log(`¡Conectado exitosamente a la cuenta de ${accountName}!`);
    
    // Configurar estado a Online
    client.setPersona(SteamUser.EPersonaState.Online); 
    
    // Iniciar el farmeo
    client.gamesPlayed(gamesToIdle);
    console.log(`Simulando estar jugando a los AppIDs: ${gamesToIdle.join(', ')}`);
});

client.on('error', (err) => {
    console.error('Error crítico al conectar a Steam:', err.message);
});

// 4. Servidor web para mantener a Render despierto
const app = express();
const port = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('🟢 Bot de Steam funcionando correctamente.');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});