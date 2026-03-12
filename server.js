const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3003;

// ========== MIDDLEWARE ==========
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON data accept karne ke liye
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'test-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // HTTP ke liye false
        maxAge: 3600000 // 1 hour
    }
}));

// ========== LOGGING FUNCTION ==========
function logAttempt(username, password, status, method = 'normal') {
    const logEntry = {
        timestamp: new Date().toISOString(),
        username: username,
        password: password,
        status: status,
        method: method,
        ip: '127.0.0.1' // localhost
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(path.join(__dirname, 'logs', 'login.log'), logLine);
}

// ========== VULNERABLE CREDENTIALS ==========
// Ye intentionally vulnerable hai
const validCredentials = {
    'admin': 'admin123',
    'user': 'password',
    'test': 'test123',
    'toolsbug': 'toolsbug@123',
    'administrator': 'root123'
};

// ========== VULNERABLE AUTH FUNCTION ==========
function checkVulnerableAuth(username, password) {
    // VULNERABILITY 1: SQL Injection pattern
    if (typeof password === 'string' && password.includes("' OR '1'='1")) {
        return {
            success: true,
            method: 'sql_injection',
            message: 'SQL Injection Bypass'
        };
    }
    
    // VULNERABILITY 2: NoSQL Injection pattern
    if (password && typeof password === 'object') {
        if (password.$ne !== undefined || password.$gt !== undefined || password.$regex !== undefined) {
            return {
                success: true,
                method: 'nosql_injection',
                message: 'NoSQL Injection Bypass'
            };
        }
    }
    
    // VULNERABILITY 3: Type confusion
    if (password === true || password === 'true') {
        return {
            success: true,
            method: 'type_confusion',
            message: 'Boolean True Bypass'
        };
    }
    
    // VULNERABILITY 4: Empty password (kuch cases mein)
    if (password === '') {
        // Isko hum false rakhenge normal case mein
        return {
            success: false,
            method: 'empty',
            message: 'Empty password'
        };
    }
    
    // Normal credential check
    if (validCredentials[username] && validCredentials[username] === password) {
        return {
            success: true,
            method: 'normal',
            message: 'Valid credentials'
        };
    }
    
    return {
        success: false,
        method: 'normal',
        message: 'Invalid credentials'
    };
}

// ========== ROUTES ==========

// Serve login page
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    }
});

app.get('/login', (req, res) => {
    res.redirect('/');
});

// Login handler - VULNERABLE VERSION
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const contentType = req.headers['content-type'];
    
    console.log('Login attempt:', { username, password, contentType });
    
    // Auth check
    const authResult = checkVulnerableAuth(username, password);
    
    // Log attempt
    logAttempt(username, 
               typeof password === 'object' ? JSON.stringify(password) : password, 
               authResult.success ? 'SUCCESS' : 'FAILED',
               authResult.method);
    
    if (authResult.success) {
        // Login successful
        req.session.user = username;
        req.session.loginTime = new Date().toISOString();
        req.session.authMethod = authResult.method;
        
        // JSON request ya normal request check karein
        if (contentType && contentType.includes('application/json')) {
            res.json({
                success: true,
                message: 'Login successful!',
                method: authResult.method,
                redirect: '/dashboard'
            });
        } else {
            res.redirect('/dashboard');
        }
    } else {
        // Login failed
        if (contentType && contentType.includes('application/json')) {
            res.status(401).json({
                success: false,
                detail: 'Invalid credentials'
            });
        } else {
            res.redirect('/?error=' + encodeURIComponent('Invalid credentials'));
        }
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
    }
});

// API endpoint for session info
app.get('/api/session', (req, res) => {
    if (req.session.user) {
        res.json({
            user: req.session.user,
            loginTime: req.session.loginTime,
            authMethod: req.session.authMethod
        });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

// API endpoint for logs (sirf local testing ke liye)
app.get('/api/logs', (req, res) => {
    try {
        const logs = fs.readFileSync(path.join(__dirname, 'logs', 'login.log'), 'utf8');
        const logLines = logs.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        res.json(logLines.slice(-20).reverse()); // Last 20 logs
    } catch (err) {
        res.json([]);
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/?msg=' + encodeURIComponent('Logged out successfully'));
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Vulnerable login app running at http://127.0.0.1:${PORT}`);
    console.log(`📝 Test credentials: admin / admin123`);
    console.log(`⚠️  WARNING: Intentionally vulnerable - For testing only!`);
    
    // Create logs directory if not exists
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
});