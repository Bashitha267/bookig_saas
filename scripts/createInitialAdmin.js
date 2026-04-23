require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');

async function main(){
  const username = process.env.INIT_ADMIN_USERNAME || 'superadmin';
  const password = process.env.INIT_ADMIN_PASSWORD || 'AdminPass123!';
  const contact = process.env.INIT_ADMIN_CONTACT || '0710000000';

  const existing = await db.query('SELECT id FROM `user` WHERE username = ? OR contact = ? LIMIT 1', [username, contact]);
  if (existing && existing.length > 0) {
    console.log('Admin already exists:', existing[0].id);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await db.execute(
    'INSERT INTO `user` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
    ['Super', 'Admin', username, '', contact, contact, 'Head Office', hashed, 'admin']
  );
  console.log('Created admin id=', result.insertId);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
