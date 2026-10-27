-- Mold Tracking System - SQL Server schema (idempotent)
--
-- `npm run db:init` creates the database named in DB_NAME (if missing) and applies this file.
-- To apply it by hand: CREATE DATABASE MoldTracking; then USE MoldTracking; and run this script.
-- Batches are separated by lines containing only GO.

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    username       NVARCHAR(50)  NOT NULL,
    password_hash  NVARCHAR(100) NOT NULL,
    full_name      NVARCHAR(100) NOT NULL,
    email          NVARCHAR(120) NULL,
    department     NVARCHAR(60)  NULL,
    role           NVARCHAR(20)  NOT NULL CONSTRAINT df_users_role DEFAULT N'viewer',
    is_active      BIT           NOT NULL CONSTRAINT df_users_active DEFAULT 1,
    created_at     DATETIME2     NOT NULL CONSTRAINT df_users_created DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2     NULL,
    last_login_at  DATETIME2     NULL,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (role IN (N'admin', N'engineer', N'viewer'))
);
GO

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
CREATE TABLE dbo.suppliers (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    name           NVARCHAR(100) NOT NULL,
    country        NVARCHAR(60)  NULL,
    contact_email  NVARCHAR(120) NULL,
    created_at     DATETIME2     NOT NULL CONSTRAINT df_suppliers_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_suppliers_name UNIQUE (name)
);
GO

IF OBJECT_ID(N'dbo.molds', N'U') IS NULL
CREATE TABLE dbo.molds (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    code           NVARCHAR(50)  NOT NULL,
    name           NVARCHAR(150) NOT NULL,
    project        NVARCHAR(100) NULL,
    status         NVARCHAR(20)  NOT NULL CONSTRAINT df_molds_status DEFAULT N'trial',
    supplier_id    INT           NULL,
    cavities       INT           NOT NULL CONSTRAINT df_molds_cavities DEFAULT 1,
    material       NVARCHAR(100) NULL,
    start_date     DATE          NULL,
    deadline       DATE          NULL,
    cost           DECIMAL(12,2) NOT NULL CONSTRAINT df_molds_cost DEFAULT 0,
    payment_status NVARCHAR(20)  NOT NULL CONSTRAINT df_molds_payment DEFAULT N'unpaid',
    notes          NVARCHAR(MAX) NULL,
    is_archived    BIT           NOT NULL CONSTRAINT df_molds_archived DEFAULT 0,
    archived_at    DATETIME2     NULL,
    created_by     INT           NULL,
    updated_by     INT           NULL,
    created_at     DATETIME2     NOT NULL CONSTRAINT df_molds_created DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2     NULL,
    CONSTRAINT uq_molds_code UNIQUE (code),
    CONSTRAINT fk_molds_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT fk_molds_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(id),
    CONSTRAINT fk_molds_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.users(id),
    CONSTRAINT ck_molds_status CHECK (status IN (N'trial', N'active', N'revision', N'maintenance', N'retired')),
    CONSTRAINT ck_molds_payment CHECK (payment_status IN (N'unpaid', N'partial', N'paid')),
    CONSTRAINT ck_molds_cavities CHECK (cavities >= 1)
);
GO

IF OBJECT_ID(N'dbo.mold_trials', N'U') IS NULL
CREATE TABLE dbo.mold_trials (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    mold_id     INT           NOT NULL,
    trial_date  DATE          NOT NULL,
    material    NVARCHAR(100) NULL,
    color       NVARCHAR(50)  NULL,
    quantity    INT           NOT NULL CONSTRAINT df_trials_quantity DEFAULT 0,
    outcome     NVARCHAR(20)  NOT NULL CONSTRAINT df_trials_outcome DEFAULT N'pass',
    result      NVARCHAR(MAX) NULL,
    operator    NVARCHAR(100) NULL,
    created_at  DATETIME2     NOT NULL CONSTRAINT df_trials_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_trials_mold FOREIGN KEY (mold_id) REFERENCES dbo.molds(id) ON DELETE CASCADE,
    CONSTRAINT ck_trials_outcome CHECK (outcome IN (N'pass', N'conditional', N'fail'))
);
GO

