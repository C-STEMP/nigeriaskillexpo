import { PrismaClient, RoleScope, UserType, EvidenceTypeEnum, CompetitionCycleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ZONES_AND_STATES } from "./geography";
import { SECTORS } from "./sectors";

const prisma = new PrismaClient();

async function seedGeography() {
  console.log("Seeding zones and states...");
  for (const [zoneName, states] of Object.entries(ZONES_AND_STATES)) {
    const zone = await prisma.zone.upsert({
      where: { name: zoneName },
      update: {},
      create: { name: zoneName },
    });
    for (const stateName of states) {
      await prisma.state.upsert({
        where: { name: stateName },
        update: { zoneId: zone.id },
        create: { name: stateName, zoneId: zone.id },
      });
    }
  }
}

async function seedSectors() {
  console.log("Seeding starting sectors (trades left empty for admin to fill)...");
  for (const name of SECTORS) {
    await prisma.sector.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function seedEvidenceTypes() {
  console.log("Seeding evidence types...");
  for (const name of Object.values(EvidenceTypeEnum)) {
    await prisma.evidenceType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

/**
 * Roles table. Each (name, scope) pair is its own row, per the extensible
 * Role model. Capability flags (canCreate/canEdit/canDelete) default to
 * true for every working role EXCEPT Observer_Admin, which is the one
 * deliberately read-only role.
 */
async function seedRoles() {
  console.log("Seeding role definitions...");
  const roleDefs: { name: UserType; scope: RoleScope; readOnly?: boolean }[] = [
    { name: UserType.Super_Admin, scope: RoleScope.Overall },
    { name: UserType.Observer_Admin, scope: RoleScope.Overall, readOnly: true },
    { name: UserType.National_Admin, scope: RoleScope.National },
    { name: UserType.National_Assessor, scope: RoleScope.National },
    { name: UserType.National_Moderator, scope: RoleScope.National },
    { name: UserType.Zonal_Admin, scope: RoleScope.Zonal },
    { name: UserType.Zonal_Assessor, scope: RoleScope.Zonal },
    { name: UserType.Zonal_Moderator, scope: RoleScope.Zonal },
    { name: UserType.State_Assessor, scope: RoleScope.State },
    { name: UserType.State_Moderator, scope: RoleScope.State },
  ];

  for (const def of roleDefs) {
    await prisma.role.upsert({
      where: { name_scope: { name: def.name, scope: def.scope } },
      update: {},
      create: {
        name: def.name,
        scope: def.scope,
        canCreate: !def.readOnly,
        canEdit: !def.readOnly,
        canDelete: !def.readOnly,
      },
    });
  }
}

/**
 * A single bootstrap Super_Admin so there's a way INTO the system on a
 * fresh database — without this, nobody could ever create the first
 * registration code or appoint the first zonal admin.
 *
 * IMPORTANT: change this password immediately after first login in any
 * real deployment. It's read from env vars with a clearly-fake fallback
 * specifically so a forgotten default can't silently ship to production
 * unnoticed — if SEED_SUPER_ADMIN_EMAIL/PASSWORD aren't set, this prints
 * a loud warning.
 */
async function seedBootstrapSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "\n⚠️  SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set in .env — skipping bootstrap Super_Admin creation.\n" +
        "   Set both and re-run `npx prisma db seed` to create your first admin account.\n"
    );
    return;
  }

  console.log(`Seeding bootstrap Super_Admin (${email})...`);
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: {},
    create: {
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      country: "Nigeria",
    },
  });

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { name_scope: { name: UserType.Super_Admin, scope: RoleScope.Overall } },
  });

  // zoneId is NULL for Super_Admin, and MySQL's unique index does not
  // de-duplicate NULLs (see schema.prisma note on UserRole) — so this
  // must be a manual check-then-create, not a DB-level upsert.
  const existingGrant = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: superAdminRole.id, zoneId: null, revokedAt: null },
  });
  if (!existingGrant) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: superAdminRole.id } });
  }
}

/** An empty Draft cycle so the admin has something to configure on first login. */
async function seedDraftCycle() {
  const year = new Date().getFullYear();
  console.log(`Seeding draft competition cycle for ${year}...`);
  await prisma.competitionCycle.upsert({
    where: { year },
    update: {},
    create: {
      year,
      title: `ElimiExpo ${year} Skills Excellence Awards`,
      status: CompetitionCycleStatus.Draft,
    },
  });
}

async function main() {
  await seedGeography();
  await seedSectors();
  await seedEvidenceTypes();
  await seedRoles();
  await seedBootstrapSuperAdmin();
  await seedDraftCycle();
  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
