-- Additive Database First extension: consultation services, weekly hours, closed dates and appointments.
-- Run with the target database selected (sqlcmd -d <database> -b -f 65001 -i Consultation.sql). No USE statement.
-- Repeatable: only creates objects that are missing; never drops or rewrites existing data.
-- Appointments.StartAt/EndAt are store-local times (Asia/Ho_Chi_Minh, no offset); CreatedAt/UpdatedAt are UTC.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock = sys.sp_getapplock @Resource=N'GemAurelia:ConsultationSchema', @LockMode='Exclusive', @LockOwner='Transaction';
IF @lock < 0 THROW 51000, 'Cannot acquire schema lock', 1;

IF OBJECT_ID(N'dbo.ConsultationServices', N'U') IS NULL
CREATE TABLE dbo.ConsultationServices (
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ConsultationServices PRIMARY KEY,
    Name nvarchar(150) NOT NULL,
    Description nvarchar(500) NULL,
    Price decimal(18,2) NOT NULL CONSTRAINT DF_ConsultationServices_Price DEFAULT 0,
    DurationMinutes int NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_ConsultationServices_IsActive DEFAULT 1,
    SortOrder int NOT NULL CONSTRAINT DF_ConsultationServices_SortOrder DEFAULT 0,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_ConsultationServices_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NULL,
    CONSTRAINT UQ_ConsultationServices_Name UNIQUE (Name),
    CONSTRAINT CK_ConsultationServices_Price CHECK (Price >= 0),
    CONSTRAINT CK_ConsultationServices_Duration CHECK (DurationMinutes BETWEEN 15 AND 240),
    CONSTRAINT CK_ConsultationServices_Name CHECK (LEN(LTRIM(RTRIM(Name))) > 0)
);

IF OBJECT_ID(N'dbo.ConsultationHours', N'U') IS NULL
CREATE TABLE dbo.ConsultationHours (
    DayOfWeek tinyint NOT NULL CONSTRAINT PK_ConsultationHours PRIMARY KEY, -- 0 = Sunday ... 6 = Saturday
    IsOpen bit NOT NULL,
    OpenTime time(0) NOT NULL,
    CloseTime time(0) NOT NULL,
    SlotMinutes int NOT NULL,
    CapacityPerSlot int NOT NULL,
    CONSTRAINT CK_ConsultationHours_Day CHECK (DayOfWeek BETWEEN 0 AND 6),
    CONSTRAINT CK_ConsultationHours_Slot CHECK (SlotMinutes BETWEEN 15 AND 240),
    CONSTRAINT CK_ConsultationHours_Capacity CHECK (CapacityPerSlot BETWEEN 1 AND 20),
    CONSTRAINT CK_ConsultationHours_Range CHECK (IsOpen = 0 OR OpenTime < CloseTime)
);

IF OBJECT_ID(N'dbo.ConsultationClosedDates', N'U') IS NULL
CREATE TABLE dbo.ConsultationClosedDates (
    [Date] date NOT NULL CONSTRAINT PK_ConsultationClosedDates PRIMARY KEY,
    Reason nvarchar(200) NULL
);

IF OBJECT_ID(N'dbo.Appointments', N'U') IS NULL
CREATE TABLE dbo.Appointments (
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Appointments PRIMARY KEY,
    UserId int NOT NULL CONSTRAINT FK_Appointments_Users REFERENCES dbo.Users(Id),
    ServiceId int NOT NULL CONSTRAINT FK_Appointments_ConsultationServices REFERENCES dbo.ConsultationServices(Id),
    ServiceName nvarchar(150) NOT NULL,
    Price decimal(18,2) NOT NULL,
    StartAt datetime2(0) NOT NULL,
    EndAt datetime2(0) NOT NULL,
    Status varchar(20) NOT NULL CONSTRAINT DF_Appointments_Status DEFAULT 'Pending',
    ContactName nvarchar(100) NOT NULL,
    Phone nvarchar(20) NOT NULL,
    Note nvarchar(500) NULL,
    CancelReason nvarchar(300) NULL,
    CancelledBy varchar(20) NULL,
    RequestId uniqueidentifier NOT NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_Appointments_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NULL,
    CONSTRAINT UQ_Appointments_UserRequest UNIQUE (UserId, RequestId),
    CONSTRAINT CK_Appointments_Status CHECK (Status IN ('Pending','Confirmed','Completed','Cancelled','NoShow')),
    CONSTRAINT CK_Appointments_CancelledBy CHECK (CancelledBy IS NULL OR CancelledBy IN ('Customer','Staff')),
    CONSTRAINT CK_Appointments_Range CHECK (EndAt > StartAt),
    CONSTRAINT CK_Appointments_Price CHECK (Price >= 0)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Appointments_StartAt_Status' AND object_id = OBJECT_ID(N'dbo.Appointments'))
    EXEC(N'CREATE INDEX IX_Appointments_StartAt_Status ON dbo.Appointments(StartAt, Status) INCLUDE (EndAt)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Appointments_User_StartAt' AND object_id = OBJECT_ID(N'dbo.Appointments'))
    EXEC(N'CREATE INDEX IX_Appointments_User_StartAt ON dbo.Appointments(UserId, StartAt)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Appointments_ServiceId' AND object_id = OBJECT_ID(N'dbo.Appointments'))
    EXEC(N'CREATE INDEX IX_Appointments_ServiceId ON dbo.Appointments(ServiceId)');
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK;
THROW;
END CATCH;
