import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app) //aqui creamos el servidor http
const io = new Server(server,{
    connectionStateRecovery:{}
})// creamos el servidor con socket.io y le asignamos el servidor de node:http


const db = createClient({
    url:"libsql://striking-armor-parrachan.aws-us-east-2.turso.io",
    authToken:process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
    )
    `)

io.on('connection',async (socket) => {
    const username = socket.handshake.auth.username
    console.log('un usuario se ha conectado')

    socket.on('disconnect',()=>{
        console.log('un usuario se ha desconectado')
    })

    socket.on('chat message',async(msg)=>{
        let result 
         const user = socket.handshake.auth.username ?? 'anonymous'
        try{
           
            result= await db.execute({
                sql:`INSERT INTO messages (content, user) VALUES (:msg, :username)`,
                args: {msg, username}
            })
        }
        catch(e){
            console.error(e)
            return 
            
        }
        console.log('message: '+msg)
        io.emit('chat message', msg, result.lastInsertRowid.toString().username)
    })
   
    
         if(!socket.recovered){
    try{
        const results = await db.execute({
            sql :'SELECT id, content, user FROM messages WHERE id> ?',
            args: [socket.handshake.auth.serverOffset ?? 0]
        })
        results.rows.forEach(row=>{
            socket.emit('chat message', row.content, row.id.toString(), username)
        })
    }catch(e){
        console.error(e)
    }
    }
})

app.use(logger('dev'))

app.get('/',(req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`)
})