const Sequelize = require("sequelize");
const async = require("async");
const moment = require("moment");
const nodemailer = require("nodemailer");

const mysql2 = require("mysql2");
const tedious = require("tedious");

const sequelize_UVT = new Sequelize("uretim", "root", "5421", {
  host: "10.45.1.67",
  dialect: "mysql",
  timezone: "+03:00",
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const sequelize_EES = new Sequelize("EES_CAL2023", "sa", "PLSkonigulsena206253", {
  host: "10.45.1.111",
  dialect: "mssql",
  timezone: "+03:00",
  logging: false,
  dialectOptions: {
    options: {
      "encrypt": false
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

async function OTO_M_BILGI_KONTROL() {
  let lastRecordsTotal = 0;
  let kayitSiniri = 200;

  let kontrol = async () => {
    console.log("OTO_M_BILGI_KONTROL START");
    let result = await sequelize_EES
      .query(
        "SELECT COUNT(*) AS total FROM OTO_M_BILGI WHERE ISL_KODU = 'UF' AND MIKTAR > 0",
        {
          type: sequelize_EES.QueryTypes.SELECT,
        }
      )
      .catch((error) => {
        console.error(error);
      });

    if (result) {
      const total = Number(result[0].total);

      if (
        lastRecordsTotal > 0 &&
        total >= kayitSiniri &&
        lastRecordsTotal < total
      ) {
        sendMail(
          "bilgiislem@a-plasltd.com.tr",
          `ACİL ! EES - OTO_M_BILGI tablosunda fazla kayıt birikmesi`,
          `*** EES_CAL *** OTO_M_BILGI tablosunda ${kayitSiniri} adetten fazla kayıt birikmesi meydana gelmiştir. Biriken toplam kayıt sayısı = ${result[0].total}. <br> <br>Not: Bu mail UVT servisinden otomatik olarak gönderilmektedir`
        );
      }

      lastRecordsTotal = total;
    }

    console.log("OTO_M_BILGI_KONTROL END");
  };

  kontrol();
  setInterval(kontrol, 15 * 60 * 1000);
}

async function URETIM_KAYITLARI_KONTOL() {
  let lastRecordsTotal = 0;

  let kontrol = async () => {
    console.log("URETIM_KAYITLARI_KONTOL START");
    let result = await sequelize_UVT
      .query(
        "SELECT COUNT(*) FROM uretim_kayitlari WHERE STATUS = 0 AND MIKTAR > 0 AND YEAR (NOW()) = YEAR (uretim_saat)",
        {
          type: sequelize_UVT.QueryTypes.SELECT,
        }
      )
      .catch((error) => {
        console.error(error);
      });

    if (result) {
      const total = Number(result[0].total);

      if (lastRecordsTotal > 0 && total >= 2000 && lastRecordsTotal < total) {
        sendMail(
          "bilgiislem@a-plasltd.com.tr",
          `ACİL ! uretim_kayitlari tablosunda fazla kayıt birikmesi`,
          `*** CAL *** uretim_kayitlari tablosunda 2000'den fazla kayıt birikmesi meydana gelmiştir. Biriken toplam kayıt sayısı = ${result[0].total}. <br> <br>Not: Bu mail UVT servisinden otomatik olarak gönderilmektedir`
        );
      }

      lastRecordsTotal = total;
    }

    console.log("URETIM_KAYITLARI_KONTOL END");
  };

  kontrol();
  setInterval(kontrol, 15 * 60 * 1000);
}

async function EES_UVT_ISEMRI_GUNCELLE_NEW() {
  try {
    console.log("İşlem başlatıldı.");

    console.log("isemri_ozet tablosundan veri alınıyor...");
    let uvtIsemirleri = await sequelize_UVT.query(
      "select IS_EMRI, ISEMRI_MIKTAR, STK_ADI, STK_KODU, RECETE_CEVIRIM, ISEMRI_DURUM, MAK_KOD, ISL_YERI, PLN_BAS_TAR, PLN_BIT_TAR from isemri_ozet where YIL = YEAR(NOW()) AND (STK_KODU IS NULL OR MAK_KOD IS NULL OR RECETE_CEVIRIM IS NULL OR STK_ADI IS NULL OR ISEMRI_MIKTAR IS NULL) ORDER BY id DESC",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );
    console.log(
      "isemri_ozet tablosundan veri alındı. Kayıt Sayısı:",
      uvtIsemirleri.length
    );

    console.log("EES'den iş emirleri alınıyor...");
    let eesIsemirleri = await sequelize_EES.query(
      "SELECT STK_MAS.STOKNO, STK_MAS.MLZ_ADI, ISE_OPER.ISEMRI_NO, FLOOR(ISE_OPER.TEZ_SURE * 60) AS TEZ_SURE, ISE_OPER.KAPA_KODU, ISE_OPER.ISE_MIKTAR, ISE_OPER.ISE_UREMIK, ISE_OPER.YENI_UREMIK, ISE_OPER.URE_BAS_TAR, ISE_OPER.URE_BITIS_TAR, TEZ_MAS.ADI, TEZ_MAS.SICIL AS MAK_KOD, ISE_OPER.ISL_YERI AS ISL_YERI FROM dbo.ISE_OPER INNER JOIN dbo.STK_MAS ON dbo.STK_MAS.KAYITNO = dbo.ISE_OPER.STK_MAS_KAY INNER JOIN dbo.TEZ_MAS ON dbo.TEZ_MAS.KAYITNO = dbo.ISE_OPER.TEZ_MAS_KAY",
      {
        type: sequelize_EES.QueryTypes.SELECT,
      }
    );
    console.log(
      "EES'den iş emirleri alındı. Kayıt Sayısı:",
      eesIsemirleri.length
    );

    await async.mapSeries(uvtIsemirleri, async function (uvtIsemri) {
      console.log("Karşılaştırma yapılıyor... IS_EMRI:", uvtIsemri.IS_EMRI);

      let data2 = eesIsemirleri.filter((x) => x.ISEMRI_NO == uvtIsemri.IS_EMRI);

      data2 = data2.filter(
        (x) =>
          !(
            (
              x.ISE_MIKTAR == uvtIsemri.ISEMRI_MIKTAR &&
              x.MLZ_ADI == uvtIsemri.STK_ADI &&
              x.STOKNO == uvtIsemri.STK_KODU &&
              x.TEZ_SURE == uvtIsemri.RECETE_CEVIRIM &&
              // && (x.KAPA_KODU == 'K' ? 1 : 0) == uvtIsemri.ISEMRI_DURUM
              x.MAK_KOD == uvtIsemri.MAK_KOD &&
              x.ISL_YERI == uvtIsemri.ISL_YERI
            )
            // && (x.URE_BAS_TAR || "").toString() == (uvtIsemri.PLN_BAS_TAR || "").toString()
            // && (x.URE_BITIS_TAR || "").toString() == (uvtIsemri.PLN_BIT_TAR || "").toString()
          )
      );

      data2 = data2[0];

      if (data2) {
        console.log(
          "isemri_ozet tablosu güncelleniyor... IS_EMRI:",
          data2.ISEMRI_NO
        );

        await sequelize_UVT.query(
          "UPDATE isemri_ozet SET MAK_KOD = :MAK_KOD, ISL_YERI = :ISL_YERI, ISEMRI_MIKTAR = :ISEMRI_MIKTAR, STK_KODU =:STK_KODU, STK_ADI =:STK_ADI, RECETE_CEVIRIM = :RECETE_CEVIRIM where IS_EMRI = :ISEMRI_NO AND YIL = YEAR(NOW())",
          {
            type: sequelize_UVT.QueryTypes.UPDATE,
            replacements: {
              ISEMRI_NO: data2.ISEMRI_NO,
              MAK_KOD: data2.MAK_KOD,
              ISL_YERI: data2.ISL_YERI,
              ISEMRI_MIKTAR: data2.ISE_MIKTAR,
              STK_KODU: data2.STOKNO,
              STK_ADI: data2.MLZ_ADI,
              RECETE_CEVIRIM: data2.TEZ_SURE,
            },
          }
        );

        console.log(
          "isemri_ozet tablosu güncellendi. IS_EMRI:",
          data2.ISEMRI_NO
        );
      }
    });
  } catch (err) {
    console.error(err);
  } finally {
    console.log("İşlem tamamlandı.");
  }
}

async function EES_UVT_ISEMRI_GUNCELLE() {
  console.log("EES_UVT_ISEMRI_GUNCELLE START");

  let datatemp = await sequelize_UVT
    .query(
      "select * from isemri_ozet where (ISEMRI_MIKTAR = 0 OR ISEMRI_DURUM = 0) AND YEAR(NOW())= YEAR(ISEMRI_BASLANGIC);",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    )
    .catch((error) => {
      console.error(error);
    });

  await async.mapSeries(
    datatemp,
    async (row) => {
      let data = await sequelize_EES.query(
        "SELECT STK_MAS.STOKNO, STK_MAS.MLZ_ADI, ISE_OPER.ISEMRI_NO, ISE_OPER.CARPAN, FLOOR(ISE_OPER.TEZ_SURE * 60) AS TEZ_SURE, ISE_OPER.KAPA_KODU, ISE_OPER.ISE_MIKTAR, ISE_OPER.ISE_UREMIK, ISE_OPER.YENI_UREMIK, ISE_OPER.URE_BAS_TAR, ISE_OPER.URE_BITIS_TAR, TEZ_MAS.ADI, TEZ_MAS.SICIL AS MAK_KOD, ISE_OPER.ISL_YERI AS ISL_YERI FROM dbo.ISE_OPER INNER JOIN dbo.STK_MAS ON dbo.STK_MAS.KAYITNO = dbo.ISE_OPER.STK_MAS_KAY INNER JOIN dbo.TEZ_MAS ON dbo.TEZ_MAS.KAYITNO = dbo.ISE_OPER.TEZ_MAS_KAY WHERE ISE_OPER.ISEMRI_NO = :ISEMRI_NO",
        {
          replacements: {
            ISEMRI_NO: row.IS_EMRI,
          },
          type: sequelize_EES.QueryTypes.SELECT,
        }
      );

      if (data.length > 0) {
        await sequelize_UVT.query(
          "UPDATE isemri_ozet SET MAK_KOD = :MAK_KOD,CARPAN = :CARPAN ,ISL_YERI = :ISL_YERI ,PLN_BAS_TAR = :PLN_BAS_TAR,PLN_BIT_TAR = :PLN_BIT_TAR,ISEMRI_MIKTAR = :ISEMRI_MIKTAR,STK_ADI =:STK_ADI,ISEMRI_DURUM =:ISEMRI_DURUM , RECETE_CEVIRIM = :TEZ_SURE where id = :id",
          {
            type: sequelize_UVT.QueryTypes.UPDATE,
            replacements: {
              id: row.id,
              ISEMRI_MIKTAR: data[0].ISE_MIKTAR,
              STK_ADI: data[0].MLZ_ADI,
              TEZ_SURE: data[0].TEZ_SURE,
              ISEMRI_DURUM: data[0].KAPA_KODU == "K" ? 1 : 0,
              MAK_KOD: data[0].MAK_KOD,
              ISL_YERI: data[0].ISL_YERI,
              PLN_BAS_TAR: data[0].URE_BAS_TAR,
              PLN_BIT_TAR: data[0].URE_BITIS_TAR,
              CARPAN: data[0].CARPAN,
            },
          }
        );
      }
    },
    (err) => {
      if (err) {
        console.error(err);
      }

      console.log("EES_UVT_ISEMRI_GUNCELLE END");
    }
  );
}

async function EES_OTOMASYON_URETIM() {
  console.log("EES_OTOMASYON_URETIM START");

  try {
    let ees_sicilleri = await sequelize_EES.query(
      "SELECT SICIL FROM ISCI_TAN",
      {
        type: sequelize_EES.QueryTypes.SELECT,
      }
    );

    let ees_isemirleri = await sequelize_EES.query(
      "SELECT y.SICIL, x.ISEMRI_NO, x.OPER_SIRA, x.OPER_KODU FROM ISE_OPER as x LEFT JOIN TEZ_MAS as y on y.KAYITNO = x.TEZ_MAS_KAY",
      {
        type: sequelize_EES.QueryTypes.SELECT,
      }
    );

    await sequelize_UVT.query("SET SESSION group_concat_max_len = 1000000");

    let datatemp = await sequelize_UVT.query(
      "SELECT GROUP_CONCAT(id) as ids, VARDIYA,DATE_FORMAT(MIN(DATE_ADD(uretim_saat, INTERVAL 3 HOUR)),'%Y-%m-%d') AS URE_TAR, DATE_FORMAT(MIN(DATE_ADD(uretim_saat, INTERVAL 3 HOUR)),'%Y-%m-%d %H:%i'  ) AS TARIH_BASLANGIC,DATE_FORMAT(MAX(DATE_ADD(uretim_saat, INTERVAL 3 HOUR)),       '%Y-%m-%d  %H:%i'     ) AS TARIH_BITIS,   DATE_FORMAT(MIN(DATE_ADD(uretim_saat, INTERVAL 3 HOUR)), '%H:%i') AS BASLANGIC,   DATE_FORMAT(MAX(DATE_ADD(uretim_saat, INTERVAL 3 HOUR)), '%H:%i') AS BITIS,SUM(MIKTAR) AS URETIM_MIKTAR,TEZGAH,ISEMRI_NO,SICIL FROM   uretim_kayitlari WHERE   STATUS = 0 AND TEZGAH != 'undefined' AND MIKTAR > 0 AND YEAR(NOW())= YEAR(uretim_saat) GROUP BY  VARDIYA,TEZGAH,ISEMRI_NO,SICIL,DATE_FORMAT(DATE_ADD(uretim_saat, INTERVAL 3 HOUR), '%Y%m%d');",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    await async.mapSeries(
      datatemp,
      async function (row) {
        let ISEMRI = ees_isemirleri.filter(
          (x) => x.ISEMRI_NO == row.ISEMRI_NO && x.SICIL == row.TEZGAH
        )[0];

        if (!ISEMRI) {
          await sequelize_UVT.query(
            "UPDATE uretim_kayitlari SET status = 2, statusAciklama = 'EES de işemri bulunamadı' where id in (:id)",
            {
              type: sequelize_UVT.QueryTypes.UPDATE,
              replacements: {
                id: row.ids.split(","),
              },
            }
          );
        } else {
          let sicil = ees_sicilleri.filter((x) => x.SICIL == row.SICIL);

          await sequelize_EES.query(
            "INSERT INTO OTO_M_BILGI (KAY_KODU,STOKNO,ISL_KODU,URE_TAR,ISC_SICIL,VAR_KODU,ISEMRI_NO,BAS_SAAT,BIT_SAAT,MIKTAR,TEZGAH,ISC_SAYISI,BAS_SAAT_TAR,BIT_SAAT_TAR,OPER_SIRA,OPER_KODU) VALUES (:KAY_KODU, ISNULL((select STOKNO from STK_MAS where KAYITNO=(select TOP 1 STK_MAS_KAY from ISE_OPER where ISEMRI_NO =:ISEMRI_NO)), ''), 'UF', :URE_TAR, :SICIL, :VAR_KODU, :ISEMRI_NO, :BASLANGIC, :BITIS, :URE_MIK, :TEZGAH, 1, :TAR_BAS, :TAR_BIT, :OPER_SIRA, :OPER_KODU);",
            {
              replacements: {
                KAY_KODU: "",
                URE_TAR: row.URE_TAR,
                ISEMRI_NO: row.ISEMRI_NO,
                SICIL: sicil.length > 0 ? row.SICIL : "BOS",
                BASLANGIC: row.BASLANGIC,
                BITIS: row.BITIS,
                URE_MIK: row.URETIM_MIKTAR,
                TEZGAH: row.TEZGAH,
                TAR_BIT: row.TARIH_BITIS,
                TAR_BAS: row.TARIH_BASLANGIC,
                VAR_KODU: row.VAR_KODU || vardiyaBul(row.TARIH_BASLANGIC),
                OPER_SIRA: ISEMRI.OPER_SIRA,
                OPER_KODU: ISEMRI.OPER_KODU,
              },
              type: sequelize_EES.QueryTypes.INSERT,
            }
          );

          await sequelize_UVT.query(
            "UPDATE uretim_kayitlari SET status = 1 where id in (:id)",
            {
              type: sequelize_UVT.QueryTypes.UPDATE,
              replacements: {
                id: row.ids.split(","),
              },
            }
          );
        }
      },
      (err) => {
        if (err) {
          console.error(err);
        }
      }
    );
  } catch (error) {
    console.error(error);
  }

  console.log("EES_OTOMASYON_URETIM END");
}

async function EES_OTOMASYON_ISKARTA() {
  console.log("EES_OTOMASYON_ISKARTA START");

  let ees_sicilleri = await sequelize_EES.query("SELECT SICIL FROM ISCI_TAN", {
    type: sequelize_EES.QueryTypes.SELECT,
  });

  let ees_isemirleri = await sequelize_EES.query(
    "SELECT y.SICIL, x.ISEMRI_NO, x.OPER_SIRA, x.OPER_KODU FROM ISE_OPER as x LEFT JOIN TEZ_MAS as y on y.KAYITNO = x.TEZ_MAS_KAY",
    {
      type: sequelize_EES.QueryTypes.SELECT,
    }
  );

  let datatemp = await sequelize_UVT
    .query(
      "SELECT   *, DATE_FORMAT(DATE_ADD(TARIH, INTERVAL 3 HOUR),'%Y-%m-%d') AS URE_TAR,DATE_FORMAT(DATE_ADD(TARIH, INTERVAL 3 HOUR),'%H:%i') AS BASLANGIC,DATE_FORMAT(DATE_ADD(TARIH, INTERVAL 3 HOUR), '%H:%i'   ) AS BITIS, DATE_FORMAT((DATE_ADD(TARIH, INTERVAL 3 HOUR)),'%Y-%m-%d %H:%i') AS TARIH_BASLANGIC, DATE_FORMAT((DATE_ADD(TARIH, INTERVAL 3 HOUR)),'%Y-%m-%d %H:%i') AS TARIH_BITIS FROM iskarta WHERE st = 0 AND YEAR(NOW())= YEAR(TARIH)",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    )
    .catch(function (error) {
      console.error(error);
    });

  await async.mapSeries(
    datatemp,
    async (row) => {
      let ISEMRI = ees_isemirleri.filter(
        (x) => x.ISEMRI_NO == row.ISEMRI_NO && x.SICIL == row.MAK_KOD
      )[0];

      if (!ISEMRI) {
        await sequelize_UVT.query("UPDATE iskarta SET ST = 2 where id = :id", {
          type: sequelize_UVT.QueryTypes.UPDATE,
          replacements: {
            id: row.id,
          },
        });
      } else {
        await sequelize_EES.query(
          "INSERT INTO OTO_M_BILGI (KAY_KODU,STOKNO,ISL_KODU,URE_TAR,ISC_SICIL,VAR_KODU,ISEMRI_NO,BAS_SAAT,BIT_SAAT,MIKTAR,TEZGAH,ISC_SAYISI,BAS_SAAT_TAR,BIT_SAAT_TAR,X_ACIKLAMA,OPER_SIRA,OPER_KODU) VALUES (:KAY_KODU, ISNULL((select STOKNO from stk_mas where KAYITNO = (select TOP 1 STK_MAS_KAY from ISE_OPER where ISEMRI_NO =:ISEMRI_NO)), ''),'IF',:URE_TAR,:SICIL,(select VAR_KODU from ISCI_TAN where SICIL =:SICIL),:ISEMRI_NO,:BASLANGIC,:BITIS,1,:TEZGAH,1,:TAR_BAS,:TAR_BIT,:ACIKLAMA,:OPER_SIRA,:OPER_KODU)",
          {
            replacements: {
              KAY_KODU: row.SEBEP_KODU || "",
              URE_TAR: row.URE_TAR,
              ISEMRI_NO: row.ISEMRI_NO,
              SICIL: row.SICIL,
              BASLANGIC: row.BASLANGIC,
              BITIS: row.BITIS,
              URE_MIK: row.URETIM_MIKTAR,
              TEZGAH: row.MAK_KOD,
              TAR_BIT: row.TARIH_BITIS,
              TAR_BAS: row.TARIH_BASLANGIC,
              ACIKLAMA: row.ACIKLAMA || "",
              OPER_SIRA: ISEMRI.OPER_SIRA,
              OPER_KODU: ISEMRI.OPER_KODU,
            },
            type: sequelize_EES.QueryTypes.INSERT,
          }
        );

        await sequelize_UVT.query("UPDATE iskarta SET ST = 1 where id = :id", {
          type: sequelize_UVT.QueryTypes.UPDATE,
          replacements: {
            id: row.id,
          },
        });
      }
    },
    (err) => {
      if (err) {
        console.error(err);
      }

      console.log("EES_OTOMASYON_ISKARTA END");
    }
  );
}

const sendMail = async (adress, subject, message) => {
  let transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: {
      user: "ees.dosab@a-plasltd.com.tr",
      pass: "Zoto9103",
    },
  });

  let mailOptions = {
    from: "ees.dosab@a-plasltd.com.tr",
    to: adress,
    subject: subject,
    html: message,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.error(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

const vardiyaBul = (tarih) => {
  let currentTime = moment();

  if (tarih) {
    currentTime = moment(tarih);
  }

  var extra = currentTime.format("YYYY-MM-DD") + " ";

  if (
    moment(currentTime).isBetween(
      moment(extra + "00:00"),
      moment(extra + "08:00"),
      undefined,
      "[)"
    )
  ) {
    return "V1";
  } else if (
    moment(currentTime).isBetween(
      moment(extra + "08:00"),
      moment(extra + "16:00"),
      undefined,
      "[)"
    )
  ) {
    return "V2";
  } else if (
    moment(currentTime).isBetween(
      moment(extra + "16:00"),
      moment(extra + "24:00"),
      undefined,
      "[)"
    )
  ) {
    return "V3";
  } else {
    return "V3";
  }
};

setInterval(EES_OTOMASYON_URETIM, 10 * 60 * 1000);
setInterval(EES_OTOMASYON_ISKARTA, 10 * 60 * 1000);
setInterval(EES_UVT_ISEMRI_GUNCELLE, 20 * 60 * 1000);
setInterval(EES_UVT_ISEMRI_GUNCELLE_NEW, 20 * 60 * 1000);

EES_OTOMASYON_URETIM();
EES_OTOMASYON_ISKARTA();
EES_UVT_ISEMRI_GUNCELLE();
OTO_M_BILGI_KONTROL();
URETIM_KAYITLARI_KONTOL();
EES_UVT_ISEMRI_GUNCELLE_NEW();
