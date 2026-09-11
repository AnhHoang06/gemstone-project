/* =========================================================
   DATABASE: GemstoneShop
   ========================================================= */

IF DB_ID(N'GemstoneShop') IS NULL
BEGIN
    EXEC('CREATE DATABASE GemstoneShop');
END
GO

USE GemstoneShop;
GO


/* =========================================================
   1. ROLES
   ========================================================= */

CREATE TABLE Roles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL,

    CONSTRAINT UQ_Roles_Name UNIQUE (Name)
);
GO


/* =========================================================
   2. USERS
   ========================================================= */

CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RoleId INT NOT NULL,

    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,

    Phone NVARCHAR(20) NULL,
    Address NVARCHAR(500) NULL,

    IsActive BIT NOT NULL
        CONSTRAINT DF_Users_IsActive DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),

    UpdatedAt DATETIME2 NULL,

    CONSTRAINT UQ_Users_Email UNIQUE (Email),

    CONSTRAINT FK_Users_Roles
        FOREIGN KEY (RoleId)
        REFERENCES Roles(Id)
);
GO


/* =========================================================
   3. CATEGORIES
   ========================================================= */

CREATE TABLE Categories (
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,

    IsActive BIT NOT NULL
        CONSTRAINT DF_Categories_IsActive DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_Categories_CreatedAt DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_Categories_Name UNIQUE (Name)
);
GO


/* =========================================================
   4. PRODUCTS
   ========================================================= */

CREATE TABLE Products (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CategoryId INT NOT NULL,

    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,

    Price DECIMAL(18,2) NOT NULL,
    Stock INT NOT NULL,

    Carat DECIMAL(6,2) NULL,
    Color NVARCHAR(100) NULL,
    Clarity NVARCHAR(100) NULL,
    Cut NVARCHAR(100) NULL,
    Origin NVARCHAR(150) NULL,

    IsActive BIT NOT NULL
        CONSTRAINT DF_Products_IsActive DEFAULT 1,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME(),

    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_Products_Categories
        FOREIGN KEY (CategoryId)
        REFERENCES Categories(Id),

    CONSTRAINT CK_Products_Price
        CHECK (Price >= 0),

    CONSTRAINT CK_Products_Stock
        CHECK (Stock >= 0),

    CONSTRAINT CK_Products_Carat
        CHECK (Carat IS NULL OR Carat > 0)
);
GO


/* =========================================================
   5. PRODUCT IMAGES
   ========================================================= */

CREATE TABLE ProductImages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProductId INT NOT NULL,

    ImageUrl NVARCHAR(1000) NOT NULL,

    IsPrimary BIT NOT NULL
        CONSTRAINT DF_ProductImages_IsPrimary DEFAULT 0,

    SortOrder INT NOT NULL
        CONSTRAINT DF_ProductImages_SortOrder DEFAULT 0,

    CONSTRAINT FK_ProductImages_Products
        FOREIGN KEY (ProductId)
        REFERENCES Products(Id),

    CONSTRAINT CK_ProductImages_SortOrder
        CHECK (SortOrder >= 0)
);
GO


/* =========================================================
   6. CERTIFICATES
   ========================================================= */

CREATE TABLE Certificates (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProductId INT NOT NULL,

    CertificateNumber NVARCHAR(100) NOT NULL,
    Authority NVARCHAR(100) NOT NULL,

    IssueDate DATE NULL,
    CertificateUrl NVARCHAR(1000) NULL,
    Notes NVARCHAR(500) NULL,

    CONSTRAINT UQ_Certificates_ProductId
        UNIQUE (ProductId),

    CONSTRAINT UQ_Certificates_Number
        UNIQUE (CertificateNumber),

    CONSTRAINT FK_Certificates_Products
        FOREIGN KEY (ProductId)
        REFERENCES Products(Id)
);
GO


/* =========================================================
   7. CARTS
   ========================================================= */

