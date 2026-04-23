import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============================================================
  // 1. FIRST TENANT — JMO Carpentry
  // ============================================================
  console.log('🏢 Creating first company (tenant)...');

  const jmoCompany = await prisma.company.upsert({
    where: { slug: 'jmo' },
    update: {},
    create: {
      name: 'JMO Carpentry',
      slug: 'jmo',
      website: null,
      baseAddress: 'Boston, MA',
      baseLatitude: 42.3601,
      baseLongitude: -71.0589,
      maxDistanceMiles: 100,
      isActive: true,
    },
  });
  console.log(`  ✓ Company created: ${jmoCompany.name} (slug: ${jmoCompany.slug})`);

  // ============================================================
  // 2. MODULES — Global (shared across all companies)
  // ============================================================
  console.log('\n📦 Creating modules...');

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
    console.log(`  ✓ Module: ${mod.name}`);
  }

  // ============================================================
  // 3. ROLES — Global (shared across all companies)
  // ============================================================
  console.log('\n👤 Creating roles...');

  const roles = [
    { name: 'Admin',           description: 'Full access to all modules',               isSystem: true },
    { name: 'Estimator',       description: 'Access to Bid, Takeoff, Estimate modules', isSystem: true },
    { name: 'Project Manager', description: 'Access to Contract, Execution, Financial', isSystem: true },
    { name: 'Field Worker',    description: 'Limited access to Execution module only',  isSystem: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`  ✓ Role: ${role.name}`);
  }

  // ============================================================
  // 4. ADMIN USER — Andre's account, scoped to JMO
  // ============================================================
  console.log('\n🔐 Creating admin user (JMO)...');

  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  if (!adminRole) throw new Error('Admin role not found');

  const passwordHash = await bcrypt.hash('Admin AWG 123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'andre.tremura@awgconstructions.com' },
    update: {},
    create: {
      email: 'andre.tremura@awgconstructions.com',
      name: 'Andre Tremura',
      passwordHash,
      roleId: adminRole.id,
      companyId: jmoCompany.id,
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user: ${adminUser.email}`);

  // ============================================================
  // 5. ADMIN PERMISSIONS — Full access to all modules
  // ============================================================
  console.log('\n🔓 Granting admin permissions...');

  const allModules = await prisma.module.findMany();
  for (const mod of allModules) {
    await prisma.userModulePermission.upsert({
      where: { userId_moduleId: { userId: adminUser.id, moduleId: mod.id } },
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
    console.log(`  ✓ Full access: ${mod.name}`);
  }

  // ============================================================
  // 6. SYSTEM SETTINGS — Scoped to JMO
  // ============================================================
  console.log('\n⚙️  Creating JMO system settings...');

  const settings = [
    { key: 'preferred_work_types', value: 'Finish Carpentry, Siding, Sheet Metal', description: 'Comma-separated list of preferred work types' },
    { key: 'ai_auto_analyze',      value: 'true',                                   description: 'Whether AI should automatically analyze new bids on arrival' },
    { key: 'auto_create_bids',     value: 'false',                                  description: 'Whether to auto-create bids from Gmail sync (requires min confidence + state match)' },
    { key: 'auto_min_confidence',  value: '70',                                     description: 'Minimum AI confidence (0-100) required to auto-create bids' },
    { key: 'auto_allowed_states',  value: 'MA, NH, RI, CT, VT, ME',                 description: 'Comma-separated US state codes eligible for auto-create' },
    { key: 'auto_qualified_status',value: 'qualified',                              description: 'Status assigned to auto-created bids that pass rules (new or qualified)' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId: jmoCompany.id, key: setting.key } },
      update: {},
      create: { ...setting, companyId: jmoCompany.id },
    });
    console.log(`  ✓ Setting: ${setting.key}`);
  }

  console.log('\n✅ Seed completed!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏢 First company: JMO Carpentry (slug: jmo)');
  console.log('🔑 Admin login:');
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
