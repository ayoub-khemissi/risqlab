import mysql from 'mysql2';
import Config from '../utils/config.js';

const {
  RISQLAB_DB_HOST,
  RISQLAB_DB_PORT,
  RISQLAB_DB_USER,
  RISQLAB_DB_PASSWORD,
  RISQLAB_DB_DATABASE,
} = Config;

const pool = mysql.createPool({
  host: RISQLAB_DB_HOST,
  port: RISQLAB_DB_PORT,
  user: RISQLAB_DB_USER,
  password: RISQLAB_DB_PASSWORD,
  database: RISQLAB_DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

export default pool.promise();
