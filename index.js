const express = require('express');
const app = express();
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');  // เพิ่ม path module

const hostname = '127.0.0.1';
const port = 3000;
const JWT_SECRET = 'medicare_reminder_secret_key';

// ตั้งค่า CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ตั้งค่า middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// สร้างการเชื่อมต่อกับฐานข้อมูล
const connection = mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    user: '42Ci2KHqgkJf2LN.root',
    password: 'bmHBov2yIgAdceqT',
    database: 'medicare_reminder',
    ssl: {
        rejectUnauthorized: false
    }
});
connection.connect(function(err) {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database with id ' + connection.threadId);
});

// Middleware สำหรับตรวจสอบ token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: true, message: "กรุณาเข้าสู่ระบบ" });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: true, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
        }
        
        req.user = user;
        next();
    });
}

// API Documentation
app.get('/', (req, res) => {
    res.json({
        "Name": "MediCare Reminder API",
        "APIs": [
            // Authentication
            {"api_name": "/api/login", "method": "post", "description": "Login"},
            {"api_name": "/register", "method": "post", "description": "Register new user"},
            
            // Medications
            {"api_name": "/medications", "method": "get", "description": "Get all medications for current user"},
            {"api_name": "/medications/:id", "method": "get", "description": "Get medication by ID"},
            {"api_name": "/medications", "method": "post", "description": "Add new medication"},
            
            // Reminders
            {"api_name": "/reminders", "method": "get", "description": "Get all reminders for current user"},
            {"api_name": "/reminders/:id", "method": "get", "description": "Get reminder by ID"},
            {"api_name": "/reminders", "method": "post", "description": "Add new reminder"},
            
            // Logs
            {"api_name": "/logs", "method": "get", "description": "Get all medication logs for current user"},
            {"api_name": "/logs", "method": "post", "description": "Add new medication log"}
        ]
    });
});

