-- =====================================================================
-- Billing V2 Migration: Custom Pricing, Promotions, Billing Cycles
-- Run this entire file in phpMyAdmin: select your DB, then Import this file.
-- =====================================================================

-- 1. Add custom package price per owner (NULL = use global system price)
ALTER TABLE `user`
  ADD COLUMN IF NOT EXISTS `packagePrice` DECIMAL(10,2) DEFAULT NULL;

-- 2. Extend owner_billing with promotion flag, billing cycle, and discount
ALTER TABLE `owner_billing`
  ADD COLUMN IF NOT EXISTS `isPromotion` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `billingCycle` ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `note` VARCHAR(500) DEFAULT NULL;

-- 3. Add lastLoginAt and lastActiveAt to user table (for recent logins / online tracking)
--    (safe to run even if already added from a prior migration)
ALTER TABLE `user`
  ADD COLUMN IF NOT EXISTS `lastLoginAt` DATETIME(3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `lastActiveAt` DATETIME(3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email` VARCHAR(191) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `status` ENUM('active','blocked') NOT NULL DEFAULT 'active';

-- 4. Add status column to property (if not already present)
ALTER TABLE `property`
  ADD COLUMN IF NOT EXISTS `status` ENUM('active','blocked') NOT NULL DEFAULT 'active';

-- 5. Ensure system_settings table exists (for global_billing_amount key)
CREATE TABLE IF NOT EXISTS `system_settings` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Ensure owner_billing table exists with all columns
CREATE TABLE IF NOT EXISTS `owner_billing` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `ownerId` INT(11) NOT NULL,
  `periodStart` DATE NOT NULL,
  `periodEnd` DATE NOT NULL,
  `amountDue` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `amountPaid` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  `isPromotion` TINYINT(1) NOT NULL DEFAULT 0,
  `billingCycle` ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `note` VARCHAR(500) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `owner_billing_owner_idx` (`ownerId`),
  CONSTRAINT `owner_billing_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Ensure owner_payment table exists
CREATE TABLE IF NOT EXISTS `owner_payment` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `ownerId` INT(11) NOT NULL,
  `billingId` INT(11) DEFAULT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'LKR',
  `method` ENUM('cash','card','bank','online') NOT NULL DEFAULT 'bank',
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `paidAt` DATETIME(3) DEFAULT NULL,
  `proofUrl` VARCHAR(500) DEFAULT NULL,
  `proofType` VARCHAR(100) DEFAULT NULL,
  `note` VARCHAR(500) DEFAULT NULL,
  `approvedBy` INT(11) DEFAULT NULL,
  `approvedAt` DATETIME(3) DEFAULT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `owner_payment_owner_idx` (`ownerId`),
  KEY `owner_payment_billing_idx` (`billingId`),
  CONSTRAINT `owner_payment_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Done! Your database now supports:
--   - Per-owner custom package pricing (user.packagePrice)
--   - Promotion / free trial flagging (owner_billing.isPromotion)
--   - Billing cycle tracking (owner_billing.billingCycle: monthly/yearly)
--   - Discount tracking per billing record (owner_billing.discount)
--   - Notes on billing records
--   - User login and activity tracking (lastLoginAt, lastActiveAt)
