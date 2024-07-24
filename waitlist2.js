const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config({ path: 'C:/Users/HP/localprojects/backend/.env' });

const app = express();
app.use(express.json());

const allowedOrigins = [
  'https://miniapptest.web.app',
  'https://miniapp3test.web.app',
  'https://web.telegram.org',
  'https://telegram.org',
  'http://localhost:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// app.use(cors());

const rHOST = process.env.MYSQL_HOST;
const rUSER = process.env.MYSQL_USER;
const rPASSWORD = process.env.MYSQL_PASSWORD;
const rWDB = process.env.MYSQL_DATABASE_WAITLIST;
const DB_PORT = process.env.DB_PORT || 3306;

const pool = mysql.createPool({
  host: rHOST,
  user: rUSER,
  password: rPASSWORD,
  database: rWDB,
  port: DB_PORT,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.log('Error connecting to the database:', err);
  } else {
    console.log(`Connected to: ${connection.config.database}`);
    connection.release();
  }
});

app.post('/post', (req, res) => {
  const { id, username, email, blockchain, address } = req.body;
  console.log('Received POST request with data:', req.body);

  pool.query(
    'INSERT INTO waitlist (username, email, blockchain, address) VALUES (?, ?, ?, ?, ?)',
    [null, username, email, blockchain, address],
    (err, result) => {
      if (err) {
        console.log('Error inserting user:', err);
        res.status(500).send('Error inserting user');
      } else {
        res.send('POSTED');
        console.log('A New User Joined The Database');
      }
    }
  );
});

app.get('/fetchbyid/:id', (req, res) => {
  const fetchId = req.params.id;
  pool.query(
    'SELECT * FROM waitlist WHERE id = ?',
    [fetchId],
    (err, result) => {
      if (err) {
        console.log('Error fetching user by ID:', err);
        res.status(500).send('Error fetching user by ID');
      } else {
        res.send(result);
      }
    }
  );
});

app.listen(DB_PORT || 3306, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`On Port ${DB_PORT}`);
  }
});
