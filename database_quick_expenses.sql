-- =====================================================================
-- Quick Expenses & Booking Charges Migration
-- Run this in phpMyAdmin inside your database:
-- =====================================================================

-- 1. Add expenses column to booking table to store charges as a JSON array
ALTER TABLE `booking`
  ADD COLUMN IF NOT EXISTS `expenses` TEXT DEFAULT NULL;

-- 2. Add quickExpenses column to property table to store configured quick expense shortcuts
ALTER TABLE `property`
  ADD COLUMN IF NOT EXISTS `quickExpenses` TEXT DEFAULT NULL;
