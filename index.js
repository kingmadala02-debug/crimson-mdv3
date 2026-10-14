const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const settings = require('./settings')

async function startBot() {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('session')

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["CRIMSON-XMD", "Chrome", "121.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            if(lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) {
                startBot()
            }
        } else if(connection === 'open') {
            console.log(`✅ ${settings.botName} ONLINE`)
        }
    })

    sock.ev.on('group-participants.update', async (anu) => {
        for(let p of anu.participants) {
            if(anu.action === 'add') {
                await sock.sendMessage(anu.id, { text: settings.welcome.replace('@user', `@${p.split('@')[0]}`), mentions: [p] })
            } else if(anu.action === 'remove') {
                await sock.sendMessage(anu.id, { text: settings.goodbye.replace('@user', `@${p.split('@')[0]}`), mentions: [p] })
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        if(!text.startsWith(settings.prefix)) return

        const args = text.slice(settings.prefix.length).trim().split(/ +/)
        const command = args.shift().toLowerCase()

        const commandFile = `./commands/${command}.js`
        if(fs.existsSync(commandFile)) {
            try {
                delete require.cache[require.resolve(commandFile)]
                const cmd = require(commandFile)
                await cmd.execute(sock, m, args, from, settings)
            } catch (e) { console.log(e) }
        }

        if(command === 'menu') {
            let menu = `*${settings.botName} MENU* 👑\nOwner: ${settings.ownerName}\n\n`
            fs.readdirSync('./commands').forEach(file => {
                menu += `• ${settings.prefix}${file.replace('.js','')}\n`
            })
            sock.sendMessage(from, { text: menu })
        }
    })
}

startBot()
