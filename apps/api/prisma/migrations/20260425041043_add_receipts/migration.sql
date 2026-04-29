-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ReceiptUnit" AS ENUM ('pcs', 'lusin', 'pak', 'kotak', 'karton');

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "customer_name" VARCHAR(255),
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "finalized_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name_snapshot" VARCHAR(500),
    "quantity" INTEGER,
    "unit_type" "ReceiptUnit",
    "price_snapshot" INTEGER,
    "discount_per_unit" INTEGER DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "receipts_deleted_at_idx" ON "receipts"("deleted_at");

-- CreateIndex
CREATE INDEX "receipts_created_at_idx" ON "receipts"("created_at");

-- CreateIndex
CREATE INDEX "receipt_items_receipt_id_idx" ON "receipt_items"("receipt_id");

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
