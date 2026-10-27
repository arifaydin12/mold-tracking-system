-- Mold Tracking System - SQL Server schema
IF DB_ID('TakipKalipDB') IS NULL CREATE DATABASE TakipKalipDB;
GO
USE TakipKalipDB;
GO

-- Users (passwords are stored as bcrypt hashes)
CREATE TABLE Kullanicilar (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    kullaniciAdi        NVARCHAR(50)  NOT NULL UNIQUE,
    sifre               NVARCHAR(100) NOT NULL,
    adSoyad             NVARCHAR(100) NOT NULL,
    email               NVARCHAR(120) NULL,
    telefon             NVARCHAR(30)  NULL,
    rol                 NVARCHAR(20)  NOT NULL DEFAULT N'kullanici',   -- 'admin' | 'kullanici'
    departman           NVARCHAR(60)  NULL,
    aktif               BIT           NOT NULL DEFAULT 1,
    olusturmaTarihi     DATETIME      NOT NULL DEFAULT GETDATE(),
    sonGuncellemeTarihi DATETIME      NULL,
    sonGirisTarihi      DATETIME      NULL
);

-- Molds
CREATE TABLE Kaliplar (
    id                     INT IDENTITY(1,1) PRIMARY KEY,
    kod                    NVARCHAR(50)  NOT NULL,
    ad                     NVARCHAR(150) NOT NULL,
    proje                  NVARCHAR(100) NULL,
    durum                  NVARCHAR(30)  NOT NULL DEFAULT N'deneme',
    tedarikci              NVARCHAR(100) NULL,
    gozSayisi              INT           NOT NULL DEFAULT 1,
    malzeme                NVARCHAR(100) NULL,
    olusturmaTarihi        DATE          NULL,
    termin                 DATE          NULL,
    maliyet                DECIMAL(10,2) NOT NULL DEFAULT 0,
    odemeDurumu            NVARCHAR(30)  NOT NULL DEFAULT N'Ödenmedi',
    notlar                 NVARCHAR(MAX) NULL,
    olusturanKullaniciId   INT NULL REFERENCES Kullanicilar(id),
    guncelleyenKullaniciId INT NULL REFERENCES Kullanicilar(id)
);

-- Trial runs
CREATE TABLE Deneme (
    id       INT IDENTITY(1,1) PRIMARY KEY,
    kalipId  INT NOT NULL REFERENCES Kaliplar(id) ON DELETE CASCADE,
    tarih    DATE NULL,
    hammadde NVARCHAR(100) NULL,
    renk     NVARCHAR(50)  NULL,
    adet     INT NOT NULL DEFAULT 0,
    sonuc    NVARCHAR(MAX) NULL,
    operator NVARCHAR(100) NULL
);

-- Revisions
CREATE TABLE Revizyon (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    kalipId     INT NOT NULL REFERENCES Kaliplar(id) ON DELETE CASCADE,
    tarih       DATE NULL,
    firma       NVARCHAR(100) NULL,
    islem       NVARCHAR(MAX) NULL,
    fiyat       DECIMAL(10,2) NOT NULL DEFAULT 0,
    odemeDurumu NVARCHAR(30)  NULL,
    aciklama    NVARCHAR(MAX) NULL
);

-- Maintenance
CREATE TABLE Bakim (
    id      INT IDENTITY(1,1) PRIMARY KEY,
    kalipId INT NOT NULL REFERENCES Kaliplar(id) ON DELETE CASCADE,
    tarih   DATE NULL,
    islem   NVARCHAR(MAX) NULL,
    sorumlu NVARCHAR(100) NULL,
    durum   NVARCHAR(30)  NOT NULL DEFAULT N'Tamamlandı'
);

-- Audit trail
CREATE TABLE AktiviteLoglari (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    kullaniciId INT NULL REFERENCES Kullanicilar(id),
    islem      NVARCHAR(50)  NOT NULL,
    tabloAdi   NVARCHAR(50)  NULL,
    kayitId    INT NULL,
    aciklama   NVARCHAR(MAX) NULL,
    islemTarihi DATETIME NOT NULL DEFAULT GETDATE()
);

-- Login attempts
CREATE TABLE GirisLoglari (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    kullaniciId INT NULL REFERENCES Kullanicilar(id),
    basarili    BIT NOT NULL,
    girisTarihi DATETIME NOT NULL DEFAULT GETDATE()
);
GO
