module.exports = {
    execute: async (sock,m,args,from)=>{
        await sock.sendMessage(from,{text:"🏓 Pong! Fast ⚡"},{quoted:m})
    }
}
