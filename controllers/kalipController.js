const { getPool, sql } = require('../config/db');
const { logAktivite } = require('../middleware/logger');

exports.getKaliplar = async (req, res) => {
    try {
        const pool = getPool();
        const kalipResult = await pool.request().query(`
            SELECT k.*, 
                   u1.adSoyad as olusturanKullanici,
                   u2.adSoyad as guncelleyenKullanici
            FROM Kaliplar k
            LEFT JOIN Kullanicilar u1 ON k.olusturanKullaniciId = u1.id
            LEFT JOIN Kullanicilar u2 ON k.guncelleyenKullaniciId = u2.id
            ORDER BY k.olusturmaTarihi DESC
        `);

        const kaliplar = await Promise.all(kalipResult.recordset.map(async (kalip) => {
            const denemeResult = await pool.request()
                .input('kalipId', sql.Int, kalip.id)
                .query('SELECT * FROM Deneme WHERE kalipId = @kalipId ORDER BY tarih DESC');

            const revizyonResult = await pool.request()
                .input('kalipId', sql.Int, kalip.id)
                .query('SELECT * FROM Revizyon WHERE kalipId = @kalipId ORDER BY tarih DESC');

            const bakimResult = await pool.request()
                .input('kalipId', sql.Int, kalip.id)
                .query('SELECT * FROM Bakim WHERE kalipId = @kalipId ORDER BY tarih DESC');

            return {
                ...kalip,
                denemeler: denemeResult.recordset,
                revizyonlar: revizyonResult.recordset,
                bakimlar: bakimResult.recordset
            };
        }));

        res.json(kaliplar);
    } catch (err) {
        console.error('Kalıpları getirme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createKalip = async (req, res) => {
    try {
        const { kod, ad, proje, durum, tedarikci, gozSayisi, malzeme, olusturmaTarihi, termin, maliyet, odemeDurumu, notlar } = req.body;
        const pool = getPool();

        const result = await pool.request()
            .input('kod', sql.NVarChar, kod)
            .input('ad', sql.NVarChar, ad)
            .input('proje', sql.NVarChar, proje)
            .input('durum', sql.NVarChar, durum || 'deneme')
            .input('tedarikci', sql.NVarChar, tedarikci)
            .input('gozSayisi', sql.Int, gozSayisi || 1)
            .input('malzeme', sql.NVarChar, malzeme)
            .input('olusturmaTarihi', sql.Date, olusturmaTarihi)
            .input('termin', sql.Date, termin)
            .input('maliyet', sql.Decimal(10, 2), maliyet || 0)
            .input('odemeDurumu', sql.NVarChar, odemeDurumu || 'Ödenmedi')
            .input('notlar', sql.NVarChar, notlar)
            .input('olusturanKullaniciId', sql.Int, req.user.id)
            .query(`INSERT INTO Kaliplar (kod, ad, proje, durum, tedarikci, gozSayisi, malzeme, olusturmaTarihi, termin, maliyet, odemeDurumu, notlar, olusturanKullaniciId) 
                    OUTPUT INSERTED.id
                    VALUES (@kod, @ad, @proje, @durum, @tedarikci, @gozSayisi, @malzeme, @olusturmaTarihi, @termin, @maliyet, @odemeDurumu, @notlar, @olusturanKullaniciId)`);

        const newId = result.recordset[0].id;

        await logAktivite(req.user.id, 'KALIP_EKLEME', 'Kaliplar', newId, `Yeni kalıp: ${ad}`);

        res.json({ success: true, message: 'Kalıp başarıyla eklendi', id: newId });
    } catch (err) {
        console.error('Kalıp ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateKalip = async (req, res) => {
    try {
        const { id } = req.params;
        const { kod, ad, proje, durum, tedarikci, gozSayisi, malzeme, termin, maliyet, odemeDurumu, notlar } = req.body;
        const pool = getPool();

        await pool.request()
            .input('id', sql.Int, id)
            .input('kod', sql.NVarChar, kod)
            .input('ad', sql.NVarChar, ad)
            .input('proje', sql.NVarChar, proje)
            .input('durum', sql.NVarChar, durum)
            .input('tedarikci', sql.NVarChar, tedarikci)
            .input('gozSayisi', sql.Int, gozSayisi)
            .input('malzeme', sql.NVarChar, malzeme)
            .input('termin', sql.Date, termin)
            .input('maliyet', sql.Decimal(10, 2), maliyet)
            .input('odemeDurumu', sql.NVarChar, odemeDurumu)
            .input('notlar', sql.NVarChar, notlar)
            .input('guncelleyenKullaniciId', sql.Int, req.user.id)
            .query(`UPDATE Kaliplar SET 
                    kod=@kod, ad=@ad, proje=@proje, durum=@durum, tedarikci=@tedarikci, 
                    gozSayisi=@gozSayisi, malzeme=@malzeme, termin=@termin, 
                    maliyet=@maliyet, odemeDurumu=@odemeDurumu, notlar=@notlar,
                    guncelleyenKullaniciId=@guncelleyenKullaniciId
                    WHERE id=@id`);

        await logAktivite(req.user.id, 'KALIP_GUNCELLEME', 'Kaliplar', id, `Kalıp güncellendi: ${ad}`);

        res.json({ success: true, message: 'Kalıp güncellendi' });
    } catch (err) {
        console.error('Kalıp güncelleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.deleteKalip = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        // Sadece admin silebilir
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
        }

        const kalip = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT ad FROM Kaliplar WHERE id = @id');

        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Kaliplar WHERE id=@id');

        await logAktivite(req.user.id, 'KALIP_SILME', 'Kaliplar', id, `Kalıp silindi: ${kalip.recordset[0]?.ad}`);

        res.json({ success: true, message: 'Kalıp silindi' });
    } catch (err) {
        console.error('Kalıp silme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

// --- Process Handlers ---

exports.createDeneme = async (req, res) => {
    try {
        const { kalipId, tarih, hammadde, renk, adet, sonuc, operator } = req.body;
        const pool = getPool();

        const result = await pool.request()
            .input('kalipId', sql.Int, kalipId)
            .input('tarih', sql.Date, tarih)
            .input('hammadde', sql.NVarChar, hammadde)
            .input('renk', sql.NVarChar, renk)
            .input('adet', sql.Int, adet || 0)
            .input('sonuc', sql.NVarChar, sonuc)
            .input('operator', sql.NVarChar, operator)
            .query(`INSERT INTO Deneme (kalipId, tarih, hammadde, renk, adet, sonuc, operator) 
                    OUTPUT INSERTED.id
                    VALUES (@kalipId, @tarih, @hammadde, @renk, @adet, @sonuc, @operator)`);

        await logAktivite(req.user.id, 'DENEME_EKLEME', 'Deneme', result.recordset[0].id, `Deneme eklendi: Kalıp ID ${kalipId}`);

        res.json({ success: true, message: 'Deneme kaydı eklendi', id: result.recordset[0].id });
    } catch (err) {
        console.error('Deneme ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createRevizyon = async (req, res) => {
    try {
        const { kalipId, tarih, firma, islem, fiyat, odemeDurumu, aciklama } = req.body;
        const pool = getPool();

        const result = await pool.request()
            .input('kalipId', sql.Int, kalipId)
            .input('tarih', sql.Date, tarih)
            .input('firma', sql.NVarChar, firma)
            .input('islem', sql.NVarChar, islem)
            .input('fiyat', sql.Decimal(10, 2), fiyat || 0)
            .input('odemeDurumu', sql.NVarChar, odemeDurumu)
            .input('aciklama', sql.NVarChar, aciklama)
            .query(`INSERT INTO Revizyon (kalipId, tarih, firma, islem, fiyat, odemeDurumu, aciklama) 
                    OUTPUT INSERTED.id
                    VALUES (@kalipId, @tarih, @firma, @islem, @fiyat, @odemeDurumu, @aciklama)`);

        await logAktivite(req.user.id, 'REVIZYON_EKLEME', 'Revizyon', result.recordset[0].id, `Revizyon eklendi: Kalıp ID ${kalipId}`);

        res.json({ success: true, message: 'Revizyon kaydı eklendi', id: result.recordset[0].id });
    } catch (err) {
        console.error('Revizyon ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createBakim = async (req, res) => {
    try {
        const { kalipId, tarih, islem, sorumlu, durum } = req.body;
        const pool = getPool();

        const result = await pool.request()
            .input('kalipId', sql.Int, kalipId)
            .input('tarih', sql.Date, tarih)
            .input('islem', sql.NVarChar, islem)
            .input('sorumlu', sql.NVarChar, sorumlu)
            .input('durum', sql.NVarChar, durum || 'Tamamlandı')
            .query(`INSERT INTO Bakim (kalipId, tarih, islem, sorumlu, durum) 
                    OUTPUT INSERTED.id
                    VALUES (@kalipId, @tarih, @islem, @sorumlu, @durum)`);

        await logAktivite(req.user.id, 'BAKIM_EKLEME', 'Bakim', result.recordset[0].id, `Bakım eklendi: Kalıp ID ${kalipId}`);

        res.json({ success: true, message: 'Bakım kaydı eklendi', id: result.recordset[0].id });
    } catch (err) {
        console.error('Bakım ekleme hatası:', err);
        res.status(500).json({ error: err.message });
    }
};
