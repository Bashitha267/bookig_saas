-- Admin schema updates for owner billing, approvals, and access control
-- Run after selecting your database in phpMyAdmin.

ALTER TABLE `user`
  ADD COLUMN IF NOT EXISTS `email` varchar(191) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `status` enum('active','blocked') NOT NULL DEFAULT 'active';

ALTER TABLE `property`
  ADD COLUMN IF NOT EXISTS `status` enum('active','blocked') NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS `owner_billing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ownerId` int(11) NOT NULL,
  `periodStart` date NOT NULL,
  `periodEnd` date NOT NULL,
  `amountDue` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amountPaid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_billing_period_unique` (`ownerId`, `periodStart`, `periodEnd`),
  KEY `owner_billing_owner_idx` (`ownerId`),
  CONSTRAINT `owner_billing_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `owner_payment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ownerId` int(11) NOT NULL,
  `billingId` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'LKR',
  `method` enum('cash','card','bank','online') NOT NULL DEFAULT 'bank',
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `paidAt` datetime(3) DEFAULT NULL,
  `proofUrl` varchar(500) DEFAULT NULL,
  `proofType` varchar(100) DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `approvedBy` int(11) DEFAULT NULL,
  `approvedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `owner_payment_owner_idx` (`ownerId`),
  KEY `owner_payment_billing_idx` (`billingId`),
  KEY `owner_payment_status_idx` (`status`),
  CONSTRAINT `owner_payment_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `owner_payment_billing_fk` FOREIGN KEY (`billingId`) REFERENCES `owner_billing` (`id`) ON DELETE SET NULL,
  CONSTRAINT `owner_payment_approved_by_fk` FOREIGN KEY (`approvedBy`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