IF OBJECT_ID(N'dbo.mold_revisions', N'U') IS NULL
CREATE TABLE dbo.mold_revisions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    mold_id         INT           NOT NULL,
    revision_date   DATE          NOT NULL,
    vendor          NVARCHAR(100) NULL,
    work_done       NVARCHAR(MAX) NOT NULL,
    cost            DECIMAL(12,2) NOT NULL CONSTRAINT df_revisions_cost DEFAULT 0,
    payment_status  NVARCHAR(20)  NOT NULL CONSTRAINT df_revisions_payment DEFAULT N'unpaid',
    notes           NVARCHAR(MAX) NULL,
    created_at      DATETIME2     NOT NULL CONSTRAINT df_revisions_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_revisions_mold FOREIGN KEY (mold_id) REFERENCES dbo.molds(id) ON DELETE CASCADE,
    CONSTRAINT ck_revisions_payment CHECK (payment_status IN (N'unpaid', N'partial', N'paid'))
);
GO

IF OBJECT_ID(N'dbo.mold_maintenance', N'U') IS NULL
CREATE TABLE dbo.mold_maintenance (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    mold_id           INT           NOT NULL,
    maintenance_date  DATE          NOT NULL,
    description       NVARCHAR(MAX) NOT NULL,
    technician        NVARCHAR(100) NULL,
    status            NVARCHAR(20)  NOT NULL CONSTRAINT df_maintenance_status DEFAULT N'completed',
    cost              DECIMAL(12,2) NOT NULL CONSTRAINT df_maintenance_cost DEFAULT 0,
    created_at        DATETIME2     NOT NULL CONSTRAINT df_maintenance_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_maintenance_mold FOREIGN KEY (mold_id) REFERENCES dbo.molds(id) ON DELETE CASCADE,
    CONSTRAINT ck_maintenance_status CHECK (status IN (N'planned', N'in_progress', N'completed'))
);
GO

IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NULL
CREATE TABLE dbo.refresh_tokens (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT           NOT NULL,
    token_hash   CHAR(64)      NOT NULL,
    expires_at   DATETIME2     NOT NULL,
    revoked_at   DATETIME2     NULL,
    created_at   DATETIME2     NOT NULL CONSTRAINT df_refresh_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_refresh_hash UNIQUE (token_hash)
);
GO

IF OBJECT_ID(N'dbo.activity_logs', N'U') IS NULL
CREATE TABLE dbo.activity_logs (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT           NULL,
    action       NVARCHAR(50)  NOT NULL,
    entity_type  NVARCHAR(50)  NULL,
    entity_id    INT           NULL,
    description  NVARCHAR(MAX) NULL,
    created_at   DATETIME2     NOT NULL CONSTRAINT df_activity_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE SET NULL
);
GO

IF OBJECT_ID(N'dbo.login_logs', N'U') IS NULL
CREATE TABLE dbo.login_logs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NULL,
    username    NVARCHAR(50)  NOT NULL,
    success     BIT           NOT NULL,
    ip_address  NVARCHAR(64)  NULL,
    user_agent  NVARCHAR(255) NULL,
    created_at  DATETIME2     NOT NULL CONSTRAINT df_login_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE SET NULL
);
GO

-- Indexes for the list / filter / dashboard queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_molds_status' AND object_id = OBJECT_ID(N'dbo.molds'))
    CREATE INDEX ix_molds_status ON dbo.molds (is_archived, status) INCLUDE (deadline, cost, supplier_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_molds_supplier' AND object_id = OBJECT_ID(N'dbo.molds'))
    CREATE INDEX ix_molds_supplier ON dbo.molds (supplier_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_trials_mold' AND object_id = OBJECT_ID(N'dbo.mold_trials'))
    CREATE INDEX ix_trials_mold ON dbo.mold_trials (mold_id, trial_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_revisions_mold' AND object_id = OBJECT_ID(N'dbo.mold_revisions'))
    CREATE INDEX ix_revisions_mold ON dbo.mold_revisions (mold_id, revision_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_maintenance_mold' AND object_id = OBJECT_ID(N'dbo.mold_maintenance'))
    CREATE INDEX ix_maintenance_mold ON dbo.mold_maintenance (mold_id, maintenance_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_activity_created' AND object_id = OBJECT_ID(N'dbo.activity_logs'))
    CREATE INDEX ix_activity_created ON dbo.activity_logs (created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_login_created' AND object_id = OBJECT_ID(N'dbo.login_logs'))
    CREATE INDEX ix_login_created ON dbo.login_logs (created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_refresh_user' AND object_id = OBJECT_ID(N'dbo.refresh_tokens'))
    CREATE INDEX ix_refresh_user ON dbo.refresh_tokens (user_id);
GO
