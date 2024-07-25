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

const rHOST = process.env.MYSQL_HOST;
const rUSER = process.env.MYSQL_USER;
const rPASSWORD = process.env.MYSQL_PASSWORD;
const rWDB = process.env.MYSQL_DATABASE_WAITLIST;
const DB_PORT = process.env.DB_PORT || 3306;

const DEV_TELEGRAM_ID = '806587050';
const DEFAULT_REFERRAL_CODE = 'DEFAULT_REFERRAL_CODE';

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

// Helper function to generate a random referral code and ensure its uniqueness
function generateReferralCode(callback) {
  const code = Math.random().toString(36).substr(2, 9);
  pool.query(
    'SELECT COUNT(*) AS count FROM waitlist WHERE referral_code = ?',
    [code],
    (err, results) => {
      if (err) {
        console.error('Error checking referral code uniqueness:', err);
        callback(err, null);
      } else if (results[0].count > 0) {
        generateReferralCode(callback); // Try again if not unique
      } else {
        callback(null, code);
      }
    }
  );
}

// Route to check if a Telegram ID has already filled the form
app.get('/fetchbytelegramid/:telegramId', (req, res) => {
  const { telegramId } = req.params;
  pool.query(
    'SELECT * FROM waitlist WHERE telegramId = ?',
    [telegramId],
    (err, result) => {
      if (err) {
        console.log('Error fetching user by Telegram ID:', err);
        res.status(500).send('Error fetching user by Telegram ID');
      } else {
        res.send(result);
      }
    }
  );
});

// Route to check the validity of a referral code
app.get('/checkreferralcode/:referralCode', (req, res) => {
  const { referralCode } = req.params;
  pool.query(
    'SELECT * FROM waitlist WHERE referral_code = ?',
    [referralCode],
    (err, result) => {
      if (err) {
        console.log('Error checking referral code:', err);
        res.status(500).send('Error checking referral code');
      } else {
        res.json({ valid: result.length > 0 });
      }
    }
  );
});

// Route to handle form submission
app.post('/post', (req, res) => {
  const { id, username, email, blockchain, address, telegramId, referredBy } =
    req.body;

  if (telegramId === DEV_TELEGRAM_ID) {
    // If it's the developer, use the DEV_REFERRAL_CODE
    pool.query(
      'INSERT INTO waitlist (username, email, blockchain, address, telegramId, referral_code, referral_count, referredby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        username,
        email,
        blockchain,
        address,
        telegramId,
        DEFAULT_REFERRAL_CODE,
        0,
        referredBy,
      ],
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
  } else {
    // Validate referredBy code if it's not DEFAULT_REFERRAL_CODE
    if (referredBy !== DEFAULT_REFERRAL_CODE) {
      pool.query(
        'SELECT * FROM waitlist WHERE referral_code = ?',
        [referredBy],
        (err, referrer) => {
          if (err) {
            console.error('Error checking referrer:', err);
            return res.status(500).send('Error checking referrer');
          }

          if (referrer.length === 0 || referrer[0].referral_count >= 20) {
            return res
              .status(400)
              .json({ error: 'Invalid or overused referral code' });
          }

          // Increment referral count
          const referralCount = referrer[0].referral_count + 1;
          pool.query(
            'UPDATE waitlist SET referral_count = ? WHERE referral_code = ?',
            [referralCount, referredBy],
            (err) => {
              if (err) {
                console.error('Error updating referral count:', err);
                return res.status(500).send('Error updating referral count');
              }
            }
          );
        }
      );
    }

    // Generate a unique referral code and insert the new user
    generateReferralCode((err, referralCode) => {
      if (err) {
        return res.status(500).send('Error generating referral code');
      }

      pool.query(
        'INSERT INTO waitlist (username, email, blockchain, address, telegramId, referral_code, referral_count, referredby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          username,
          email,
          blockchain,
          address,
          telegramId,
          referralCode,
          0,
          referredBy,
        ],
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
  }
});

app.listen(DB_PORT || 3306, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`On Port ${DB_PORT}`);
  }
});
