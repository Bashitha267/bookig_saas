-- Booking SaaS schema for MariaDB/MySQL
-- Use in phpMyAdmin: select your DB, then run this file.

CREATE TABLE IF NOT EXISTS `user` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`firstName` varchar(191) NOT NULL,
	`lastName` varchar(191) NOT NULL,
	`nicNumber` varchar(191) DEFAULT NULL,
	`contact` varchar(191) NOT NULL,
	`whatsapp` varchar(191) NOT NULL,
	`address` varchar(191) NOT NULL,
	`role` enum('admin','owner','staff') NOT NULL,
	`password` varchar(191) NOT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
	`updatedAt` datetime(3) NOT NULL,
	`ownerId` int(11) DEFAULT NULL,
	`username` varchar(191) NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `user_contact_unique` (`contact`),
	UNIQUE KEY `user_username_unique` (`username`),
	KEY `user_owner_idx` (`ownerId`),
	CONSTRAINT `user_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `property` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`ownerId` int(11) NOT NULL,
	`name` varchar(191) NOT NULL,
	`address` varchar(191) NOT NULL,
	`city` varchar(100) DEFAULT NULL,
	`country` varchar(100) DEFAULT NULL,
	`phone` varchar(50) DEFAULT NULL,
	`email` varchar(191) DEFAULT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
	`updatedAt` datetime(3) NOT NULL,
	PRIMARY KEY (`id`),
	KEY `property_owner_idx` (`ownerId`),
	CONSTRAINT `property_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `room` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`propertyId` int(11) NOT NULL,
	`ownerId` int(11) NOT NULL,
	`roomNumber` varchar(50) NOT NULL,
	`roomType` varchar(50) NOT NULL,
	`floor` int(11) DEFAULT NULL,
	`capacityAdults` int(11) NOT NULL DEFAULT 1,
	`capacityChildren` int(11) NOT NULL DEFAULT 0,
	`price` decimal(10,2) NOT NULL DEFAULT 0.00,
	`status` enum('available','maintenance','blocked') NOT NULL DEFAULT 'available',
	`createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
	`updatedAt` datetime(3) NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `room_property_number_unique` (`propertyId`, `roomNumber`),
	KEY `room_owner_idx` (`ownerId`),
	CONSTRAINT `room_property_fk` FOREIGN KEY (`propertyId`) REFERENCES `property` (`id`) ON DELETE CASCADE,
	CONSTRAINT `room_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `booking` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`ownerId` int(11) NOT NULL,
	`roomId` int(11) NOT NULL,
	`guestName` varchar(191) NOT NULL,
	`guestContact` varchar(100) NOT NULL,
	`guestNic` varchar(191) DEFAULT NULL,
	`checkInDate` date NOT NULL,
	`checkOutDate` date NOT NULL,
	`adults` int(11) NOT NULL DEFAULT 1,
	`children` int(11) NOT NULL DEFAULT 0,
	`status` enum('pending','confirmed','checked-in','checked-out','cancelled') NOT NULL DEFAULT 'pending',
	`notes` varchar(500) DEFAULT NULL,
	`createdBy` int(11) NOT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
	`updatedAt` datetime(3) NOT NULL,
	PRIMARY KEY (`id`),
	KEY `booking_owner_idx` (`ownerId`),
	KEY `booking_room_idx` (`roomId`),
	CONSTRAINT `booking_room_fk` FOREIGN KEY (`roomId`) REFERENCES `room` (`id`) ON DELETE CASCADE,
	CONSTRAINT `booking_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
	CONSTRAINT `booking_created_by_fk` FOREIGN KEY (`createdBy`) REFERENCES `user` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payment` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`ownerId` int(11) NOT NULL,
	`bookingId` int(11) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`method` enum('cash','card','bank','online') NOT NULL DEFAULT 'cash',
	`status` enum('pending','paid','refunded') NOT NULL DEFAULT 'paid',
	`paidAt` datetime(3) DEFAULT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
	`updatedAt` datetime(3) NOT NULL,
	PRIMARY KEY (`id`),
	KEY `payment_owner_idx` (`ownerId`),
	KEY `payment_booking_idx` (`bookingId`),
	CONSTRAINT `payment_booking_fk` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON DELETE CASCADE,
	CONSTRAINT `payment_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