// API สำหรับตั้งค่าฐานข้อมูลเริ่มต้น (สร้างตารางทั้งหมด)
app.get('/setup-database', (req, res) => {
    // สร้างตาราง users
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT(11) NOT NULL AUTO_INCREMENT,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(100) NOT NULL,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            role ENUM('patient', 'caregiver') DEFAULT 'patient',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY username (username),
            UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;
    
    // สร้างตาราง medications
    const createMedicationsTable = `
        CREATE TABLE IF NOT EXISTS medications (
            id INT(11) NOT NULL AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            dosage VARCHAR(50),
            usage_instructions TEXT,
            time_to_take TIME,
            user_id INT(11) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            CONSTRAINT medications_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;
    
    // สร้างตาราง reminders
    const createremindersTable = `
        CREATE TABLE IF NOT EXISTS reminders (
            id INT(11) NOT NULL AUTO_INCREMENT,
            medication_id INT(11) NOT NULL,
            reminder_time TIME NOT NULL,
            notification_channel VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY medication_id (medication_id),
            CONSTRAINT reminders_ibfk_1 FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;
    
    // สร้างตาราง logs
    const createLogsTable = `
        CREATE TABLE IF NOT EXISTS logs (
            id INT(11) NOT NULL AUTO_INCREMENT,
            medication_id INT(11) NOT NULL,
            confirmed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY medication_id (medication_id),
            CONSTRAINT logs_ibfk_1 FOREIGN KEY (medication_id) REFERENCES medications (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;
    
    // ดำเนินการสร้างตารางตามลำดับ
    connection.query(createUsersTable, (err, results) => {
        if (err) {
            return res.status(500).json({
                error: true,
                message: "เกิดข้อผิดพลาดในการสร้างตาราง users",
                details: err.message
            });
        }
        
        connection.query(createMedicationsTable, (err, results) => {
            if (err) {
                return res.status(500).json({
                    error: true,
                    message: "เกิดข้อผิดพลาดในการสร้างตาราง medications",
                    details: err.message
                });
            }
            
            connection.query(createRemindersTable, (err, results) => {
                if (err) {
                    return res.status(500).json({
                        error: true,
                        message: "เกิดข้อผิดพลาดในการสร้างตาราง reminders",
                        details: err.message
                    });
                }
                
                connection.query(createLogsTable, (err, results) => {
                    if (err) {
                        return res.status(500).json({
                            error: true,
                            message: "เกิดข้อผิดพลาดในการสร้างตาราง logs",
                            details: err.message
                        });
                    }
                    
                    res.json({
                        error: false,
                        message: "สร้างฐานข้อมูลสำเร็จ"
                    });
                });
            });
        });
    });
});

// API สำหรับสร้างผู้ใช้ทดสอบ
app.get('/create-test-users', async (req, res) => {
    try {
        // สร้างผู้ใช้ทดสอบ 2 คน - ผู้ป่วยและผู้ดูแล
        const users = [
            {
                username: 'patient1',
                email: 'patient@example.com',
                password: 'password',
                first_name: 'ผู้ป่วย',
                last_name: 'ทดสอบ',
                role: 'patient'
            },
            {
                username: 'caregiver1',
                email: 'caregiver@example.com',
                password: 'password',
                first_name: 'ผู้ดูแล',
                last_name: 'ทดสอบ',
                role: 'caregiver'
            }
        ];
        
        const results = [];
        
        for (const user of users) {
            // ตรวจสอบว่ามีผู้ใช้นี้อยู่แล้วหรือไม่
            const [existingUsers] = await connection.promise().query('SELECT id FROM users WHERE email = ?', [user.email]);
            
            if (existingUsers.length > 0) {
                results.push({ 
                    email: user.email, 
                    status: 'มีอยู่แล้ว', 
                    userId: existingUsers[0].id 
                });
                continue;
            }
            
            // เข้ารหัสรหัสผ่าน
            const hashedPassword = await bcrypt.hash(user.password, 10);
            
            // เพิ่มผู้ใช้ใหม่
            const [insertResult] = await connection.promise().query(
                `INSERT INTO users (username, password, email, first_name, last_name, role, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [user.username, hashedPassword, user.email, user.first_name, user.last_name, user.role]
            );
            
            results.push({
                email: user.email,
                status: 'สร้างสำเร็จ',
                userId: insertResult.insertId
            });
        }
        
        res.json({
            error: false,
            message: "สร้างผู้ใช้ทดสอบสำเร็จ",
            results: results,
            credentials: {
                patient: { email: 'patient@example.com', password: 'password' },
                caregiver: { email: 'caregiver@example.com', password: 'password' }
            }
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการสร้างผู้ใช้ทดสอบ",
            details: error.message
        });
    }
});

// API สำหรับการล็อกอิน
app.post('/api/login', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (!req.body.email || !req.body.password) {
        return res.status(400).json({
            error: true,
            message: "กรุณาระบุอีเมลและรหัสผ่าน"
        });
    }
    
    const email = req.body.email;
    const password = req.body.password;
    
    try {
        // ค้นหาผู้ใช้จากฐานข้อมูล
        const [users] = await connection.promise().query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({
                error: true,
                message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            });
        }
        
        const user = users[0];
        
        // ตรวจสอบรหัสผ่าน
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({
                error: true,
                message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            });
        }
        
        // สร้าง JWT Token
        const expiresIn = '24h';
        const token = jwt.sign({
            userId: user.id,
            email: user.email,
            username: user.username,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role
        }, JWT_SECRET, { expiresIn });
        
        return res.json({
            error: false,
            message: "เข้าสู่ระบบสำเร็จ",
            token: token,
            expiresIn: expiresIn,
            user: {
                id: user.id,
                username: user.username,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
        });
    }
});

