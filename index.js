const SteamUser = require('steam-user');
const express = require('express');

// Configuramos las cuentas que queremos conectar
const cuentas = [
    {
        user: process.env.STEAM_USERNAME_1,
        pass: process.env.STEAM_PASSWORD_1
    },
    {
        user: process.env.STEAM_USERNAME_2,
        pass: process.env.STEAM_PASSWORD_2
    }
];

const gamesToIdle = [550]; 

console.log('Iniciando el sistema multi-cuenta...');

// Bucle para iniciar sesión en cada cuenta
cuentas.forEach((cuenta, index) => {
    // Si la variable está vacía, saltamos a la siguiente
    if (!cuenta.user || !cuenta.pass) return; 

    const client = new SteamUser();
    
    console.log(`[Cuenta ${index + 1}] Conectando a ${cuenta.user}...`);
    
    client.logOn({
        accountName: cuenta.user,
        password: cuenta.pass
    });

    client.on('loggedOn', () => {
        console.log(`✅ [Cuenta ${index + 1}] ¡Conectado exitosamente a ${cuenta.user}!`);
        client.setPersona(SteamUser.EPersonaState.Online); 
        client.gamesPlayed(gamesToIdle);
        console.log(`[Cuenta ${index + 1}] Farmeando horas...`);
    });

    client.on('error', (err) => {
        console.log(`❌ [Cuenta ${index + 1}] ERROR (${cuenta.user}): ${err.message}`);
    });
});

// Servidor Web para UptimeRobot
const app = express();
const port = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('🟢 Bot Multi-cuenta de Steam funcionando 24/7.');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});