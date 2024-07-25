const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
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

const {
  MYSQL_HOST: rHOST,
  MYSQL_USER: rUSER,
  MYSQL_PASSWORD: rPASSWORD,
  MYSQL_DATABASE_WAITLIST: rWDB,
  DB_PORT = 3306,
} = process.env;

const DEV_TELEGRAM_ID = '806587050';
const DEFAULT_REFERRAL_CODE = 'DEFAULT_REFERRAL_CODE';

const pool = mysql.createPool({
  host: rHOST,
  user: rUSER,
  password: rPASSWORD,
  database: rWDB,
  port: DB_PORT,
});

pool
  .getConnection()
  .then((connection) => {
    console.log(`Connected to: ${connection.config.database}`);
    connection.release();
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });

async function generateReferralCode() {
  let isUnique = false;
  let code;

  while (!isUnique) {
    code = Math.random().toString(36).substr(2, 9);
    const [results] = await pool.query(
      'SELECT COUNT(*) AS count FROM waitlist WHERE referral_code = ?',
      [code]
    );
    isUnique = results[0].count === 0;
  }

  return code;
}

app.get('/fetchbytelegramid/:telegramId', async (req, res) => {
  const { telegramId } = req.params;
  try {
    const [result] = await pool.query(
      'SELECT * FROM waitlist WHERE telegramId = ?',
      [telegramId]
    );
    if (result.length > 0) {
      const user = result[0];
      const [referralResult] = await pool.query(
        'SELECT COUNT(*) AS referral_count FROM waitlist WHERE referredby = ?',
        [user.referral_code]
      );
      user.referral_count = referralResult[0].referral_count;
      res.send(user);
    } else {
      res.send([]);
    }
  } catch (err) {
    console.error('Error fetching user by Telegram ID:', err);
    res.status(500).send('Error fetching user by Telegram ID');
  }
});

app.get('/checkreferralcode/:referralCode', async (req, res) => {
  const { referralCode } = req.params;
  try {
    const [result] = await pool.query(
      'SELECT * FROM waitlist WHERE referral_code = ?',
      [referralCode]
    );
    res.json({ valid: result.length > 0 });
  } catch (err) {
    console.error('Error checking referral code:', err);
    res.status(500).send('Error checking referral code');
  }
});

app.post('/post', async (req, res) => {
  const { id, username, email, blockchain, address, telegramId, referredBy } =
    req.body;

  try {
    let referralCode = await generateReferralCode();
    let referrer = referredBy || DEFAULT_REFERRAL_CODE;

    // Check if the referredBy code is valid
    if (referredBy && referredBy !== DEFAULT_REFERRAL_CODE) {
      const [referrerCheck] = await pool.query(
        'SELECT * FROM waitlist WHERE referral_code = ?',
        [referredBy]
      );

      if (referrerCheck.length === 0 || referrerCheck[0].referral_count >= 20) {
        return res
          .status(400)
          .json({ error: 'Invalid or overused referral code' });
      }
      referrer = referrerCheck[0].referral_code;
    }

    await pool.query(
      'INSERT INTO waitlist (username, email, blockchain, address, telegramId, referral_code, referral_count, referredby, referral_reward_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        null,
        username,
        email,
        blockchain,
        address,
        telegramId,
        referralCode,
        0,
        referrer,
        500,
      ] // New user gets 500 points
    );

    // Update referral count and reward points for the referrer
    await pool.query(
      'UPDATE waitlist SET referral_count = referral_count + 1, referral_reward_point = referral_reward_point + 1000 WHERE referral_code = ?',
      [referrer]
    );

    console.log('A New User Joined The Database');
    res.send('Success! You have joined the waitlist.');
  } catch (err) {
    console.error('Error handling form submission:', err);
    res.status(500).send('Error handling form submission');
  }
});

app.put('/updatereferralreward', async (req, res) => {
  const { referralCode, points } = req.body;
  try {
    await pool.query(
      'UPDATE waitlist SET referral_reward_point = referral_reward_point + ? WHERE referral_code = ?',
      [points, referralCode]
    );
    res.send('Referral reward points updated successfully.');
  } catch (err) {
    console.error('Error updating referral reward points:', err);
    res.status(500).send('Error updating referral reward points');
  }
});

app.get('/getreferralcount/:referralCode', async (req, res) => {
  const { referralCode } = req.params;
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) AS count FROM waitlist WHERE referredby = ?',
      [referralCode]
    );
    res.json({ count: result[0].count });
  } catch (err) {
    console.error('Error getting referral count:', err);
    res.status(500).send('Error getting referral count');
  }
});

app.listen(DB_PORT, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Server running on port ${DB_PORT}`);
  }
});