// API สำหรับการลงทะเบียน
app.post('/register', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!req.body.username || !req.body.email || !req.body.password || 
        !req.body.first_name || !req.body.last_name) {
        return res.status(400).json({
            error: true,
            message: "กรุณาระบุข้อมูลให้ครบถ้วน"
        });
    }

    try {
        // ตรวจสอบว่ามีอีเมลนี้ในระบบแล้วหรือไม่
        const [emailCheck] = await connection.promise().query('SELECT id FROM users WHERE email = ?', [req.body.email]);
        
        if (emailCheck.length > 0) {
            return res.status(400).json({
                error: true,
                message: "อีเมลนี้ถูกใช้งานแล้ว"
            });
        }
        
        // ตรวจสอบว่ามีชื่อผู้ใช้นี้ในระบบแล้วหรือไม่
        const [usernameCheck] = await connection.promise().query('SELECT id FROM users WHERE username = ?', [req.body.username]);
        
        if (usernameCheck.length > 0) {
            return res.status(400).json({
                error: true,
                message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว"
            });
        }
        
        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        
        // กำหนดค่า role เริ่มต้นเป็น patient หากไม่ได้ระบุ
        const userRole = req.body.role || 'patient';
        
        // บันทึกข้อมูลผู้ใช้ใหม่
        const [result] = await connection.promise().query(
            `INSERT INTO users (username, password, email, first_name, last_name, role, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [req.body.username, hashedPassword, req.body.email, req.body.first_name, req.body.last_name, userRole]
        );
        
        return res.json({
            error: false,
            message: "ลงทะเบียนสำเร็จ",
            data: {
                id: result.insertId,
                username: req.body.username,
                email: req.body.email,
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                role: userRole
            }
        });
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการลงทะเบียน: " + error.message
        });
    }
});

// API สำหรับตรวจสอบ token
app.post('/verify-token', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            error: true, 
            message: "กรุณาเข้าสู่ระบบ" 
        });
    }
    
    try {
        // ตรวจสอบ token
        const decoded = jwt.verify(token, JWT_SECRET);
        return res.json({
            error: false,
            message: "Token ถูกต้อง",
            user: decoded
        });
    } catch (error) {
        return res.status(403).json({ 
            error: true, 
            message: "Token ไม่ถูกต้องหรือหมดอายุ" 
        });
    }
});

app.get('/medications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("Fetching medications for user:", userId);
        
        const [medications] = await connection.promise().query(
            'SELECT * FROM medications WHERE user_id = ?',
            [userId]
        );
        
        console.log("Found medications:", medications.length);
        res.json(medications);
    } catch (error) {
        console.error('Error fetching medications:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลยา",
            details: error.message,
            stack: error.stack
        });
    }
});

// API สำหรับดึงข้อมูลยาตาม ID
app.get('/medications/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const medicationId = req.params.id;
        
        // ตรวจสอบว่ายาเป็นของผู้ใช้นี้หรือไม่
        const [medications] = await connection.promise().query(
            'SELECT * FROM medications WHERE id = ? AND user_id = ?',
            [medicationId, userId]
        );
        
        if (medications.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลยา"
            });
        }
        
        res.json(medications[0]);
    } catch (error) {
        console.error('Error fetching medication:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลยา"
        });
    }
});

// API สำหรับเพิ่มข้อมูลยา
app.post('/medications', authenticateToken, async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({
                error: true,
                message: "กรุณาระบุชื่อยา"
            });
        }
        
        const userId = req.user.userId;
        
        const [result] = await connection.promise().query(
            `INSERT INTO medications (name, dosage, usage_instructions, time_to_take, user_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.body.name,
                req.body.dosage || null,
                req.body.usage_instructions || null,
                req.body.time_to_take || null,
                userId
            ]
        );
        
        res.json({
            error: false,
            message: "เพิ่มข้อมูลยาสำเร็จ",
            data: {
                id: result.insertId,
                name: req.body.name,
                dosage: req.body.dosage,
                usage_instructions: req.body.usage_instructions,
                time_to_take: req.body.time_to_take,
                user_id: userId
            }
        });
    } catch (error) {
        console.error('Error adding medication:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการเพิ่มข้อมูลยา"
        });
    }
});

