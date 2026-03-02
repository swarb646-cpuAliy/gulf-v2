const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static('public'));
let data = { msgs: [], services: [], platformDesc: "مرحباً بك." };
if (fs.existsSync('database.json')) { try { data = JSON.parse(fs.readFileSync('database.json')); } catch(e) {} }
const save = () => fs.writeFileSync('database.json', JSON.stringify(data));

io.on('connection', (socket) => {
    socket.emit('init_history', data.msgs);
    socket.emit('init_services', data.services);
    
    socket.on('send_msg', (m) => {
        m.timestamp = Date.now(); // السيرفر يختم الوقت هنا
        data.msgs.push(m);
        save();
        io.emit('new_msg', m);
    });

    socket.on('add_new_service', (s) => { data.services.push(s); save(); io.emit('init_services', data.services); });
    socket.on('update_services', (newList) => { data.services = newList; save(); io.emit('init_services', data.services); });
});

http.listen(4000, '0.0.0.0', () => console.log('Fixed Server Running'));
