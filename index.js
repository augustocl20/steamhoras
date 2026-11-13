const SteamUser = require('steam-user');
const express = require('express');
const crypto = require('crypto');

// Configuramos las cuentas que queremos conectar
const cuentas = [
    {
        user: process.env.STEAM_USERNAME_1,
        pass: process.env.STEAM_PASSWORD_1,
        token: process.env.STEAM_REFRESH_TOKEN_1
    },
    {
        user: process.env.STEAM_USERNAME_2,
        pass: process.env.STEAM_PASSWORD_2,
        token: process.env.STEAM_REFRESH_TOKEN_2
    }
];

const gamesToIdle = [550];

// Cuentas que están esperando un código de Steam Guard
// { [numeroDeCuenta]: { user, domain, callback } }
const pendientes = {};

console.log('Iniciando el sistema multi-cuenta...');

// Bucle para iniciar sesión en cada cuenta
cuentas.forEach((cuenta, index) => {
    // Si la variable está vacía, saltamos a la siguiente
    if (!cuenta.user || !cuenta.pass) return;

    const n = index + 1;
    const client = new SteamUser();

    console.log(`[Cuenta ${n}] Conectando a ${cuenta.user}...`);

    // Si hay token guardado, entra sin pedir código de Steam Guard.
    // Si no, entra con usuario y contraseña (y pedirá código si la cuenta lo exige).
    if (cuenta.token) {
        console.log(`[Cuenta ${n}] Usando token guardado (sin código).`);
        client.logOn({ refreshToken: cuenta.token });
    } else {
        client.logOn({
            accountName: cuenta.user,
            password: cuenta.pass
        });
    }

    // Steam entrega un token de sesión tras el login con contraseña.
    // Cópialo a Render como STEAM_REFRESH_TOKEN_${n} para no volver a pedir código.
    client.on('refreshToken', (token) => {
        if (cuenta.token) return;
        console.log(`🔑 [Cuenta ${n}] Token de sesión (guárdalo en Render como STEAM_REFRESH_TOKEN_${n} y NO lo compartas):`);
        console.log(token);
    });

    // Steam pide el código (llega al correo o a la app móvil)
    client.on('steamGuard', (domain, callback, lastCodeWrong) => {
        pendientes[n] = { user: cuenta.user, domain, callback };
        if (lastCodeWrong) {
            console.log(`⚠️ [Cuenta ${n}] El código anterior fue incorrecto. Envía uno nuevo en /codigo/${n}/CODIGO?token=TU_CLAVE`);
        } else {
            const donde = domain ? `al correo @${domain}` : 'a la app móvil de Steam';
            console.log(`🔐 [Cuenta ${n}] Steam envió un código ${donde}. Envíalo en /codigo/${n}/CODIGO?token=TU_CLAVE`);
        }
    });

    client.on('loggedOn', () => {
        delete pendientes[n];
        console.log(`✅ [Cuenta ${n}] ¡Conectado exitosamente a ${cuenta.user}!`);
        client.setPersona(SteamUser.EPersonaState.Online);
        client.gamesPlayed(gamesToIdle);
        console.log(`[Cuenta ${n}] Farmeando horas...`);
    });

    client.on('error', (err) => {
        delete pendientes[n];
        console.log(`❌ [Cuenta ${n}] ERROR (${cuenta.user}): ${err.message}`);
    });
});

// Servidor Web para UptimeRobot + ingreso de códigos
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🟢 Bot Multi-cuenta de Steam funcionando 24/7.');
});

// --- Enviar el código de Steam Guard directo en el enlace ---
// /codigo/1/ABC12?token=CLAVE  -> cuenta 1
// /codigo/ABC12?token=CLAVE    -> solo si hay UNA cuenta esperando código
// Protegido con GUARD_TOKEN (variable de entorno). Si no está definida, la ruta se desactiva.
function tokenValido(recibido) {
    const esperado = process.env.GUARD_TOKEN;
    if (!esperado || !recibido) return false;
    const a = Buffer.from(String(recibido));
    const b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function enviarCodigo(cuenta, codigo, res) {
    const p = pendientes[cuenta];
    if (!p) return res.status(404).send(`La cuenta ${esc(cuenta)} no está esperando código.`);
    delete pendientes[cuenta];
    p.callback(String(codigo).trim());
    console.log(`[Cuenta ${cuenta}] Código recibido, verificando...`);
    res.send(`✅ Código enviado a la cuenta ${esc(cuenta)} (${esc(p.user)}). Revisa los logs para ver si se conectó.`);
}

app.get('/codigo/:cuenta/:codigo', (req, res) => {
    if (!process.env.GUARD_TOKEN) return res.status(503).send('Ruta desactivada: falta GUARD_TOKEN.');
    if (!tokenValido(req.query.token)) return res.status(401).send('No autorizado.');
    enviarCodigo(req.params.cuenta, req.params.codigo, res);
});

app.get('/codigo/:codigo', (req, res) => {
    if (!process.env.GUARD_TOKEN) return res.status(503).send('Ruta desactivada: falta GUARD_TOKEN.');
    if (!tokenValido(req.query.token)) return res.status(401).send('No autorizado.');
    const ids = Object.keys(pendientes);
    if (ids.length === 0) return res.status(404).send('No hay cuentas esperando código.');
    if (ids.length > 1) {
        return res.status(400).send(`Hay ${ids.length} cuentas esperando código. Usa /codigo/NUMERO_DE_CUENTA/CODIGO (cuentas: ${ids.join(', ')}).`);
    }
    enviarCodigo(ids[0], req.params.codigo, res);
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});