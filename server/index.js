import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'
import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000
const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {}
})


// Verifica que el token de la DB esté definido
if (!process.env.DB_TOKEN) {
  throw new Error('Falta DB_TOKEN en las variables de entorno')
}

// Conexión a la base de datos Turso (libSQL)
const db = createClient({
  url: 'libsql://striking-armor-parrachan.aws-us-east-2.turso.io',
  authToken: process.env.DB_TOKEN
})

// Crea la tabla si no existe
await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`)

io.on('connection', async (socket) => {
  io.on('connection', (socket) => {
  console.log('Handshake auth:', socket.handshake.auth)

  const username = socket.handshake.auth?.username?.trim() || 'anonymous'
  console.log(`Usuario conectado: ${username}`)
})
  const username = socket.handshake.auth?.username?.trim() || 'anonymous'
  console.log(`Usuario conectado: ${username}`)

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${username}`)
  })

  socket.on('chat message', async (msg) => {
    let result
    try {
      result = await db.execute({
        sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
        args: { msg, username }
      })
    } catch (e) {
      console.error('Error al guardar mensaje:', e)
      return
    }

    console.log(`Mensaje de ${username}: ${msg}`)
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
  })

  // Recuperación de mensajes si no es reconexión
  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: 'SELECT id, content, user FROM messages WHERE id > ?',
        args: [socket.handshake.auth.serverOffset ?? 0]
      })

      results.rows.forEach((row) => {
        socket.emit('chat message', row.content, row.id.toString(), row.user)
      })
    } catch (e) {
      console.error('Error al recuperar mensajes:', e)
    }
  }
})

// Logger solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use(logger('dev'))
}

// Ruta para el cliente HTML
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

// Servidor escuchando
server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`)
})
