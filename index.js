const SteamUser = require('steam-user');
const express = require('express');
const crypto = require('crypto');

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

// Cuentas que están esperando un código de Steam Guard
// { [numeroDeCuenta]: { user, domain, callback, wrong } }
const pendientes = {};

console.log('Iniciando el sistema multi-cuenta...');

// Bucle para iniciar sesión en cada cuenta
cuentas.forEach((cuenta, index) => {
    // Si la variable está vacía, saltamos a la siguiente
    if (!cuenta.user || !cuenta.pass) return;

    const n = index + 1;
    const client = new SteamUser();

    console.log(`[Cuenta ${n}] Conectando a ${cuenta.user}...`);

    client.logOn({
        accountName: cuenta.user,
        password: cuenta.pass
    });

    // Steam pide el código (llega al correo o a la app móvil)
    client.on('steamGuard', (domain, callback, lastCodeWrong) => {
        pendientes[n] = { user: cuenta.user, domain, callback, wrong: !!lastCodeWrong };
        if (lastCodeWrong) {
            console.log(`⚠️ [Cuenta ${n}] El código anterior fue incorrecto. Ingresa uno nuevo en /guard`);
        } else {
            const donde = domain ? `al correo @${domain}` : 'a la app móvil de Steam';
            console.log(`🔐 [Cuenta ${n}] Steam envió un código ${donde}. Ingrésalo en /guard`);
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
app.use(express.urlencoded({ extended: false }));
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🟢 Bot Multi-cuenta de Steam funcionando 24/7.');
});

// --- Ruta para ingresar el código de Steam Guard ---
// Protegida con GUARD_TOKEN (variable de entorno). Si no está definida, la ruta se desactiva.
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

function pagina(token, mensaje = '') {
    const ids = Object.keys(pendientes);
    const formularios = ids.length
        ? ids.map((n) => {
            const p = pendientes[n];
            const donde = p.domain ? `correo @${esc(p.domain)}` : 'app móvil de Steam';
            return `
            <form method="POST" action="/guard">
                <input type="hidden" name="token" value="${esc(token)}">
                <input type="hidden" name="cuenta" value="${esc(n)}">
                <p><b>Cuenta ${esc(n)}</b> (${esc(p.user)}) — código enviado al ${donde}${p.wrong ? ' — <span style="color:#c00">el anterior fue incorrecto</span>' : ''}</p>
                <input name="codigo" placeholder="Código" autocomplete="off" required>
                <button type="submit">Enviar</button>
            </form>`;
        }).join('<hr>')
        : '<p>No hay cuentas esperando código en este momento.</p>';

    return `<!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Steam Guard</title>
        <style>body{font-family:sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem}
        input,button{font-size:1rem;padding:.5rem;margin:.25rem 0}</style></head>
        <body><h2>Steam Guard</h2>${mensaje ? `<p>${mensaje}</p>` : ''}${formularios}</body></html>`;
}

app.get('/guard', (req, res) => {
    if (!process.env.GUARD_TOKEN) return res.status(503).send('Ruta desactivada: falta GUARD_TOKEN.');
    if (!tokenValido(req.query.token)) return res.status(401).send('No autorizado.');
    res.send(pagina(req.query.token));
});

app.post('/guard', (req, res) => {
    if (!process.env.GUARD_TOKEN) return res.status(503).send('Ruta desactivada: falta GUARD_TOKEN.');
    const { token, cuenta, codigo } = req.body;
    if (!tokenValido(token)) return res.status(401).send('No autorizado.');

    const p = pendientes[cuenta];
    if (!p) return res.send(pagina(token, 'Esa cuenta ya no está esperando código.'));

    delete pendientes[cuenta];
    p.callback(String(codigo).trim());
    console.log(`[Cuenta ${cuenta}] Código recibido, verificando...`);
    res.send(pagina(token, '✅ Código enviado. Revisa los logs para ver si se conectó.'));
});

// --- Enviar el código directo en el enlace ---
// /codigo/1/ABC12?token=CLAVE  -> cuenta 1
// /codigo/ABC12?token=CLAVE    -> solo si hay UNA cuenta esperando código
function enviarCodigo(cuenta, codigo, res) {
    const p = pendientes[cuenta];
    if (!p) return res.status(404).send(`La cuenta ${esc(cuenta)} no está esperando código.`);
    delete pendientes[cuenta];
    p.callback(String(codigo).trim());
    console.log(`[Cuenta ${cuenta}] Código recibido por enlace, verificando...`);
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