CREATE TABLE Carts (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_Carts_CreatedAt DEFAULT SYSUTCDATETIME(),

    UpdatedAt DATETIME2 NULL,

    CONSTRAINT UQ_Carts_UserId
        UNIQUE (UserId),

    CONSTRAINT FK_Carts_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(Id)
);
GO


/* =========================================================
   8. CART ITEMS
   ========================================================= */

CREATE TABLE CartItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,

    CartId INT NOT NULL,
    ProductId INT NOT NULL,

    Quantity INT NOT NULL,

    CONSTRAINT FK_CartItems_Carts
        FOREIGN KEY (CartId)
        REFERENCES Carts(Id),

    CONSTRAINT FK_CartItems_Products
        FOREIGN KEY (ProductId)
        REFERENCES Products(Id),

    CONSTRAINT UQ_CartItems_Cart_Product
        UNIQUE (CartId, ProductId),

    CONSTRAINT CK_CartItems_Quantity
        CHECK (Quantity > 0)
);
GO


/* =========================================================
   9. ORDER STATUSES
   ========================================================= */

CREATE TABLE OrderStatuses (
    Id INT IDENTITY(1,1) PRIMARY KEY,

    Name NVARCHAR(50) NOT NULL,

    CONSTRAINT UQ_OrderStatuses_Name
        UNIQUE (Name)
);
GO


/* =========================================================
   10. ORDERS
   ========================================================= */

CREATE TABLE Orders (
    Id INT IDENTITY(1,1) PRIMARY KEY,

    UserId INT NOT NULL,
    StatusId INT NOT NULL,

    RecipientName NVARCHAR(100) NOT NULL,
    RecipientPhone NVARCHAR(20) NOT NULL,
    ShippingAddress NVARCHAR(500) NOT NULL,

    TotalAmount DECIMAL(18,2) NOT NULL,

    Note NVARCHAR(500) NULL,

    CreatedAt DATETIME2 NOT NULL
        CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),

    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_Orders_Users
        FOREIGN KEY (UserId)
        REFERENCES Users(Id),

    CONSTRAINT FK_Orders_OrderStatuses
        FOREIGN KEY (StatusId)
        REFERENCES OrderStatuses(Id),

    CONSTRAINT CK_Orders_TotalAmount
        CHECK (TotalAmount >= 0)
);
GO


/* =========================================================
   11. ORDER DETAILS
   ========================================================= */

CREATE TABLE OrderDetails (
    Id INT IDENTITY(1,1) PRIMARY KEY,

    OrderId INT NOT NULL,
    ProductId INT NOT NULL,

    ProductName NVARCHAR(200) NOT NULL,

    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,

    CONSTRAINT FK_OrderDetails_Orders
        FOREIGN KEY (OrderId)
        REFERENCES Orders(Id),

    CONSTRAINT FK_OrderDetails_Products
        FOREIGN KEY (ProductId)
        REFERENCES Products(Id),

    CONSTRAINT CK_OrderDetails_Quantity
        CHECK (Quantity > 0),

    CONSTRAINT CK_OrderDetails_UnitPrice
        CHECK (UnitPrice >= 0)
);
GO


/* =========================================================
   SEED DATA
   ========================================================= */

INSERT INTO Roles (Name)
VALUES
    (N'Admin'),
    (N'Customer');
GO

INSERT INTO OrderStatuses (Name)
VALUES
    (N'Pending'),
    (N'Confirmed'),
    (N'Shipping'),
    (N'Completed'),
    (N'Cancelled');
GO

INSERT INTO Categories (Name, Description)
VALUES
    (N'Ruby', N'Đá Ruby'),
    (N'Sapphire', N'Đá Sapphire'),
    (N'Emerald', N'Đá Emerald'),
    (N'Diamond', N'Kim cương'),
    (N'Amethyst', N'Đá thạch anh tím');
GO