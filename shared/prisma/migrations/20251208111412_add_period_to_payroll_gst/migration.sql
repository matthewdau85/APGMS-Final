-- CreateTable
CREATE TABLE "GstTransaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" VARCHAR(16) NOT NULL,
    "gstCents" INTEGER NOT NULL,

    CONSTRAINT "GstTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" VARCHAR(16) NOT NULL,
    "paygwCents" INTEGER NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);