// API สำหรับแก้ไขข้อมูลยา
app.put('/medications/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({
                error: true,
                message: "กรุณาระบุชื่อยา"
            });
        }
        
        const userId = req.user.userId;
        const medicationId = req.params.id;
        
        // ตรวจสอบว่ายาเป็นของผู้ใช้นี้หรือไม่
        const [medications] = await connection.promise().query(
            'SELECT id FROM medications WHERE id = ? AND user_id = ?',
            [medicationId, userId]
        );
        
        if (medications.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลยา"
            });
        }
        
        await connection.promise().query(
            `UPDATE medications SET 
                name = ?, 
                dosage = ?, 
                usage_instructions = ?, 
                time_to_take = ?
             WHERE id = ?`,
            [name, dosage, usage_instructions, time_to_take, id]
           [
                req.body.name,
                req.body.dosage || null,
                req.body.usage_instructions || null,
                req.body.time_to_take || null,
                medicationId
            ]
        );
        
        res.json({
            error: false,
            message: "แก้ไขข้อมูลยาสำเร็จ",
            data: {
                id: parseInt(medicationId),
                name: req.body.name,
                dosage: req.body.dosage,
                usage_instructions: req.body.usage_instructions,
                time_to_take: req.body.time_to_take,
                user_id: userId
            }
        });
    } catch (error) {
        console.error('Error updating medication:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลยา"
        });
    }
});

// API สำหรับลบข้อมูลยา
app.delete('/medications/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const medicationId = req.params.id;
        
        // ตรวจสอบว่ายาเป็นของผู้ใช้นี้หรือไม่
        const [medications] = await connection.promise().query(
            'SELECT id FROM medications WHERE id = ? AND user_id = ?',
            [medicationId, userId]
        );
        
        if (medications.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลยา"
            });
        }
        
        await connection.promise().query(
            'DELETE FROM medications WHERE id = ?',
            [medicationId]
        );
        
        res.json({
            error: false,
            message: "ลบข้อมูลยาสำเร็จ"
        });
    } catch (error) {
        console.error('Error deleting medication:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการลบข้อมูลยา"
        });
    }
});

// API สำหรับดึงข้อมูลการแจ้งเตือนทั้งหมด
app.get('/reminders', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [reminders] = await connection.promise().query(
            `SELECT r.*, m.name as medication_name 
             FROM reminders r 
             JOIN medications m ON r.medication_id = m.id 
             WHERE m.user_id = ?`,
            [userId]
        );
        
        res.json(reminders);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน"
        });
    }
});

// API สำหรับเพิ่มการแจ้งเตือน
app.post('/reminders', authenticateToken, async (req, res) => {
    try {
        if (!req.body.medication_id || !req.body.reminder_time || !req.body.notification_channel) {
            return res.status(400).json({
                error: true,
                message: "กรุณาระบุข้อมูลให้ครบถ้วน"
            });
        }
        
        const userId = req.user.userId;
        const medicationId = req.body.medication_id;
        
        // ตรวจสอบว่ายาเป็นของผู้ใช้นี้หรือไม่
        const [medications] = await connection.promise().query(
            'SELECT id FROM medications WHERE id = ? AND user_id = ?',
            [medicationId, userId]
        );
        
        if (medications.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลยา"
            });
        }
        
        const [result] = await connection.promise().query(
            `INSERT INTO reminders (medication_id, reminder_time, notification_channel) 
             VALUES (?, ?, ?)`,
            [
                medicationId,
                req.body.reminder_time,
                req.body.notification_channel
            ]
        );
        
        res.json({
            error: false,
            message: "เพิ่มการแจ้งเตือนสำเร็จ",
            data: {
                id: result.insertId,
                medication_id: medicationId,
                reminder_time: req.body.reminder_time,
                notification_channel: req.body.notification_channel
            }
        });
    } catch (error) {
        console.error('Error adding reminder:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการเพิ่มการแจ้งเตือน"
        });
    }
});

