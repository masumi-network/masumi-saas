/*
  Warnings:

  - You are about to drop the column `veridianAid` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `veridianCredentialId` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "veridianAid",
DROP COLUMN "veridianCredentialId";
