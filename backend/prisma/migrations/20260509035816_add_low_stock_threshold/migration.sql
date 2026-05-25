-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "lowStockThreshold" DECIMAL(10,2) NOT NULL DEFAULT 100;
