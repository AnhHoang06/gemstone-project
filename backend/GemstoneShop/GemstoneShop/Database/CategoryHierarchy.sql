SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.Categories', 'ParentId') IS NULL
    ALTER TABLE dbo.Categories ADD ParentId int NULL;
IF COL_LENGTH('dbo.Categories', 'SortOrder') IS NULL
    ALTER TABLE dbo.Categories ADD SortOrder int NOT NULL CONSTRAINT DF_Categories_SortOrder DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_Categories_Parent')
    EXEC('ALTER TABLE dbo.Categories WITH CHECK ADD CONSTRAINT FK_Categories_Parent FOREIGN KEY(ParentId) REFERENCES dbo.Categories(Id)');
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name='UQ_Categories_Name' AND parent_object_id=OBJECT_ID('dbo.Categories'))
    ALTER TABLE dbo.Categories DROP CONSTRAINT UQ_Categories_Name;
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_Categories_Name' AND object_id=OBJECT_ID('dbo.Categories'))
    DROP INDEX UQ_Categories_Name ON dbo.Categories;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_Categories_Parent_Name' AND object_id=OBJECT_ID('dbo.Categories'))
    EXEC('CREATE UNIQUE INDEX UQ_Categories_Parent_Name ON dbo.Categories(ParentId, Name)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Categories_ParentId' AND object_id=OBJECT_ID('dbo.Categories'))
    EXEC('CREATE INDEX IX_Categories_ParentId ON dbo.Categories(ParentId)');
COMMIT;
