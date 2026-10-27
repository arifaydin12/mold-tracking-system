const { getPool, sql } = require('../config/db');

const logAktivite = async (kullaniciId, islem, tabloAdi, kayitId, aciklama) => {
    try {
        const pool = getPool();
        if (!pool) return;

        await pool.request()
            .input('kullaniciId', sql.Int, kullaniciId)
            .input('islem', sql.NVarChar, islem)
            .input('tabloAdi', sql.NVarChar, tabloAdi)
            .input('kayitId', sql.Int, kayitId)
            .input('aciklama', sql.NVarChar, aciklama)
            .query(`INSERT INTO AktiviteLoglari (kullaniciId, islem, tabloAdi, kayitId, aciklama) 
                    VALUES (@kullaniciId, @islem, @tabloAdi, @kayitId, @aciklama)`);
    } catch (err) {
        console.error('Log kaydetme hatası:', err);
    }
};

module.exports = { logAktivite };