// API สำหรับลบการแจ้งเตือน
app.delete('/reminders/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const reminderId = req.params.id;
        
        // ตรวจสอบว่าการแจ้งเตือนเป็นของผู้ใช้นี้หรือไม่
        const [reminders] = await connection.promise().query(
            `SELECT r.id 
             FROM reminders r 
             JOIN medications m ON r.medication_id = m.id 
             WHERE r.id = ? AND m.user_id = ?`,
            [reminderId, userId]
        );
        
        if (reminders.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลการแจ้งเตือน"
            });
        }
        
        await connection.promise().query(
            'DELETE FROM reminders WHERE id = ?',
            [reminderId]
        );
        
        res.json({
            error: false,
            message: "ลบการแจ้งเตือนสำเร็จ"
        });
    } catch (error) {
        console.error('Error deleting reminder:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการลบการแจ้งเตือน"
        });
    }
});

// API สำหรับดึงประวัติการทานยา
app.get('/logs', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [logs] = await connection.promise().query(
            `SELECT l.*, m.name as medication_name 
             FROM logs l 
             JOIN medications m ON l.medication_id = m.id 
             WHERE m.user_id = ?
             ORDER BY l.confirmed_at DESC`,
            [userId]
        );
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงประวัติการทานยา"
        });
    }
});

// API สำหรับบันทึกการทานยา
app.post('/logs', authenticateToken, async (req, res) => {
    try {
        if (!req.body.medication_id) {
            return res.status(400).json({
                error: true,
                message: "กรุณาระบุรหัสยา"
            });
        }
        
        const userId = req.user.userId;
        const medicationId = req.body.medication_id;
        
        // ตรวจสอบว่ายาเป็นของผู้ใช้นี้หรือไม่
        const [medications] = await connection.promise().query(
            'SELECT id, name FROM medications WHERE id = ? AND user_id = ?',
            [medicationId, userId]
        );
        
        if (medications.length === 0) {
            return res.status(404).json({
                error: true,
                message: "ไม่พบข้อมูลยา"
            });
        }
        
        const now = new Date();
        const [result] = await connection.promise().query(
            'INSERT INTO logs (medication_id, confirmed_at) VALUES (?, ?)',
            [medicationId, now]
        );
        
        res.json({
            error: false,
            message: "บันทึกการทานยาสำเร็จ",
            data: {
                id: result.insertId,
                medication_id: medicationId,
                medication_name: medications[0].name,
                confirmed_at: now
            }
        });
    } catch (error) {
        console.error('Error adding log:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการบันทึกการทานยา"
        });
    }
});

// API สำหรับข้อมูลการใช้ยาตามเวลา (สำหรับกราฟ)
app.get('/medications/usage', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [results] = await connection.promise().query(
            `SELECT time_to_take, COUNT(*) as count 
             FROM medications 
             WHERE user_id = ? 
             GROUP BY time_to_take`,
            [userId]
        );
        
        // แปลงข้อมูลเพื่อรองรับค่า null
        const transformedResults = results.map(item => ({
            time_to_take: item.time_to_take || 'ไม่ระบุเวลา',
            count: item.count
        }));
        
        res.json(transformedResults);
    } catch (error) {
        console.error('Error fetching medication usage:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลการใช้ยาตามเวลา"
        });
    }
});

// API สำหรับข้อมูลการทานยารายวัน (สำหรับกราฟ)
app.get('/logs/daily', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // ดึงข้อมูลจำนวนการทานยาที่บันทึกในแต่ละวัน (7 วันย้อนหลัง)
        const [results] = await connection.promise().query(
            `SELECT 
                DATE(l.confirmed_at) as date,
                COUNT(*) as count
             FROM 
                logs l
                JOIN medications m ON l.medication_id = m.id
             WHERE 
                m.user_id = ? AND
                l.confirmed_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY 
                DATE(l.confirmed_at)
             ORDER BY 
                date ASC`,
            [userId]
        );
        
        res.json(results);
    } catch (error) {
        console.error('Error fetching daily logs:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลการทานยารายวัน"
        });
    }
});

