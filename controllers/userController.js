const { getPool, sql } = require('../config/db');
const { logAktivite } = require('../middleware/logger');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

exports.getAllUsers = async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.request()
            .query('SELECT id, kullaniciAdi, adSoyad, email, telefon, rol, departman, aktif, olusturmaTarihi, sonGirisTarihi FROM Kullanicilar ORDER BY adSoyad');

        res.json(result.recordset);
    } catch (err) {
        console.error('Kullanıcı listeleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { kullaniciAdi, sifre, adSoyad, email, telefon, rol, departman } = req.body;
        const pool = getPool();

        if (!kullaniciAdi || !sifre || !adSoyad || !rol) {
            return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
        }

        const mevcutKullanici = await pool.request()
            .input('kullaniciAdi', sql.NVarChar, kullaniciAdi)
            .query('SELECT id FROM Kullanicilar WHERE kullaniciAdi = @kullaniciAdi');

        if (mevcutKullanici.recordset.length > 0) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
        }

        const hashedPassword = await bcrypt.hash(sifre, SALT_ROUNDS);

        const result = await pool.request()
            .input('kullaniciAdi', sql.NVarChar, kullaniciAdi)
            .input('sifre', sql.NVarChar, hashedPassword)
            .input('adSoyad', sql.NVarChar, adSoyad)
            .input('email', sql.NVarChar, email)
            .input('telefon', sql.NVarChar, telefon)
            .input('rol', sql.NVarChar, rol)
            .input('departman', sql.NVarChar, departman)
            .query(`INSERT INTO Kullanicilar (kullaniciAdi, sifre, adSoyad, email, telefon, rol, departman) 
                    OUTPUT INSERTED.id
                    VALUES (@kullaniciAdi, @sifre, @adSoyad, @email, @telefon, @rol, @departman)`);

        const yeniId = result.recordset[0].id;
        await logAktivite(req.user.id, 'KULLANICI_EKLEME', 'Kullanicilar', yeniId, `Yeni kullanıcı: ${adSoyad}`);

        res.json({ success: true, message: 'Kullanıcı eklendi', id: yeniId });
    } catch (err) {
        console.error('Kullanıcı ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { adSoyad, email, telefon, rol, departman, aktif } = req.body;
        const pool = getPool();

        await pool.request()
            .input('id', sql.Int, id)
            .input('adSoyad', sql.NVarChar, adSoyad)
            .input('email', sql.NVarChar, email)
            .input('telefon', sql.NVarChar, telefon)
            .input('rol', sql.NVarChar, rol)
            .input('departman', sql.NVarChar, departman)
            .input('aktif', sql.Bit, aktif)
            .query(`UPDATE Kullanicilar SET 
                    adSoyad=@adSoyad, email=@email, telefon=@telefon, 
                    rol=@rol, departman=@departman, aktif=@aktif, 
                    sonGuncellemeTarihi=GETDATE() 
                    WHERE id=@id`);

        await logAktivite(req.user.id, 'KULLANICI_GUNCELLEME', 'Kullanicilar', id, `Kullanıcı güncellendi: ${adSoyad}`);

        res.json({ success: true, message: 'Kullanıcı güncellendi' });
    } catch (err) {
        console.error('Kullanıcı güncelleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { yeniSifre } = req.body;
        const pool = getPool();

        if (!yeniSifre || yeniSifre.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
        }

        const hashedPassword = await bcrypt.hash(yeniSifre, SALT_ROUNDS);

        await pool.request()
            .input('id', sql.Int, id)
            .input('sifre', sql.NVarChar, hashedPassword)
            .query('UPDATE Kullanicilar SET sifre = @sifre, sonGuncellemeTarihi = GETDATE() WHERE id = @id');

        await logAktivite(req.user.id, 'SIFRE_SIFIRLAMA', 'Kullanicilar', id, 'Admin tarafından şifre sıfırlandı');

        res.json({ success: true, message: 'Şifre sıfırlandı' });
    } catch (err) {
        console.error('Şifre sıfırlama hatası:', err);
        res.status(500).json({ error: err.message });
    }
};
