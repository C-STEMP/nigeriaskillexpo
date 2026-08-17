/**
 * DEMO DATA SEED — populates the database as though a full competition
 * cycle has already been conducted this year, so you can explore
 * promote/edit/delete/update flows against real, internally-consistent
 * data instead of an empty shell.
 *
 * This is SEPARATE from prisma/seed/index.ts (the baseline seed — zones,
 * states, sectors, roles, evidence types, bootstrap Super Admin). Run the
 * baseline seed FIRST, then this one:
 *
 *   npx prisma db seed                  (baseline — idempotent, safe to re-run)
 *   npx tsx prisma/seed/demo-data.ts    (this file — creates a full demo cycle)
 *
 * This file is intentionally NOT wired into `prisma db seed` (the
 * package.json "prisma".seed key), because you don't want demo data
 * created every time you reset your dev database — only when you
 * explicitly ask for it.
 *
 * SCOPE: rather than trying to populate all 10 sectors x 37 states (slow,
 * and not necessary to exercise every feature), this creates a genuinely
 * complete story for 2 sectors — ICT and Building Construction — fully
 * scored and promoted State -> Zonal -> National, across all 6 zones so
 * the "top 3 per zone -> national" comparison is real and meaningful.
 * Every other sector gets light registration data so the Applicants
 * directory and category breakdowns look populated too, without those
 * sectors being fully scored/promoted — that's on purpose so you have
 * something left to *try* running through promotion yourself.
 */

import {
  PrismaClient,
  UserType,
  RoleScope,
  ApplicantCategory,
  Gender,
  CriterionScope,
  CriterionLevel,
  CriterionStatus,
  CompetitionCycleStatus,
  AssessmentLevel,
  ModerationCaseStatus,
  AwardEntityType,
  ConversationKind,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { grantRole } from "../../src/server/services/roles";
import {
  recomputeTradeEntryTotal,
  computeStateSectorResult,
  promoteStateToZonal,
  promoteZonalToNational,
} from "../../src/server/services/promotion-engine";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "Demo@12345"; // every demo account uses this password
let demoPasswordHash: string;

const FIRST_NAMES = [
  "Amaka", "Chinedu", "Ngozi", "Emeka", "Fatima", "Ibrahim", "Blessing", "Tunde",
  "Aisha", "Segun", "Chiamaka", "Yusuf", "Grace", "Oluwaseun", "Zainab", "Kelechi",
  "Halima", "Femi", "Adaeze", "Musa", "Onyeka", "Rasheed", "Funmilayo", "Chukwuemeka",
  "Hauwa", "Damilola", "Uche", "Sadiq", "Ijeoma", "Abdullahi",
];
const LAST_NAMES = [
  "Okafor", "Bello", "Eze", "Abubakar", "Adeyemi", "Nwosu", "Mohammed", "Okonkwo",
  "Ibrahim", "Adebayo", "Chukwu", "Suleiman", "Okoro", "Yakubu", "Ogunleye", "Musa",
  "Nnamdi", "Balogun", "Ahmed", "Obi",
];
const ORG_SUFFIXES = ["Skills Institute", "Vocational Academy", "Technical Centre", "Training College", "Polytechnic Extension"];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function randomName() {
  return { firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES) };
}
let emailCounter = 0;
function uniqueEmail(prefix: string) {
  emailCounter += 1;
  return `${prefix}.${emailCounter}@demo.elimiexpo.test`;
}

