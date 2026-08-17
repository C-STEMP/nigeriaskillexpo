-- CreateTable
CREATE TABLE `Zone` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Zone_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `State` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `zoneId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `State_name_key`(`name`),
    INDEX `State_zoneId_idx`(`zoneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `organizationName` VARCHAR(255) NULL,
    `firstName` VARCHAR(100) NULL,
    `lastName` VARCHAR(100) NULL,
    `gender` ENUM('Male', 'Female') NULL,
    `phone` VARCHAR(30) NULL,
    `address` VARCHAR(500) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
    `stateId` VARCHAR(36) NULL,
    `applicantCategory` ENUM('Trainee', 'TSP', 'Technical_College', 'Instructor', 'Industry_Partner') NULL,
    `cycleId` VARCHAR(36) NULL,
    `tradeId` VARCHAR(36) NULL,
    `usedRegistrationCodeId` VARCHAR(36) NULL,
    `intendedZoneId` VARCHAR(36) NULL,
    `appointedById` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_applicantCategory_idx`(`applicantCategory`),
    INDEX `User_cycleId_idx`(`cycleId`),
    INDEX `User_tradeId_idx`(`tradeId`),
    INDEX `User_stateId_idx`(`stateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(36) NOT NULL,
    `name` ENUM('Super_Admin', 'Observer_Admin', 'National_Admin', 'National_Moderator', 'National_Assessor', 'Zonal_Admin', 'Zonal_Moderator', 'Zonal_Assessor', 'State_Assessor', 'State_Moderator', 'Trainee', 'TSP', 'Technical_College', 'Instructor', 'Industry_Partner') NOT NULL DEFAULT 'Trainee',
    `scope` ENUM('State', 'Zonal', 'National', 'Overall') NOT NULL DEFAULT 'Zonal',
    `canCreate` BOOLEAN NOT NULL DEFAULT true,
    `canEdit` BOOLEAN NOT NULL DEFAULT true,
    `canDelete` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_scope_key`(`name`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `roleId` VARCHAR(36) NOT NULL,
    `zoneId` VARCHAR(36) NULL,
    `stateId` VARCHAR(36) NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `UserRole_userId_idx`(`userId`),
    INDEX `UserRole_roleId_idx`(`roleId`),
    UNIQUE INDEX `UserRole_userId_roleId_zoneId_key`(`userId`, `roleId`, `zoneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationCode` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `retiredAt` DATETIME(3) NULL,

    UNIQUE INDEX `RegistrationCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompetitionCycle` (
    `id` VARCHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` ENUM('Draft', 'Open', 'Registration_Closed', 'Zonal_Locked', 'National_Locked', 'Archived') NOT NULL DEFAULT 'Draft',
    `registrationOpensAt` DATETIME(3) NULL,
    `registrationClosesAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompetitionCycle_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CycleSectorOffering` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `sectorId` VARCHAR(36) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CycleSectorOffering_sectorId_idx`(`sectorId`),
    UNIQUE INDEX `CycleSectorOffering_cycleId_sectorId_key`(`cycleId`, `sectorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sector` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sector_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SectorApplicantCategory` (
    `id` VARCHAR(36) NOT NULL,
    `sectorId` VARCHAR(36) NOT NULL,
    `category` ENUM('Trainee', 'TSP', 'Technical_College', 'Instructor', 'Industry_Partner') NOT NULL,

    UNIQUE INDEX `SectorApplicantCategory_sectorId_category_key`(`sectorId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trade` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `sectorId` VARCHAR(36) NOT NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Trade_sectorId_idx`(`sectorId`),
    UNIQUE INDEX `Trade_sectorId_name_key`(`sectorId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvidenceType` (
    `id` VARCHAR(36) NOT NULL,
    `name` ENUM('Certificates', 'Portfolios', 'Employment_Records', 'Business_Registration_Documents', 'Business_Performance_Records', 'Project_Photographs', 'Videos', 'References', 'Testimonials') NOT NULL,

    UNIQUE INDEX `EvidenceType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Criterion` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `text` TEXT NOT NULL,
    `maxScore` DECIMAL(6, 2) NOT NULL,
    `scope` ENUM('Global_AllTrades', 'Global_PerSector', 'Sector_Wide', 'Trade_Specific') NOT NULL,
    `level` ENUM('State_Only', 'Zonal_Only', 'National_Only', 'Nationwide') NOT NULL DEFAULT 'Nationwide',
    `status` ENUM('Draft', 'Active', 'Retired') NOT NULL DEFAULT 'Draft',
    `sectorId` VARCHAR(36) NULL,
    `tradeId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Criterion_cycleId_idx`(`cycleId`),
    INDEX `Criterion_sectorId_idx`(`sectorId`),
    INDEX `Criterion_tradeId_idx`(`tradeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CriterionEvidenceType` (
    `id` VARCHAR(36) NOT NULL,
    `criterionId` VARCHAR(36) NOT NULL,
    `evidenceTypeId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `CriterionEvidenceType_criterionId_evidenceTypeId_key`(`criterionId`, `evidenceTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CriterionLock` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `level` ENUM('State', 'Zonal', 'National') NOT NULL,
    `sectorId` VARCHAR(36) NULL,
    `sectorScopeKey` VARCHAR(36) NOT NULL DEFAULT 'ALL_SECTORS',
    `state` ENUM('Open', 'Locked') NOT NULL DEFAULT 'Open',
    `lockedById` VARCHAR(36) NULL,
    `lockedAt` DATETIME(3) NULL,
    `unlockedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CriterionLock_cycleId_level_sectorScopeKey_key`(`cycleId`, `level`, `sectorScopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StateTradeEntry` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `sectorId` VARCHAR(36) NOT NULL,
    `stateId` VARCHAR(36) NOT NULL,
    `tradeId` VARCHAR(36) NOT NULL,
    `applicantId` VARCHAR(36) NOT NULL,
    `currentLevel` ENUM('State', 'Zonal', 'National') NOT NULL DEFAULT 'State',
    `tradeTotal` DECIMAL(8, 2) NULL,
    `tradeAverage` DECIMAL(8, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StateTradeEntry_cycleId_sectorId_stateId_idx`(`cycleId`, `sectorId`, `stateId`),
    INDEX `StateTradeEntry_applicantId_idx`(`applicantId`),
    UNIQUE INDEX `StateTradeEntry_cycleId_sectorId_stateId_tradeId_applicantId_key`(`cycleId`, `sectorId`, `stateId`, `tradeId`, `applicantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeEntryPanel` (
    `id` VARCHAR(36) NOT NULL,
    `stateTradeEntryId` VARCHAR(36) NOT NULL,
    `assessorId` VARCHAR(36) NOT NULL,
    `assignedById` VARCHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `level` ENUM('State', 'Zonal', 'National') NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `TradeEntryPanel_stateTradeEntryId_level_idx`(`stateTradeEntryId`, `level`),
    UNIQUE INDEX `TradeEntryPanel_stateTradeEntryId_assessorId_level_key`(`stateTradeEntryId`, `assessorId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Score` (
    `id` VARCHAR(36) NOT NULL,
    `stateTradeEntryId` VARCHAR(36) NOT NULL,
    `criterionId` VARCHAR(36) NOT NULL,
    `assessorId` VARCHAR(36) NOT NULL,
    `value` DECIMAL(6, 2) NOT NULL,
    `comment` TEXT NULL,
    `evidenceTypeObserved` ENUM('Certificates', 'Portfolios', 'Employment_Records', 'Business_Registration_Documents', 'Business_Performance_Records', 'Project_Photographs', 'Videos', 'References', 'Testimonials') NULL,
    `evidenceNote` TEXT NULL,
    `evidenceUrl` VARCHAR(500) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `editedAt` DATETIME(3) NULL,

    INDEX `Score_criterionId_idx`(`criterionId`),
    INDEX `Score_assessorId_idx`(`assessorId`),
    UNIQUE INDEX `Score_stateTradeEntryId_criterionId_assessorId_key`(`stateTradeEntryId`, `criterionId`, `assessorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SectorResult` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `sectorId` VARCHAR(36) NOT NULL,
    `stage` ENUM('State', 'Zonal', 'National') NOT NULL,
    `stateId` VARCHAR(36) NULL,
    `zoneId` VARCHAR(36) NULL,
    `locationScopeKey` VARCHAR(80) NOT NULL DEFAULT 'NONE:NONE',
    `sectorTotal` DECIMAL(10, 2) NOT NULL,
    `rank` INTEGER NULL,
    `isPromoted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SectorResult_cycleId_sectorId_stage_idx`(`cycleId`, `sectorId`, `stage`),
    UNIQUE INDEX `SectorResult_cycleId_sectorId_stage_locationScopeKey_key`(`cycleId`, `sectorId`, `stage`, `locationScopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Promotion` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `sectorResultId` VARCHAR(36) NOT NULL,
    `fromStage` ENUM('State', 'Zonal', 'National') NOT NULL,
    `toStage` ENUM('State', 'Zonal', 'National') NOT NULL,
    `promotedById` VARCHAR(36) NOT NULL,
    `promotedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Promotion_cycleId_idx`(`cycleId`),
    INDEX `Promotion_sectorResultId_idx`(`sectorResultId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModerationCase` (
    `id` VARCHAR(36) NOT NULL,
    `scoreId` VARCHAR(36) NULL,
    `raisedById` VARCHAR(36) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('Open', 'Under_Review', 'Resolved_Upheld', 'Resolved_Overturned', 'Dismissed') NOT NULL DEFAULT 'Open',
    `moderatorId` VARCHAR(36) NULL,
    `resolution` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `ModerationCase_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AwardCategory` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `requiredEntityType` ENUM('Trainee', 'TSP', 'Technical_College', 'Instructor', 'Industry_Partner', 'Cross_Category') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AwardCategory_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AwardResult` (
    `id` VARCHAR(36) NOT NULL,
    `cycleId` VARCHAR(36) NOT NULL,
    `awardCategoryId` VARCHAR(36) NOT NULL,
    `sectorResultId` VARCHAR(36) NOT NULL,
    `assignedById` VARCHAR(36) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AwardResult_sectorResultId_idx`(`sectorResultId`),
    UNIQUE INDEX `AwardResult_cycleId_awardCategoryId_key`(`cycleId`, `awardCategoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(36) NOT NULL,
    `kind` ENUM('Direct', 'Broadcast') NOT NULL,
    `subject` VARCHAR(255) NULL,
    `broadcastTargetType` ENUM('Everyone', 'Specific_Role', 'Specific_Zone', 'Specific_Role_In_Zone') NULL,
    `broadcastTargetRole` ENUM('Super_Admin', 'Observer_Admin', 'National_Admin', 'National_Moderator', 'National_Assessor', 'Zonal_Admin', 'Zonal_Moderator', 'Zonal_Assessor', 'State_Assessor', 'State_Moderator', 'Trainee', 'TSP', 'Technical_College', 'Instructor', 'Industry_Partner') NULL,
    `broadcastTargetZoneId` VARCHAR(36) NULL,
    `parentBroadcastId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_broadcastTargetZoneId_idx`(`broadcastTargetZoneId`),
    INDEX `Conversation_parentBroadcastId_idx`(`parentBroadcastId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationParticipant` (
    `id` VARCHAR(36) NOT NULL,
    `conversationId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationParticipant_userId_idx`(`userId`),
    UNIQUE INDEX `ConversationParticipant_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(36) NOT NULL,
    `conversationId` VARCHAR(36) NOT NULL,
    `senderId` VARCHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `Message_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(36) NOT NULL,
    `recipientId` VARCHAR(36) NOT NULL,
    `type` ENUM('PANEL_ASSIGNED', 'SCORE_SUBMITTED', 'PANEL_COMPLETED', 'PANEL_ASSIGNMENT_OVERDUE', 'MODERATION_OPENED', 'MODERATION_RESOLVED', 'PROMOTION_OCCURRED', 'CRITERION_LOCK_CHANGED', 'STAFF_PENDING_APPOINTMENT', 'ROLE_CHANGED', 'AWARD_ASSIGNED', 'NEW_MESSAGE') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `linkType` ENUM('Panel_Assignment', 'State_Trade_Entry', 'Moderation_Case', 'Sector_Result', 'Award_Result', 'Staff_Registration', 'Role_Change', 'Criterion_Lock', 'Conversation') NULL,
    `linkId` VARCHAR(36) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_recipientId_readAt_idx`(`recipientId`, `readAt`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NOT NULL,
    `action` ENUM('SCORE_SUBMITTED', 'SCORE_EDITED', 'COMMENT_ADDED', 'MODERATION_OPENED', 'MODERATION_RESOLVED', 'CRITERION_LOCKED', 'CRITERION_UNLOCKED', 'PROMOTION_RUN', 'CYCLE_STATUS_CHANGED', 'ROLE_GRANTED', 'ROLE_REVOKED', 'REGISTRATION_CODE_RESET', 'AWARD_RESULT_ASSIGNED', 'SECTOR_DISABLED', 'SECTOR_ENABLED') NOT NULL,
    `metadata` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `State` ADD CONSTRAINT `State_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `Zone`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `State`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `Trade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_usedRegistrationCodeId_fkey` FOREIGN KEY (`usedRegistrationCodeId`) REFERENCES `RegistrationCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_intendedZoneId_fkey` FOREIGN KEY (`intendedZoneId`) REFERENCES `Zone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_appointedById_fkey` FOREIGN KEY (`appointedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `Zone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `State`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CycleSectorOffering` ADD CONSTRAINT `CycleSectorOffering_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CycleSectorOffering` ADD CONSTRAINT `CycleSectorOffering_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SectorApplicantCategory` ADD CONSTRAINT `SectorApplicantCategory_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trade` ADD CONSTRAINT `Trade_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Criterion` ADD CONSTRAINT `Criterion_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Criterion` ADD CONSTRAINT `Criterion_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Criterion` ADD CONSTRAINT `Criterion_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `Trade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CriterionEvidenceType` ADD CONSTRAINT `CriterionEvidenceType_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `Criterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CriterionEvidenceType` ADD CONSTRAINT `CriterionEvidenceType_evidenceTypeId_fkey` FOREIGN KEY (`evidenceTypeId`) REFERENCES `EvidenceType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CriterionLock` ADD CONSTRAINT `CriterionLock_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CriterionLock` ADD CONSTRAINT `CriterionLock_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StateTradeEntry` ADD CONSTRAINT `StateTradeEntry_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StateTradeEntry` ADD CONSTRAINT `StateTradeEntry_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StateTradeEntry` ADD CONSTRAINT `StateTradeEntry_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `State`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StateTradeEntry` ADD CONSTRAINT `StateTradeEntry_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `Trade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StateTradeEntry` ADD CONSTRAINT `StateTradeEntry_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeEntryPanel` ADD CONSTRAINT `TradeEntryPanel_stateTradeEntryId_fkey` FOREIGN KEY (`stateTradeEntryId`) REFERENCES `StateTradeEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeEntryPanel` ADD CONSTRAINT `TradeEntryPanel_assessorId_fkey` FOREIGN KEY (`assessorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeEntryPanel` ADD CONSTRAINT `TradeEntryPanel_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_stateTradeEntryId_fkey` FOREIGN KEY (`stateTradeEntryId`) REFERENCES `StateTradeEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `Criterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_assessorId_fkey` FOREIGN KEY (`assessorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SectorResult` ADD CONSTRAINT `SectorResult_sectorId_fkey` FOREIGN KEY (`sectorId`) REFERENCES `Sector`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SectorResult` ADD CONSTRAINT `SectorResult_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `State`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SectorResult` ADD CONSTRAINT `SectorResult_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `Zone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_sectorResultId_fkey` FOREIGN KEY (`sectorResultId`) REFERENCES `SectorResult`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Promotion` ADD CONSTRAINT `Promotion_promotedById_fkey` FOREIGN KEY (`promotedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationCase` ADD CONSTRAINT `ModerationCase_scoreId_fkey` FOREIGN KEY (`scoreId`) REFERENCES `Score`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationCase` ADD CONSTRAINT `ModerationCase_raisedById_fkey` FOREIGN KEY (`raisedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationCase` ADD CONSTRAINT `ModerationCase_moderatorId_fkey` FOREIGN KEY (`moderatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardResult` ADD CONSTRAINT `AwardResult_cycleId_fkey` FOREIGN KEY (`cycleId`) REFERENCES `CompetitionCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardResult` ADD CONSTRAINT `AwardResult_awardCategoryId_fkey` FOREIGN KEY (`awardCategoryId`) REFERENCES `AwardCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardResult` ADD CONSTRAINT `AwardResult_sectorResultId_fkey` FOREIGN KEY (`sectorResultId`) REFERENCES `SectorResult`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardResult` ADD CONSTRAINT `AwardResult_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_broadcastTargetZoneId_fkey` FOREIGN KEY (`broadcastTargetZoneId`) REFERENCES `Zone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_parentBroadcastId_fkey` FOREIGN KEY (`parentBroadcastId`) REFERENCES `Conversation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