// API สำหรับข้อมูลอัตราการทานยาตามกำหนดของวันนี้ (สำหรับกราฟ)
app.get('/adherence/today', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];
        
        // จำนวนยาทั้งหมดของผู้ใช้
        const [medResults] = await connection.promise().query(
            'SELECT COUNT(*) as total FROM medications WHERE user_id = ?',
            [userId]
        );
        
        // จำนวนยาที่ทานแล้ววันนี้
        const [logResults] = await connection.promise().query(
            `SELECT COUNT(DISTINCT l.medication_id) as taken 
             FROM logs l 
             JOIN medications m ON l.medication_id = m.id 
             WHERE m.user_id = ? AND DATE(l.confirmed_at) = ?`,
            [userId, today]
        );
        
        const total = medResults[0].total || 0;
        const taken = logResults[0].taken || 0;
        const pending = total - taken > 0 ? total - taken : 0;
        
        res.json({
            total,
            taken,
            pending,
            adherenceRate: total > 0 ? (taken / total) * 100 : 0
        });
    } catch (error) {
        console.error('Error fetching adherence data:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลอัตราการทานยา"
        });
    }
});
app.get('/test-db-connection', (req, res) => {
    connection.query('SELECT 1 + 1 AS result', (err, results) => {
        if (err) {
            return res.status(500).json({
                error: true,
                message: "ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้",
                details: err.message
            });
        }
        
        res.json({
            error: false,
            message: "เชื่อมต่อฐานข้อมูลสำเร็จ",
            result: results[0].result
        });
    });
});
// API เพิ่มข้อมูลยาตัวอย่างสำหรับผู้ใช้
app.get('/create-sample-data', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // ข้อมูลยาตัวอย่าง
        const sampleMedications = [
            {
                name: 'พาราเซตามอล',
                dosage: '500 mg',
                usage_instructions: 'ทานหลังอาหาร 3 เวลา',
                time_to_take: '08:00:00'
            },
            {
                name: 'วิตามินซี',
                dosage: '1000 mg',
                usage_instructions: 'ทานพร้อมอาหารเช้า',
                time_to_take: '07:30:00'
            },
            {
                name: 'ยาลดความดัน',
                dosage: '10 mg',
                usage_instructions: 'ทานก่อนอาหารเช้า 30 นาที',
                time_to_take: '07:00:00'
            },
            {
                name: 'ยานอนหลับ',
                dosage: '5 mg',
                usage_instructions: 'ทานก่อนนอน',
                time_to_take: '21:00:00'
            },
            {
                name: 'ยาแก้แพ้',
                dosage: '10 mg',
                usage_instructions: 'ทานเมื่อมีอาการแพ้',
                time_to_take: '12:00:00'
            }
        ];
        
        const medicationResults = [];
        
        // สร้างข้อมูลยา
        for (const med of sampleMedications) {
            const [result] = await connection.promise().query(
                `INSERT INTO medications (name, dosage, usage_instructions, time_to_take, user_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                [med.name, med.dosage, med.usage_instructions, med.time_to_take, userId]
            );
            
            medicationResults.push({
                id: result.insertId,
                ...med
            });
            
            // สร้างการแจ้งเตือนสำหรับยานี้
            await connection.promise().query(
                `INSERT INTO reminders (medication_id, reminder_time, notification_channel) 
                 VALUES (?, ?, ?)`,
                [result.insertId, med.time_to_take, 'application']
            );
            
            // สร้างประวัติการทานยา (ย้อนหลัง 5 วัน)
            for (let i = 0; i < 5; i++) {
                const logDate = new Date();
                logDate.setDate(logDate.getDate() - i);
                
                // สุ่มว่าจะบันทึกประวัติหรือไม่ (80% chance)
                if (Math.random() < 0.8) {
                    await connection.promise().query(
                        'INSERT INTO logs (medication_id, confirmed_at) VALUES (?, ?)',
                        [result.insertId, logDate]
                    );
                }
            }
        }
        
        res.json({
            error: false,
            message: "สร้างข้อมูลตัวอย่างสำเร็จ",
            medications: medicationResults
        });
    } catch (error) {
        console.error('Error creating sample data:', error);
        res.status(500).json({
            error: true,
            message: "เกิดข้อผิดพลาดในการสร้างข้อมูลตัวอย่าง"
        });
    }
});
// เริ่มต้นเซิร์ฟเวอร์
app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
module.exports = app;