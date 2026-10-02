const fs = require('fs');
const path = require('path');
const db = require('../lib/db');

const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0);

statements.forEach(statement => {
  try {
    db.exec(statement);
    console.log(`Executed: ${statement.substring(0, 50)}...`);
  } catch (err) {
    console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
    console.error(err);
  }
});

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const crypto = require('crypto');
  const senhaPadrao = process.env.SENHA_PADRAO;
  if (!senhaPadrao) {
    throw new Error('SENHA_PADRAO não definida: defina a variável de ambiente SENHA_PADRAO para criar o usuário admin inicial.');
  }
  const passwordHash = crypto.createHash('sha256').update(senhaPadrao).digest('hex');
  
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, papel)
    VALUES (?, ?, ?)
  `);
  insertUser.run('admin', passwordHash, 'diretoria');
  console.log('Inserted default admin user');
} else {
  console.log('Admin user already exists');
}

console.log('Database initialization complete');