// Realistic-ish score generator: returns a score biased around a "skill
// level" per entry so results aren't uniformly random noise — some
// trainees/states are consistently strong, some consistently weak, which
// makes the resulting rankings feel like a real competition rather than
// random static.
function biasedScore(maxScore: number, skillLevel: number) {
  // skillLevel: 0.0 (weak) to 1.0 (excellent)
  const base = maxScore * (0.4 + skillLevel * 0.5); // 40%-90% baseline
  const noise = (Math.random() - 0.5) * maxScore * 0.15; // +/-7.5% noise
  return Math.max(0, Math.min(maxScore, Math.round((base + noise) * 100) / 100));
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Competition cycle — mark this year's cycle as fully underway
// ─────────────────────────────────────────────────────────────────────────

async function setupCycle() {
  const year = new Date().getFullYear();
  console.log(`Setting up competition cycle ${year} as Open (fully underway)...`);

  const sectors = await prisma.sector.findMany();
  const cycle = await prisma.competitionCycle.upsert({
    where: { year },
    update: {
      status: CompetitionCycleStatus.Open,
      registrationOpensAt: new Date(new Date().getFullYear(), 0, 15),
      registrationClosesAt: new Date(new Date().getFullYear(), 2, 15),
    },
    create: {
      year,
      title: `ElimiExpo ${year} Skills Excellence Awards`,
      status: CompetitionCycleStatus.Open,
      registrationOpensAt: new Date(new Date().getFullYear(), 0, 15),
      registrationClosesAt: new Date(new Date().getFullYear(), 2, 15),
    },
  });

  for (const sector of sectors) {
    await prisma.cycleSectorOffering.upsert({
      where: { cycleId_sectorId: { cycleId: cycle.id, sectorId: sector.id } },
      update: { enabled: true },
      create: { cycleId: cycle.id, sectorId: sector.id, enabled: true },
    });
  }

  return cycle;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Trades
// ─────────────────────────────────────────────────────────────────────────

const FOCUS_SECTOR_TRADES: Record<string, string[]> = {
  ICT: ["Web Development", "Computer Hardware Maintenance", "Networking & Cybersecurity"],
  "Building Construction": ["Bricklaying & Blocklaying", "Carpentry & Joinery", "Tiling & Terrazzo"],
};

const LIGHT_SECTOR_TRADES: Record<string, string[]> = {
  "Hospitality and Tourism": ["Catering & Culinary Arts", "Hotel Front Desk Operations"],
  "Education and Social Care": ["Early Childhood Care", "Community Health Work"],
  "Welding and Fabrication": ["Arc Welding", "Metal Fabrication"],
  Engineering: ["Mechanical Engineering Technology", "Electrical Installation"],
  Agriculture: ["Crop Production", "Poultry Farming"],
  "Fashion Design, Garment and Apparel": ["Tailoring & Garment Making", "Fashion Illustration"],
  Automobile: ["Auto Mechanic Work", "Auto Electrical Work"],
  "Creative Media": ["Graphic Design", "Videography & Editing"],
};

async function setupTrades() {
  console.log("Setting up trades under each sector...");
  const tradeMap: Record<string, Record<string, string>> = {};
  const allTradeDefs = { ...FOCUS_SECTOR_TRADES, ...LIGHT_SECTOR_TRADES };

  for (const [sectorName, tradeNames] of Object.entries(allTradeDefs)) {
    const sector = await prisma.sector.findUnique({ where: { name: sectorName } });
    if (!sector) {
      console.warn(`  Sector "${sectorName}" not found — skipping (run baseline seed first).`);
      continue;
    }
    tradeMap[sectorName] = {};
    for (const tradeName of tradeNames) {
      const trade = await prisma.trade.upsert({
        where: { sectorId_name: { sectorId: sector.id, name: tradeName } },
        update: {},
        create: { sectorId: sector.id, name: tradeName },
      });
      tradeMap[sectorName][tradeName] = trade.id;
    }
  }
  return tradeMap;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Criteria
// ─────────────────────────────────────────────────────────────────────────

async function setupCriteria(cycleId: string) {
  console.log("Setting up assessment criteria for ICT and Building Construction...");

  const criteriaDefs: {
    sectorName: string;
    text: string;
    maxScore: number;
    scope: CriterionScope;
    level: CriterionLevel;
  }[] = [
    {
      sectorName: "__global__",
      text: "Punctuality and attendance record throughout the training period",
      maxScore: 10,
      scope: CriterionScope.Global_AllTrades,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "__global__",
      text: "Communication and presentation of work to the assessment panel",
      maxScore: 10,
      scope: CriterionScope.Global_AllTrades,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "ICT",
      text: "Demonstrated understanding of core technical concepts for the trade area",
      maxScore: 25,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "ICT",
      text: "Quality and completeness of portfolio/project evidence submitted",
      maxScore: 25,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "ICT",
      text: "Problem-solving approach demonstrated during practical assessment",
      maxScore: 20,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "ICT",
      text: "National-stage: innovation and originality relative to other zones",
      maxScore: 15,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.National_Only,
    },
    {
      sectorName: "Building Construction",
      text: "Adherence to safety standards and proper use of tools/equipment",
      maxScore: 20,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "Building Construction",
      text: "Precision and finish quality of practical work sample",
      maxScore: 30,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "Building Construction",
      text: "Efficient use of materials and minimal wastage",
      maxScore: 20,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.Nationwide,
    },
    {
      sectorName: "Building Construction",
      text: "National-stage: structural soundness relative to other zones' submissions",
      maxScore: 15,
      scope: CriterionScope.Sector_Wide,
      level: CriterionLevel.National_Only,
    },
  ];

  const evidenceTypes = await prisma.evidenceType.findMany();
  const certificatesEt = evidenceTypes.find((e) => e.name === "Certificates");
  const portfoliosEt = evidenceTypes.find((e) => e.name === "Portfolios");
  const photosEt = evidenceTypes.find((e) => e.name === "Project_Photographs");

  const createdCriteria: { id: string; sectorName: string; level: CriterionLevel }[] = [];

  for (const def of criteriaDefs) {
    let sectorId: string | undefined;
    if (def.sectorName !== "__global__") {
      const sector = await prisma.sector.findUnique({ where: { name: def.sectorName } });
      sectorId = sector?.id;
    }

    const criterion = await prisma.criterion.create({
      data: {
        cycleId,
        text: def.text,
        maxScore: def.maxScore,
        scope: def.scope,
        level: def.level,
        status: CriterionStatus.Active,
        sectorId,
        allowedEvidenceTypes: {
          create: [certificatesEt, portfoliosEt, photosEt]
            .filter((et): et is NonNullable<typeof et> => Boolean(et))
            .map((et) => ({ evidenceTypeId: et.id })),
        },
      },
    });
    createdCriteria.push({ id: criterion.id, sectorName: def.sectorName, level: def.level });
  }

  console.log(`  Created ${createdCriteria.length} criteria.`);
  return createdCriteria;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Staff hierarchy
// ─────────────────────────────────────────────────────────────────────────

async function createStaffUser(email: string, firstName: string, lastName: string, intendedZoneId?: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: demoPasswordHash, firstName, lastName, country: "Nigeria", intendedZoneId },
  });
}

async function setupStaff() {
  console.log("Setting up staff hierarchy (National/Zonal admins, assessors, moderators)...");

  const zones = await prisma.zone.findMany({ include: { states: true } });

  const nationalAdminName = randomName();
  const nationalAdmin = await createStaffUser(uniqueEmail("national.admin"), nationalAdminName.firstName, nationalAdminName.lastName);
  await grantRole({ userId: nationalAdmin.id, roleName: UserType.National_Admin, scope: RoleScope.National });

  const nationalAssessors: { id: string; name: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const n = randomName();
    const u = await createStaffUser(uniqueEmail("national.assessor"), n.firstName, n.lastName);
    await grantRole({ userId: u.id, roleName: UserType.National_Assessor, scope: RoleScope.National });
    nationalAssessors.push({ id: u.id, name: `${n.firstName} ${n.lastName}` });
  }
  const nModName = randomName();
  const nationalModerator = await createStaffUser(uniqueEmail("national.moderator"), nModName.firstName, nModName.lastName);
  await grantRole({ userId: nationalModerator.id, roleName: UserType.National_Moderator, scope: RoleScope.National });

  const zonalStaff: Record<string, { adminId: string; assessors: { id: string; name: string }[]; moderatorId: string }> = {};

  for (const zone of zones) {
    const adminName = randomName();
    const admin = await createStaffUser(uniqueEmail("zonal.admin"), adminName.firstName, adminName.lastName, zone.id);
    await grantRole({ userId: admin.id, roleName: UserType.Zonal_Admin, scope: RoleScope.Zonal, zoneId: zone.id });

    const assessors: { id: string; name: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const n = randomName();
      const u = await createStaffUser(uniqueEmail("zonal.assessor"), n.firstName, n.lastName, zone.id);
      await grantRole({ userId: u.id, roleName: UserType.Zonal_Assessor, scope: RoleScope.Zonal, zoneId: zone.id });
      assessors.push({ id: u.id, name: `${n.firstName} ${n.lastName}` });
    }

    const modName = randomName();
    const moderator = await createStaffUser(uniqueEmail("zonal.moderator"), modName.firstName, modName.lastName, zone.id);
    await grantRole({ userId: moderator.id, roleName: UserType.Zonal_Moderator, scope: RoleScope.Zonal, zoneId: zone.id });

    zonalStaff[zone.id] = { adminId: admin.id, assessors, moderatorId: moderator.id };
  }

  const stateStaff: Record<string, { assessors: { id: string; name: string }[]; moderatorId: string }> = {};

  return { nationalAdmin, nationalAssessors, nationalModerator, zonalStaff, stateStaff, zones };
}

async function setupStateStaff(
  stateId: string,
  zoneId: string,
  stateStaff: Record<string, { assessors: { id: string; name: string }[]; moderatorId: string }>
) {
  const assessors: { id: string; name: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const n = randomName();
    const u = await createStaffUser(uniqueEmail("state.assessor"), n.firstName, n.lastName, zoneId);
    await grantRole({ userId: u.id, roleName: UserType.State_Assessor, scope: RoleScope.State, zoneId, stateId });
    assessors.push({ id: u.id, name: `${n.firstName} ${n.lastName}` });
  }
  const modName = randomName();
  const moderator = await createStaffUser(uniqueEmail("state.moderator"), modName.firstName, modName.lastName, zoneId);
  await grantRole({ userId: moderator.id, roleName: UserType.State_Moderator, scope: RoleScope.State, zoneId, stateId });
  stateStaff[stateId] = { assessors, moderatorId: moderator.id };
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Applicants
// ─────────────────────────────────────────────────────────────────────────

async function registerTrainee(cycleId: string, stateId: string, tradeId: string) {
  const n = randomName();
  return prisma.user.create({
    data: {
      email: uniqueEmail("trainee"),
      passwordHash: demoPasswordHash,
      firstName: n.firstName,
      lastName: n.lastName,
      gender: Math.random() > 0.5 ? Gender.Male : Gender.Female,
      country: "Nigeria",
      address: `${randInt(1, 200)} Unity Road`,
      applicantCategory: ApplicantCategory.Trainee,
      cycleId,
      stateId,
      tradeId,
    },
  });
}

async function registerOtherCategory(cycleId: string, stateId: string, category: ApplicantCategory, tradeId?: string) {
  const isIndividual = category === ApplicantCategory.Instructor;
  const n = randomName();
  return prisma.user.create({
    data: {
      email: uniqueEmail(category.toLowerCase()),
      passwordHash: demoPasswordHash,
      country: "Nigeria",
      address: `${randInt(1, 200)} Unity Road`,
      applicantCategory: category,
      cycleId,
      stateId,
      tradeId,
      ...(isIndividual
        ? { firstName: n.firstName, lastName: n.lastName, gender: Math.random() > 0.5 ? Gender.Male : Gender.Female }
        : { organizationName: `${pick(LAST_NAMES)} ${pick(ORG_SUFFIXES)}` }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Panel assignment + scoring
// ─────────────────────────────────────────────────────────────────────────

async function assignAndScorePanel(
  stateTradeEntryId: string,
  assessorIds: string[],
  assignedById: string,
  criteria: { id: string; sectorName: string; level: CriterionLevel }[],
  sectorName: string,
  skillLevel: number
) {
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() - randInt(1, 30));

  for (const assessorId of assessorIds) {
    await prisma.tradeEntryPanel.create({
      data: {
        stateTradeEntryId,
        assessorId,
        assignedById,
        dueAt,
        level: AssessmentLevel.State, // this seed only ever simulates the initial State-level panel directly
        completedAt: new Date(dueAt.getTime() + 1000 * 60 * 60 * 24 * randInt(1, 5)),
      },
    });
  }

  const applicable = criteria.filter(
    (c) => (c.sectorName === "__global__" || c.sectorName === sectorName) && c.level === "Nationwide"
  );

  for (const assessorId of assessorIds) {
    for (const criterion of applicable) {
      const criterionRow = await prisma.criterion.findUniqueOrThrow({ where: { id: criterion.id } });
      await prisma.score.create({
        data: {
          stateTradeEntryId,
          criterionId: criterion.id,
          assessorId,
          value: biasedScore(Number(criterionRow.maxScore), skillLevel),
          comment:
            skillLevel > 0.75
              ? "Strong, confident performance."
              : skillLevel < 0.4
                ? "Needs further development in this area."
                : "Solid, competent performance.",
          evidenceTypeObserved: pick(["Certificates", "Portfolios", "Project_Photographs"] as const),
          evidenceNote: "Evidence observed and verified on-site.",
        },
      });
    }
  }

  await recomputeTradeEntryTotal(stateTradeEntryId);
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Checking that the baseline seed has been run...");
  const [zoneCount, sectorCount, roleCount] = await Promise.all([
    prisma.zone.count(),
    prisma.sector.count(),
    prisma.role.count(),
  ]);
  if (zoneCount === 0 || sectorCount === 0 || roleCount === 0) {
    console.error(
      "\n❌ The baseline seed has not been run (or was wiped by a migration reset since).\n" +
        `   Found: ${zoneCount} zones, ${sectorCount} sectors, ${roleCount} roles.\n\n` +
        "   Run this FIRST, then re-run this script:\n" +
        "     npx prisma db seed\n"
    );
    process.exit(1);
  }
  console.log(`  OK — ${zoneCount} zones, ${sectorCount} sectors, ${roleCount} roles found.\n`);

  console.log("Hashing demo password...");
  demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const cycle = await setupCycle();
  const tradeMap = await setupTrades();
  const criteria = await setupCriteria(cycle.id);
  const { nationalAdmin, nationalAssessors, zonalStaff, stateStaff, zones } = await setupStaff();

  const focusSectors = Object.keys(FOCUS_SECTOR_TRADES);

  console.log("\nRegistering applicants and running full State -> Zonal -> National assessment...");
  console.log("(This is the slow part — creating and scoring many entries. Please be patient.)\n");

  const zoneSkill: Record<string, number> = {};
  for (const zone of zones) zoneSkill[zone.id] = Math.random();

  for (const sectorName of focusSectors) {
    console.log(`\n=== Sector: ${sectorName} ===`);
    const sector = await prisma.sector.findUniqueOrThrow({ where: { name: sectorName } });
    const trades = Object.values(tradeMap[sectorName]);

    for (const zone of zones) {
      const statesToUse = zone.states.slice(0, Math.min(3, zone.states.length));

      for (const state of statesToUse) {
        await setupStateStaff(state.id, zone.id, stateStaff);
        const stateAssessorIds = stateStaff[state.id].assessors.map((a) => a.id);
        const stateSkill = Math.max(0, Math.min(1, zoneSkill[zone.id] + (Math.random() - 0.5) * 0.3));

        for (const tradeId of trades) {
          // 3 trainees compete per trade — this is what makes the
          // individual leaderboard meaningful (multiple named people to
          // rank within the same trade, not just one).
          for (let i = 0; i < 3; i++) {
            const trainee = await registerTrainee(cycle.id, state.id, tradeId);
            const entry = await prisma.stateTradeEntry.create({
              data: {
                cycleId: cycle.id,
                sectorId: sector.id,
                stateId: state.id,
                tradeId,
                applicantId: trainee.id,
              },
            });
            // Vary skill slightly per trainee (±0.2) so scores within
            // the same trade genuinely differ, producing a real ranking
            // rather than near-identical numbers.
            const traineeSkill = Math.max(0, Math.min(1, stateSkill + (Math.random() - 0.5) * 0.4));
            await assignAndScorePanel(entry.id, stateAssessorIds, zonalStaff[zone.id].adminId, criteria, sectorName, traineeSkill);
          }
        }

        await computeStateSectorResult(cycle.id, sector.id, state.id);
      }

      const { promoted } = await promoteStateToZonal(cycle.id, sector.id, zone.id, zonalStaff[zone.id].adminId);
      console.log(`  Zone "${zone.name}": ${promoted.length} state(s) promoted to Zonal stage.`);
    }

    const { promoted: nationallyPromoted } = await promoteZonalToNational(cycle.id, sector.id, nationalAdmin.id);
    console.log(`  National stage: ${nationallyPromoted.length} zone(s) promoted to National for ${sectorName}.`);

    const nationalLevelEntries = await prisma.stateTradeEntry.findMany({
      where: { cycleId: cycle.id, sectorId: sector.id, currentLevel: AssessmentLevel.National },
    });
    const nationalOnlyCriteria = criteria.filter((c) => c.sectorName === sectorName && c.level === "National_Only");
    for (const entry of nationalLevelEntries) {
      for (const assessorId of nationalAssessors.map((a) => a.id)) {
        for (const criterion of nationalOnlyCriteria) {
          const exists = await prisma.score.findUnique({
            where: {
              stateTradeEntryId_criterionId_assessorId: {
                stateTradeEntryId: entry.id,
                criterionId: criterion.id,
                assessorId,
              },
            },
          });
          if (exists) continue;
          const criterionRow = await prisma.criterion.findUniqueOrThrow({ where: { id: criterion.id } });
          await prisma.score.create({
            data: {
              stateTradeEntryId: entry.id,
              criterionId: criterion.id,
              assessorId,
              value: biasedScore(Number(criterionRow.maxScore), 0.6 + Math.random() * 0.3),
              comment: "National panel assessment.",
            },
          });
        }
      }
      await recomputeTradeEntryTotal(entry.id);
    }
  }

  console.log("\nRegistering light applicant data for remaining sectors/categories...");
  const allZones = await prisma.zone.findMany({ include: { states: true } });
  for (const [sectorName] of Object.entries(LIGHT_SECTOR_TRADES)) {
    const sectorTrades = tradeMap[sectorName];
    if (!sectorTrades) continue;
    const tradeIds = Object.values(sectorTrades);
    for (const zone of allZones.slice(0, 3)) {
      const state = pick(zone.states);
      for (const tradeId of tradeIds) {
        await registerTrainee(cycle.id, state.id, tradeId);
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    const zone = pick(allZones);
    const state = pick(zone.states);
    await registerOtherCategory(cycle.id, state.id, ApplicantCategory.TSP);
    await registerOtherCategory(cycle.id, state.id, ApplicantCategory.Technical_College);
    await registerOtherCategory(cycle.id, state.id, ApplicantCategory.Instructor);
    await registerOtherCategory(cycle.id, state.id, ApplicantCategory.Industry_Partner);
  }

  console.log("\nCreating award categories and assigning national results...");
  const awardDefs: { name: string; requiredEntityType: AwardEntityType }[] = [
    { name: "Outstanding ICT Skills Graduate", requiredEntityType: AwardEntityType.Trainee },
    { name: "Outstanding Building & Construction Trainee", requiredEntityType: AwardEntityType.Trainee },
    { name: "Best Training Service Provider", requiredEntityType: AwardEntityType.TSP },
    { name: "Best Technical College", requiredEntityType: AwardEntityType.Technical_College },
    { name: "Outstanding Instructor of the Year", requiredEntityType: AwardEntityType.Instructor },
    { name: "Industry Partner Excellence Award", requiredEntityType: AwardEntityType.Industry_Partner },
  ];
  const awardCategories = [];
  for (const def of awardDefs) {
    const cat = await prisma.awardCategory.upsert({
      where: { name: def.name },
      update: {},
      create: { name: def.name, requiredEntityType: def.requiredEntityType },
    });
    awardCategories.push(cat);
  }

  for (const sectorName of focusSectors) {
    const sector = await prisma.sector.findUniqueOrThrow({ where: { name: sectorName } });
    const topNational = await prisma.sectorResult.findFirst({
      where: { cycleId: cycle.id, sectorId: sector.id, stage: "National", rank: 1 },
    });
    if (!topNational) continue;
    const categoryName = sectorName === "ICT" ? "Outstanding ICT Skills Graduate" : "Outstanding Building & Construction Trainee";
    const category = awardCategories.find((c) => c.name === categoryName);
    if (!category) continue;

    const existing = await prisma.awardResult.findUnique({
      where: { cycleId_awardCategoryId: { cycleId: cycle.id, awardCategoryId: category.id } },
    });
    if (!existing) {
      await prisma.awardResult.create({
        data: { cycleId: cycle.id, awardCategoryId: category.id, sectorResultId: topNational.id, assignedById: nationalAdmin.id },
      });
      console.log(`  Assigned "${category.name}" to the national winner of ${sectorName}.`);
    }
  }

  console.log("\nCreating a moderation case for realism...");
  const ictSector = await prisma.sector.findUniqueOrThrow({ where: { name: "ICT" } });
  const someScore = await prisma.score.findFirst({ where: { stateTradeEntry: { sectorId: ictSector.id } } });
  if (someScore) {
    const raisedByCandidate = await prisma.userRole.findFirst({ where: { role: { name: "Zonal_Assessor" } } });
    if (raisedByCandidate) {
      await prisma.moderationCase.create({
        data: {
          scoreId: someScore.id,
          raisedById: raisedByCandidate.userId,
          reason: "The score awarded seems inconsistent with the evidence described — requesting a second review.",
          status: ModerationCaseStatus.Open,
        },
      });
      console.log("  Created 1 open moderation case.");
    }
  }

  console.log("\nSending a demo broadcast message from the National Admin...");
  const broadcastConvo = await prisma.conversation.create({
    data: {
      kind: ConversationKind.Broadcast,
      subject: "Welcome to the new competition cycle",
      broadcastTargetType: "Everyone",
      participants: { create: [{ userId: nationalAdmin.id }] },
    },
  });
  await prisma.message.create({
    data: {
      conversationId: broadcastConvo.id,
      senderId: nationalAdmin.id,
      body: `Welcome to the ${cycle.title}! Assessment is now underway across all zones. Please ensure all panel assignments are completed before the relevant deadlines.`,
    },
  });

  console.log("\n✅ Demo data seed complete.");
  console.log(`\nDemo login password for ALL generated accounts: ${DEMO_PASSWORD}`);
  console.log(`National Admin email: ${nationalAdmin.email}`);
  console.log("\nYou can now explore:");
  console.log("  - /dashboard/results — full State/Zonal/National rankings for ICT and Building Construction");
  console.log("  - /dashboard/awards — 2 awards already assigned, 4 more ready for you to assign");
  console.log("  - /dashboard/moderation — 1 open case ready to resolve");
  console.log("  - /dashboard/applicants — populated across all 5 categories and all sectors");
  console.log("  - /dashboard/staff — full National/Zonal/State staff hierarchy, all appointed");
  console.log("  - /results (public) — published rankings for ICT and Building Construction");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
