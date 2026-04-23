require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');

async function createUserIfNotExists({ username, password, role, firstName, lastName, contact }) {
  const existing = await db.query('SELECT id,username FROM `user` WHERE username = ? OR contact = ? LIMIT 1', [username, contact]);
  if (existing && existing.length > 0) {
    console.log(`${role} already exists:`, existing[0].username || existing[0].id);
    return existing[0];
  }
  const hashed = await bcrypt.hash(password, 10);
  const result = await db.execute(
    'INSERT INTO `user` (username,firstName,lastName,nicNumber,contact,whatsapp,address,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
    [username, firstName || username, lastName || '', null, contact || '', contact || '', '', hashed, role]
  );
  console.log(`Created ${role}:`, username || result.insertId);
  return { id: result.insertId, username };
}

async function main() {
  // Admin
  const admin = await createUserIfNotExists({ username: 'admin', password: 'admin123', role: 'admin', firstName: 'Admin', lastName: 'User', contact: '0700000000' });

  // Owner
  const owner = await createUserIfNotExists({ username: 'manager', password: 'manager123', role: 'owner', firstName: 'Manager', lastName: 'User', contact: '0700000001' });

  // Staff under owner
  const staffExists = await db.query('SELECT id FROM `user` WHERE username = ? LIMIT 1', ['staff']);
  if (staffExists && staffExists.length > 0) {
    console.log('staff already exists:', 'staff');
  } else {
    const hashed = await bcrypt.hash('staff123', 10);
    await db.execute(
      'INSERT INTO `user` (username,firstName,lastName,nicNumber,contact,whatsapp,address,password,role,ownerId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      ['staff', 'Staff', 'User', null, '0700000002', '0700000002', '', hashed, 'staff', owner.id]
    );
    console.log('Created staff:', 'staff');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
