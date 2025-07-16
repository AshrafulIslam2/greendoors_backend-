/*
  Warnings:

  - A unique constraint covering the columns `[userPersonalInfoId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nomineeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userTypeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_userPersonalInfoId_key" ON "User"("userPersonalInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "User_nomineeId_key" ON "User"("nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userTypeId_key" ON "User"("userTypeId");
