-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "query" JSONB,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "request_body" JSONB,
    "response_body" JSONB,
    "error_message" TEXT,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_method_idx" ON "audit_logs"("method");

-- CreateIndex
CREATE INDEX "audit_logs_path_idx" ON "audit_logs"("path");
