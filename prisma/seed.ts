import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============================================================
  // 1. MODULES - All 6 modules of the CRM
  // ============================================================
  console.log('📦 Creating modules...');

  const modules = [
    { slug: 'bid',       name: 'Bid Management',     description: 'Capture and pre-analyze incoming bids' },
    { slug: 'takeoff',   name: 'Takeoff',            description: 'Extract quantities and measurements from projects' },
    { slug: 'estimate',  name: 'Estimate',           description: 'Create detailed estimates and proposals' },
    { slug: 'contract',  name: 'Contract',           description: 'Contract analysis, signature and subcontracts' },
    { slug: 'execution', name: 'Project Execution',  description: 'WBS, progress tracking, change orders, field work' },
    { slug: 'financial', name: 'Financial',          description: 'Billing, measurements, subcontractor payments' },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { slug: mod.slug },
      update: {},
      create: mod,
    });
    console.log(`  ✓ Module created: ${mod.name}`);
  }

  // ============================================================
  // 2. ROLES - System roles
  // ============================================================
  console.log('\n👤 Creating roles...');

  const roles = [
    { name: 'Admin',        description: 'Full access to all modules',               isSystem: true },
    { name: 'Estimator',    description: 'Access to Bid, Takeoff, Estimate modules', isSystem: true },
    { name: 'Project Manager', description: 'Access to Contract, Execution, Financial', isSystem: true },
    { name: 'Field Worker', description: 'Limited access to Execution module only',   isSystem: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`  ✓ Role created: ${role.name}`);
  }

  // ============================================================
  // 3. ADMIN USER - Andre's account
  // ============================================================
  console.log('\n🔐 Creating admin user...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });

  if (!adminRole) {
    throw new Error('Admin role not found');
  }

  const passwordHash = await bcrypt.hash('Admin AWG 123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'andre.tremura@awgconstructions.com' },
    update: {},
    create: {
      email: 'andre.tremura@awgconstructions.com',
      name: 'Andre Tremura',
      passwordHash: passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log(`  ✓ Admin user created: ${adminUser.email}`);

  // ============================================================
  // 4. ADMIN PERMISSIONS - Full access to all modules
  // ============================================================
  console.log('\n🔓 Setting admin permissions...');

  const allModules = await prisma.module.findMany();

  for (const mod of allModules) {
    await prisma.userModulePermission.upsert({
      where: {
        userId_moduleId: {
          userId: adminUser.id,
          moduleId: mod.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        moduleId: mod.id,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
    });
    console.log(`  ✓ Full access granted for: ${mod.name}`);
  }

  // ============================================================
  // 5. SYSTEM SETTINGS - Global config (Boston base, etc)
  // ============================================================
  console.log('\n⚙️  Creating system settings...');

  const settings = [
    {
      key: 'base_address',
      value: 'Boston, MA',
      description: 'Reference address for distance calculations (employees live around Boston)',
    },
    {
      key: 'base_latitude',
      value: '42.3601',
      description: 'Latitude of the base reference point (Boston)',
    },
    {
      key: 'base_longitude',
      value: '-71.0589',
      description: 'Longitude of the base reference point (Boston)',
    },
    {
      key: 'max_distance_miles',
      value: '100',
      description: 'Maximum acceptable distance in miles from base for bid pre-qualification',
    },
    {
      key: 'company_name',
      value: 'AWG Construction',
      description: 'Company name for display in proposals and contracts',
    },
    {
      key: 'company_website',
      value: 'awgconstructions.com',
      description: 'Company website',
    },
    {
      key: 'ai_auto_analyze',
      value: 'true',
      description: 'Whether AI should automatically analyze new bids on arrival',
    },
    {
      key: 'preferred_work_types',
      value: 'Finish Carpentry, Siding, Sheet Metal',
      description: 'Comma-separated list of preferred work types',
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
    console.log(`  ✓ Setting created: ${setting.key}`);
  }

  console.log('\n✅ Seed completed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Admin login credentials:');
  console.log('   Email:    andre.tremura@awgconstructions.com');
  console.log('   Password: Admin AWG 123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });