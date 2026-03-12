require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const port = process.env.PORT || 5000;
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ia ad dja dd abdadsafdfbhjfbafhabfj';
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000/",
  credentials: true
};
app.use(cors(corsOptions));

// app.use(cors());
app.use(express.json());
app.listen(port, () => { console.log(`Server running on port ${port}`); });


const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    try {
        const cleanToken = token.split(' ')[1] || token;
        const decoded = jwt.verify(cleanToken, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.json({ error: 'Invalid token' });
    }
};

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ error: 'username and password required' });

        const exists = await pool.query('SELECT user_id FROM users WHERE username = $1', [username]);
        if (exists.rows.length) return res.json({ error: 'User already exists' });

        const hashed = await bcrypt.hash(password, 10);
        const newUser = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING user_id, username', [username, hashed]);

        const user = { id: newUser.rows[0].user_id, username: newUser.rows[0].username };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});


app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ error: 'username and password required' });

        const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (!userRes.rows.length) return res.json({ error: 'Invalid credentials' });

        const user = userRes.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ error: 'Invalid credentials' });

        const payload = { id: user.user_id, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});



app.post('/todos', verifyToken, async (req, res) => {
    try {
        const { description } = req.body;
        const newTodo = await pool.query(
            'INSERT INTO todo (description, user_id) VALUES ($1, $2) RETURNING *',
            [description, req.user.id]
        );
        res.json(newTodo.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});


app.get('/todos', verifyToken, async (req, res) => {
    try {
        const allTodos = await pool.query('SELECT * FROM todo WHERE user_id = $1', [req.user.id]);
        res.json(allTodos.rows);
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});


app.get('/todos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const todo = await pool.query('SELECT * FROM todo WHERE todo_id = $1 AND user_id = $2', [id, req.user.id]);
        if (!todo.rows.length) return res.json({ error: 'Not found' });
        res.json(todo.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});

app.put('/todos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;
        const result = await pool.query('UPDATE todo SET description = $1 WHERE todo_id = $2 AND user_id = $3 RETURNING *', [description, id, req.user.id]);
        if (!result.rows.length) return res.json({ error: 'Not found or not authorized' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});


app.delete('/todos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const del = await pool.query('DELETE FROM todo WHERE todo_id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
        if (!del.rows.length) return res.json({ error: 'Not found or not authorized' });
        res.json({ message: 'todo deleted' });
    } catch (err) {
        console.error(err.message);
        res.json({ error: 'Server error' });
    }
});




// app.get('/tshirt', (req, res) => {res.status(200).send('T-Shirt endpoint');});
// app.post('/tshirt/:id', (req, res) => {
//     const {id} = req.params;
//     const {logo}= req.body;
//     if (!logo) {
//         return res.status(400).send('Logo is required');
//     }
//     console.log(`Creating T-Shirt with ID: ${id} and Logo: ${logo}`);
//     // res.status(201).send('T-Shirt created');});
//     ;});
