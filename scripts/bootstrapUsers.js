require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function createUserIfNotExists({ username, password, role, firstName, lastName, contact }) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { contact }] } });
  if (existing) {
    console.log(`${role} already exists:`, existing.username || existing.id);
    return existing;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      firstName: firstName || username,
      lastName: lastName || '',
      nicNumber: null,
      contact: contact || '',
      whatsapp: contact || '',
      address: '',
      password: hashed,
      role,
    },
  });
  console.log(`Created ${role}:`, user.username || user.id);
  return user;
}

async function main() {
  // Admin
  const admin = await createUserIfNotExists({ username: 'admin', password: 'admin123', role: 'admin', firstName: 'Admin', lastName: 'User', contact: '0700000000' });

  // Owner
  const owner = await createUserIfNotExists({ username: 'manager', password: 'manager123', role: 'owner', firstName: 'Manager', lastName: 'User', contact: '0700000001' });

  // Staff under owner
  const staffExists = await prisma.user.findFirst({ where: { username: 'staff' } });
  if (staffExists) {
    console.log('staff already exists:', staffExists.username);
  } else {
    const hashed = await bcrypt.hash('staff123', 10);
    const staff = await prisma.user.create({
      data: {
        username: 'staff',
        firstName: 'Staff',
        lastName: 'User',
        nicNumber: null,
        contact: '0700000002',
        whatsapp: '0700000002',
        address: '',
        password: hashed,
        role: 'staff',
        ownerId: owner.id,
      }
    });
    console.log('Created staff:', staff.username);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
