const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');  // Import CORS
require('dotenv').config();

const app = express(); // Initialize app here
const server = http.createServer(app);
const io = socketIo(server);

// Enable CORS here
app.use(cors());

// Include auth routes
const authRoutes = require('./routes/auth');  // Adjust path if necessary
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('view'));

// Use auth routes with /api/auth prefix
app.use('/api/auth', authRoutes);  // This will make /signup and /login accessible

const User = require('./models/User');
const Message = require('./models/Message');

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB Connected');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });

const users = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        users[socket.id] = { username, room };
        socket.to(room).emit('message', { from_user: 'System', message: `${username} has joined the chat` });
    });

    socket.on('chatMessage', ({ username, message }) => {
        const room = users[socket.id]?.room;
        if (room) {
            io.to(room).emit('message', { from_user: username, message });
            const chatMessage = new Message({ from_user: username, room, message });
            chatMessage.save();
        }
    });

    socket.on('typing', ({ username }) => {
        const room = users[socket.id]?.room;
        if (room) {
            socket.to(room).emit('typing', username);
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('message', { from_user: 'System', message: `${user.username} has left the chat` });
            delete users[socket.id];
        }
    });
});

app.get('/', (req, res) => {
    res.send('Chat App Server Running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
