const { getPool, sql } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logAktivite } = require('../middleware/logger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

exports.login = async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        const pool = getPool();

        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        const result = await pool.request()
            .input('kullaniciAdi', sql.NVarChar, kullaniciAdi)
            .query('SELECT * FROM Kullanicilar WHERE kullaniciAdi = @kullaniciAdi AND aktif = 1');

        if (result.recordset.length === 0) {
            await pool.request()
                .input('kullaniciAdi', sql.NVarChar, kullaniciAdi)
                .input('basarili', sql.Bit, 0)
                .query('INSERT INTO GirisLoglari (kullaniciId, basarili) VALUES (NULL, @basarili)');

            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        const kullanici = result.recordset[0];
        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);

        if (!sifreDogruMu) {
            await pool.request()
                .input('kullaniciId', sql.Int, kullanici.id)
                .input('basarili', sql.Bit, 0)
                .query('INSERT INTO GirisLoglari (kullaniciId, basarili) VALUES (@kullaniciId, @basarili)');

            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        const token = jwt.sign(
            {
                id: kullanici.id,
                kullaniciAdi: kullanici.kullaniciAdi,
                rol: kullanici.rol,
                adSoyad: kullanici.adSoyad
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        await pool.request()
            .input('kullaniciId', sql.Int, kullanici.id)
            .input('basarili', sql.Bit, 1)
            .query('INSERT INTO GirisLoglari (kullaniciId, basarili) VALUES (@kullaniciId, @basarili)');

        await pool.request()
            .input('id', sql.Int, kullanici.id)
            .query('UPDATE Kullanicilar SET sonGirisTarihi = GETDATE() WHERE id = @id');

        res.json({
            success: true,
            token,
            kullanici: {
                id: kullanici.id,
                kullaniciAdi: kullanici.kullaniciAdi,
                adSoyad: kullanici.adSoyad,
                email: kullanici.email,
                rol: kullanici.rol,
                departman: kullanici.departman
            }
        });
    } catch (err) {
        console.error('Giriş hatası:', err);
        res.status(500).json({ error: 'Giriş işlemi başarısız' });
    }
};

exports.logout = async (req, res) => {
    try {
        await logAktivite(req.user.id, 'CIKIS', null, null, 'Kullanıcı çıkış yaptı');
        res.json({ success: true, message: 'Çıkış yapıldı' });
    } catch (err) {
        console.error('Çıkış hatası:', err);
        res.status(500).json({ error: 'Çıkış işlemi başarısız' });
    }
};

exports.verify = (req, res) => {
    res.json({
        success: true,
        kullanici: req.user
    });
};

exports.changePassword = async (req, res) => {
    try {
        const { eskiSifre, yeniSifre } = req.body;
        const pool = getPool();

        if (!eskiSifre || !yeniSifre) {
            return res.status(400).json({ error: 'Eski ve yeni şifre gerekli' });
        }

        if (yeniSifre.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
        }

        const kullanici = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query('SELECT sifre FROM Kullanicilar WHERE id = @id');

        const sifreDogruMu = await bcrypt.compare(eskiSifre, kullanici.recordset[0].sifre);

        if (!sifreDogruMu) {
            return res.status(401).json({ error: 'Mevcut şifre hatalı' });
        }

        const hashedPassword = await bcrypt.hash(yeniSifre, SALT_ROUNDS);

        await pool.request()
            .input('id', sql.Int, req.user.id)
            .input('sifre', sql.NVarChar, hashedPassword)
            .query('UPDATE Kullanicilar SET sifre = @sifre, sonGuncellemeTarihi = GETDATE() WHERE id = @id');

        await logAktivite(req.user.id, 'SIFRE_DEGISTIRME', 'Kullanicilar', req.user.id, 'Şifre değiştirildi');

        res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
    } catch (err) {
        console.error('Şifre değiştirme hatası:', err);
        res.status(500).json({ error: 'Şifre değiştirilemedi' });
    }
};
