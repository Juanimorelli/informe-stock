import sql from 'mssql';

const sqlConfig = {
  user: process.env.DB_USER || 'biCN',
  password: process.env.DB_PASSWORD || 'c4mp0nu3v0!',
  database: process.env.DB_DATABASE || 'BaseCampoNuevo',
  server: process.env.DB_SERVER || 'ascomercial.dynalias.org',
  port: parseInt(process.env.DB_PORT || '24433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true,
    trustServerCertificate: true // necessary for older/self-signed certs
  }
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function connectToDatabase() {
  try {
    if (!poolPromise) {
      poolPromise = sql.connect(sqlConfig);
    }
    const pool = await poolPromise;
    if (pool) return pool;
    throw new Error('Connection pool is null or undefined');
  } catch (error) {
    console.error('Database connection failed!', error);
    poolPromise = null;
    throw error;
  }
}
