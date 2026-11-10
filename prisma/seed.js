require('dotenv').config();
const bcrypt = require('bcrypt');
const { prisma } = require('../db');

const DEFAULT_SETTINGS = {
  main_url_lao: 'https://withdraw.r1auto4567.com',
  main_url_thai: 'https://withdraw.r1auto4567.com',
  upload_file_url: 'https://withdraw.r1auto4567.com/upload/upload_file',
};

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},          // don't overwrite admin-edited values on re-seed
      create: { key, value },
    });
  }

  const username = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!username || !pass) throw new Error('ADMIN_USER / ADMIN_PASS env required to seed admin');
  await prisma.appUser.upsert({
    where: { username },
    update: {},            // don't reset password on re-seed
    create: { username, passwordHash: bcrypt.hashSync(pass, 10), role: 'admin' },
  });

  const settings = await prisma.setting.count();
  const users = await prisma.appUser.count();
  console.log(`seed ok: ${settings} settings, ${users} user(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
