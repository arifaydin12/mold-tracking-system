const { getPool, sql } = require('../config/db');

exports.getAktiviteLogs = async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
            SELECT a.*, k.adSoyad as kullaniciAdi
            FROM AktiviteLoglari a
            LEFT JOIN Kullanicilar k ON a.kullaniciId = k.id
            ORDER BY a.islemTarihi DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Log getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getGirisLogs = async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.request().query(`
            SELECT g.*, k.adSoyad, k.kullaniciAdi
            FROM GirisLoglari g
            LEFT JOIN Kullanicilar k ON g.kullaniciId = k.id
            ORDER BY g.girisTarihi DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Giriş log hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.getSystemStats = async (req, res) => {
    try {
        const pool = getPool();
        const stats = {
            toplamKalip: 0,
            aktifKullanici: 0,
            bugunGiris: 0,
            toplamAktivite: 0
        };

        const kalipCount = await pool.request().query('SELECT COUNT(*) as sayi FROM Kaliplar');
        stats.toplamKalip = kalipCount.recordset[0].sayi;

        const kullaniciCount = await pool.request().query('SELECT COUNT(*) as sayi FROM Kullanicilar WHERE aktif = 1');
        stats.aktifKullanici = kullaniciCount.recordset[0].sayi;

        const bugunGiris = await pool.request().query('SELECT COUNT(*) as sayi FROM GirisLoglari WHERE CAST(girisTarihi AS DATE) = CAST(GETDATE() AS DATE) AND basarili = 1');
        stats.bugunGiris = bugunGiris.recordset[0].sayi;

        const aktiviteCount = await pool.request().query('SELECT COUNT(*) as sayi FROM AktiviteLoglari');
        stats.toplamAktivite = aktiviteCount.recordset[0].sayi;

        res.json(stats);
    } catch (err) {
        console.error('İstatistik hatası:', err);
        res.status(500).json({ error: err.message });
    }
};
