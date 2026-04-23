require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function main(){
  const username = process.env.INIT_ADMIN_USERNAME || 'superadmin';
  const password = process.env.INIT_ADMIN_PASSWORD || 'AdminPass123!';
  const contact = process.env.INIT_ADMIN_CONTACT || '0710000000';

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { contact }] } });
  if(existing){
    console.log('Admin already exists:', existing.id);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data:{
      firstName: 'Super',
      lastName: 'Admin',
      username,
      nicNumber: '',
      contact,
      whatsapp: contact,
      address: 'Head Office',
      password: hashed,
      role: 'admin'
    }
  });
  console.log('Created admin id=', admin.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
