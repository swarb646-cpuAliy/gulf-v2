const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// --- [1] إعدادات الرفع والأمان ---
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, 'gulf-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // حد أقصى 10 ميجا
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|docx|zip/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb("خطأ: الملف غير مدعوم!");
    }
});

app.use(express.static('public'));
app.use(express.json());

// --- [2] قاعدة البيانات والرسائل ---
let data = { msgs: [], services: [], platformDesc: "مرحباً بك." };
if (fs.existsSync('database.json')) { 
    try { data = JSON.parse(fs.readFileSync('database.json')); } catch(e) {} 
}
const save = () => fs.writeFileSync('database.json', JSON.stringify(data));

// --- [3] وظيفة التنظيف التلقائي (30 يوم) ---
const cleanEverything = () => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // تنظيف الرسائل القديمة
    data.msgs = data.msgs.filter(m => (now - (m.timestamp || 0)) < thirtyDays);
    save();

    // تنظيف الملفات القديمة
    const uploadsDir = path.join(__dirname, 'public/uploads');
    if (fs.existsSync(uploadsDir)) {
        fs.readdir(uploadsDir, (err, files) => {
            if (err) return;
            files.forEach(file => {
                if (file === '.gitkeep') return;
                const filePath = path.join(uploadsDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (!err && (now - stats.mtimeMs) > thirtyDays) {
                        fs.unlink(filePath, () => console.log(`Deleted: ${file}`));
                    }
                });
            });
        });
    }
};
setInterval(cleanEverything, 1000 * 60 * 60 * 24); // فحص يومي

// --- [4] المسارات (Routes) ---
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ success: true, filePath: '/uploads/' + req.file.filename });
    } else {
        res.status(400).json({ success: false });
    }
});

io.on('connection', (socket) => {
    socket.emit('init_history', data.msgs);
    socket.emit('init_services', data.services);
    
    socket.on('send_msg', (m) => {
        m.timestamp = Date.now(); 
        data.msgs.push(m);
        save();
        io.emit('new_msg', m);
    });

    socket.on('add_new_service', (s) => { data.services.push(s); save(); io.emit('init_services', data.services); });
    socket.on('update_services', (newList) => { data.services = newList; save(); io.emit('init_services', data.services); });
});

// تشغيل السيرفر
http.listen(4000, '0.0.0.0', () => {
    console.log('Gulf Platform v2: Full System Online');
    cleanEverything(); 
});
