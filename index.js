/***********************************************************/
// REQUIREMENTS
/***********************************************************/
const express = require("express");
const db = require("./db");
const bodyParser = require("body-parser");
const async = require("async");
const cors = require("cors");
const nodemailer = require("nodemailer");
const axios = require("axios");
const Sequelize = require("sequelize");
const tedious = require("tedious");

/***********************************************************/
// VARIABLES
/***********************************************************/
const PORT = 3001;
const app = express();

/***********************************************************/
// DB CONNECTIONS
/***********************************************************/
const sequelize_UVT = new Sequelize("uretim", "root", "5421", {
  host: "10.45.1.67",
  dialect: "mysql",
  timezone: "+03:00",
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
  dialectOptions: {
    options: {
      "encrypt": false
    }
  },
  timezone: "+03:00",
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const sequelize_portal = new Sequelize("bimportaldb", "root", "5421", {
  host: "10.45.1.111",
  dialect: "mysql",
  timezone: "+03:00",
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

/***********************************************************/
// APP CONFIGS
/***********************************************************/
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(
  cors({
    origin: "*",
  })
);
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});

/***********************************************************/
// UVT
/***********************************************************/
app.post("/updateTerminalList", async (req, res) => {
  try {
    let data = await sequelize_UVT.query(
      "UPDATE terminal_list SET IP = :IP, MAC = :MAC WHERE TERMINAL_KODU = :TERMINAL_KODU",
      {
        type: sequelize_UVT.QueryTypes.UPDATE,
        replacements: {
          TERMINAL_KODU: req.body.TERMINAL_KODU,
          IP: req.body.IP || null,
          MAC: req.body.MAC || null,
        },
      }
    );

    res.send(data);
  } catch (error) {
    res.status(400).send(error.message || error);
    console.error(error);
  }
});

app.post("/GetWorkInfo", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT ISE_OPER.ISE_UREMIK, ISE_OPER.ISE_BAKIYE,KAPA_KODU,ISEMRI_NO AS RECEIPTNO, CASE WHEN KAPA_KODU = '' AND ISE_BAKIYE > 0 THEN 2 ELSE 3 END STATUS, ISE_TARIH AS TRANSDATE, STK_MAS.STOKNO AS STOCKNO, OPER_KODU ASPPROCESSNO, STK_MAS.TEK_RESNO, OPER_SIRA AS PPROCESSORDERNO, ( SELECT SICIL FROM TEZ_MAS WHERE KAYITNO = TEZ_MAS_KAY ) AS PWORKSTATIONNO, ISE_MIKTAR AS QUANTITY, STK_MAS.DEPO AS DEPOTNO, FLOOR(dbo.ISE_OPER.TEZ_SURE*60) AS DURATION,STK_MAS.DOSYA_YERI, URE_BAS_TAR AS STARTDATE, URE_BITIS_TAR AS ENDDATE, GIDECEK_YERI = ( SELECT ACIKLAMA FROM TANI_DET WITH (NOLOCK) WHERE (TAN_SIRANO = '010') AND TAN_KODU IN ( ISNULL( ( SELECT TOP 1 ISL_YERI FROM ISE_DETAY AS I WITH (NOLOCK) WHERE (I.KUL_STKNO = STK_MAS.STOKNO) AND ( SUBSTRING (I.ISEMRI_NO, 1, 5) = SUBSTRING (ISE_OPER.ISEMRI_NO, 1, 5) ) ), STK_MAS.DEPO ) ) ), ISNULL( ( SELECT MLZ_ADI FROM STK_MAS AS SM WITH (NOLOCK) WHERE SM.STOKNO = STK_MAS.MTA_STKNO ), '' ) MTA_ADI, MTA_MIKTAR, CASE WHEN ( SELECT COUNT (MAM_STKNO) FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( SELECT STOKNO FROM STK_MAS WITH (NOLOCK) WHERE TURU IN ('M', 'F') ) ) > 1 THEN ISNULL( ( SELECT TOP 1 MAM_STKNO FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( ( SELECT STOKNO FROM STK_MAS WITH (NOLOCK) WHERE TURU IN ('M', 'F') ) ) ), '' ) ELSE ISNULL( ( SELECT MAM_STKNO FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( ( SELECT STOKNO FROM STK_MAS AS S WITH (NOLOCK) WHERE S.TURU IN ('M', 'F') ) ) ), '' ) END AS ANA_MAMUL_NO, CASE WHEN ( SELECT COUNT (MAM_STKNO) FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( SELECT STOKNO FROM STK_MAS WITH (NOLOCK) WHERE TURU IN ('M', 'F') ) ) > 1 THEN ISNULL( ( SELECT MLZ_ADI FROM STK_MAS AS SM WITH (NOLOCK) WHERE STOKNO IN ( ISNULL( ( SELECT TOP 1 MAM_STKNO FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( ( SELECT STOKNO FROM STK_MAS WITH (NOLOCK) WHERE TURU IN ('M', 'F') ) ) ), '' ) ) ), '' ) ELSE ISNULL( ( SELECT MLZ_ADI FROM STK_MAS AS SM WITH (NOLOCK) WHERE STOKNO IN ( ISNULL( ( SELECT MAM_STKNO FROM URUN_AGACI WHERE ARA_STKNO = STK_MAS.STOKNO AND MAM_STKNO IN ( ( SELECT STOKNO FROM STK_MAS WITH (NOLOCK) WHERE TURU IN ('M', 'F') ) ) ), '' ) ) ), '' ) END AS ANA_MAMUL_ADI, CARPAN, BOLEN FROM ISE_OPER WITH (NOLOCK), STK_MAS WITH (NOLOCK) WHERE STK_MAS_KAY = STK_MAS.KAYITNO AND ISEMRI_NO = :ISEMRI_NO ORDER BY ISE_OPER.KAYITNO DESC",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {
          ISEMRI_NO: req.body.ISEMRI_NO,
        },
      }
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.get("/GetDurusInfo", async (req, res) => {
  try {
    let DurusOnay = await sequelize_UVT.query("SELECT * FROM ONAY_DURUS", {
      type: sequelize_UVT.QueryTypes.SELECT,
    });

    let DurusOnaySicil = await sequelize_UVT.query(
      "SELECT * FROM DURUS_ONAY_SICIL",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    res.json({
      DurusOnay: DurusOnay,
      DurusOnaySicil: DurusOnaySicil,
    });
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.post("/DownTimeReasons", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT TAN_KODU AS DURUS_KODU,ACIKLAMA FROM TANI_DET WITH(NOLOCK) WHERE TAN_SIRANO='030' AND TAN_KODU like 'ED%' ORDER BY TAN_KODU",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.post("/GetWorkers", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT SICIL, ADI_SOYADI, VAR_KODU, DIR_END,MMRK,BARKOD_NO FROM ISCI_TAN WHERE CIKIS_TAR IS NULL ORDER BY SICIL",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.post("/GetWorker", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT SICIL,ADI_SOYADI,VAR_KODU,DIR_END,BARKOD_NO, BTY_ISCI,MMRK FROM ISCI_TAN WHERE REPLACE( LTRIM(REPLACE(SICIL, '0', ' ')), ' ', '0' ) = REPLACE( LTRIM(REPLACE(:barkod, '0', ' ')), ' ', '0' ) OR REPLACE( LTRIM(REPLACE(BARKOD_NO, '0', ' ')), ' ', '0' ) = REPLACE( LTRIM(REPLACE(:barkod, '0', ' ')), ' ', '0' )",
      {
        replacements: {
          barkod: req.body.TEXT.toString(),
        },
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.post("/GetKasaEtiketleri", async (req, res) => {
  try {
    let data = await sequelize_UVT.query(
      "SELECT * FROM kasa_etiketleri WHERE CONVERT(ISCI_SICIL,UNSIGNED) = CONVERT(:sicilNo,UNSIGNED) AND printTime IS NULL AND createdAt > DATE_SUB(NOW(),INTERVAL 1 HOUR)",
      {
        replacements: {
          sicilNo: req.body.sicilNo,
        },
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message || error);
  }
});

app.post("/InsertPROD", async (req, res) => {
  try {
    let obj = req.body.prod;

    await async.mapSeries(obj, async function (row) {
      
      let isemri = await isemriBul(row.ISEMRI_NO,row.TEZGAH);

      await sequelize_UVT.query(
        "INSERT INTO uretim_kayitlari (SICIL,MIKTAR,TEZGAH,CEVRIM_SURESI,ISEMRI_NO,uretim_saat,STOKNO,VARDIYA) VALUES (:SICIL,:MIKTAR,:TEZGAH,:CEVIRIM_SURESI,:ISEMRI_NO,:uretim_saat,:STOKNO,:VARDIYA)",
        {
          replacements: {
            SICIL: row.SICIL,
            MIKTAR: row.MIKTAR,
            TEZGAH: row.TEZGAH,
            CEVIRIM_SURESI: row.CEVRIM_SURESI,
            ISEMRI_NO: row.ISEMRI_NO,
            uretim_saat: row.TARIH_SAAT,
            STOKNO: row.STOKNO || isemri.STOKNO || "0",
            VARDIYA: row.VARDIYA || "",
          },
          type: sequelize_UVT.QueryTypes.INSERT,
        }
      );
    });

    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(404).send("NOK");
  }
});

app.post("/InsertSCRAP", async (req, res) => {
  try {
    let obj = req.body.SCRAPS;

    await async.mapSeries(obj, async function (row) {
      await sequelize_UVT.query(
        "INSERT INTO ISKARTA (ISEMRI_NO,SICIL,TARIH,MAK_KOD,SEBEP_KODU) VALUES (:ISEMRI_NO,:SICIL,:TARIH,:MAK_KOD,:SEBEP_KODU)",
        {
          replacements: {
            ISEMRI_NO: row.ISEMRI_NO,
            SICIL: row.SICIL,
            TARIH: row.TARIH_SAAT,
            MAK_KOD: row.TEZGAH,
            SEBEP_KODU: row.SEBEP_KODU,
          },
          type: sequelize_UVT.QueryTypes.INSERT,
        }
      );
    });

    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(404).send("NOK");
  }
});

app.post("/ScrapReasons", async (req, res) => {
  try {
    let kodPrefix = "";

    let tezMas = await sequelize_EES.query(
      "SELECT * FROM TEZ_MAS WHERE SICIL = :SICIL",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {
          SICIL: req.body.TEZGAH || ""
        },
      }
    );

    tezMas = tezMas[0] || {};

    if(tezMas.GRUP == "MON"){
      kodPrefix = "M%";
    } else if (tezMas.GRUP == "BOY"){
      kodPrefix = "B%";
    } else if (tezMas.GRUP == "EJP" || tezMas.GRUP == "SMK"){
      kodPrefix = "E%";
    } else {
      kodPrefix = "%%";
    }


   let result = await sequelize_EES.query(
      "SELECT TAN_KODU AS ISKARTA_KODU,ACIKLAMA FROM TANI_DET WITH(NOLOCK) WHERE TAN_SIRANO='024' AND TAN_KODU like :kodPrefix ORDER BY TAN_KODU",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {
          kodPrefix: kodPrefix
        }
      }
    );

    res.send(result);
  } catch (err) {
    res.status(400).json(err.message || err);
  }
});

app.post("/GetMachine", async (req, res) => {

  console.log(req.body)
  try {

    let result = await 
      sequelize_EES
    .query(
      "SELECT dbo.TEZ_MAS.ADI FROM [dbo].[TEZ_MAS] WHERE [SICIL] = :MAK_KOD",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {
          MAK_KOD: req.body.MAK_KOD,
        },
      }
    );
    res.send(result);
  }
 catch (err) {
  res.status(400).json(err.message || err);
}
});

app.post("/GetMaintanceWorker", (req, res) => {
  sequelize_EES
    .query(
      "SELECT SICIL,ADI_SOYADI,VAR_KODU,DIR_END, BTY_ISCI,MMRK FROM ISCI_TAN WHERE BTY_ISCI=1 AND CIKIS_TAR IS NULL ORDER BY SICIL",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {},
      }
    )
    .then(function (data) {
      res.send(data);
    });
});

app.post("/GetMaintanceReasons", (req, res) => {
  sequelize_EES
    .query(
      "SELECT TAN_KODU,ACIKLAMA,LISTE_SIRANO FROM TANI_DET WITH(NOLOCK) WHERE TAN_SIRANO='025'",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {},
      }
    )
    .then(function (data) {
      res.send(data);
    });
});

app.get("/Maintance/GetMaintanceWorks", (req, res) => {
  sequelize_EES
    .query(
      "SELECT BKM_ISOZ.* FROM BKM_ISOZ WHERE (SUBSTRING(ISEMRI, 2, 1) = 'T') AND (KAPA_TAR IS NULL) AND (RED_TARIH IS NULL) ORDER BY BKM_ISOZ.ISEMRI, BKM_ISOZ.SICIL, BKM_ISOZ.GUN_SAYI",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {},
      }
    )
    .then(function (data) {
      res.send(data);
    });
});

app.post("/InsertDURUS", async (req, res) => {
  let row = req.body.DURUS;

  await sequelize_UVT
    .query(
      "INSERT INTO kayip_sure (mak_kod,isemri,durus_tip,durus_tanim,bas_saat,bit_saat,sicil,kayip_sure) VALUES (:mak_kod,:isemri,:durus_tip,:durus_tanim,:bas_saat,:bit_saat,:sicil,:sure)",
      {
        type: sequelize_UVT.QueryTypes.INSERT,
        replacements: {
          mak_kod: row.mak_kod,
          isemri: row.isemri,
          durus_tip: row.durus_kodu,
          durus_tanim: row.durus_tanim,
          bas_saat: row.bas_saat,
          bit_saat: row.bit_saat,
          sicil: row.sicil,
          sure: row.sure || 0,
        },
      }
    )
    .then(function (data) {
      res.status(200).json(data);
    })
    .catch((err) => {
      console.error(err);
      res.status(400).json(err.message || err);
    });
});

app.post("/UpdateDURUS", (req, res) => {
  let row = req.body.DURUS;
  console.log(row);

  sequelize_UVT
    .query(
      "UPDATE KAYIP_SURE SET durus_tip = :DURUS_KOD, durus_tanim = :DURUS_TANIM, bas_saat = :BAS_SAAT , bit_saat = :BIT_SAAT, kayip_sure = :SURE,sicil = :SICIL where mak_kod = :MAK_KOD and bas_saat = :BAS_SAAT AND isemri = :ISEMRI",
      {
        replacements: {
          MAK_KOD: row.mak_kod,
          DURUS_KOD: row.durus_kodu,
          DURUS_TANIM: row.durus_tanim,
          BAS_SAAT: row.bas_saat,
          BIT_SAAT: row.bit_saat,
          SICIL: row.sicil,
          SURE: row.sure || 0,
          ISEMRI: row.isemri,
        },
        type: sequelize_UVT.QueryTypes.UPDATE,
      }
    )
    .then(function (data) {
      res.status(200).json(data);
    })
    .catch((err) => {
      console.error(err);
      res.status(400).json(err.message || err);
    });
});

app.post("/getBarkodList", async (req, res) => {
      sequelize_portal.query("SELECT x.mamulAdi, x.mamulStokNo, y.siraNo, y.icerecekMetin, y.aciklama FROM uvt_montaj_etiket_kontrol AS x LEFT JOIN uvt_montaj_etiket_kontrol_detay AS y ON y.uvtMontajEtiketKontrolID = x.uvtMontajEtiketKontrolID WHERE x.mamulStokNo = :STOCK_NO ORDER BY siraNo", {
                  replacements: {
                        STOCK_NO: req.body.STOCK_NO,
                  },
                  type: sequelize_EES.QueryTypes.SELECT,
            })
            .then((data) => {
                  res.status(200).send(data);
            })
            .catch((err) => {
                  res.status(404).send(err);
                  console.error(err.message);
            });
});

app.post("/bildirimMail/ASAS02", (req, res) => {
  sendMail(
    "asas02.bildirim@a-plasltd.com.tr",
    "[ASAS02] " + req.body.header,
    req.body.content
  )
    .then((x) => {
      res.send(x);
    })
    .catch((err) => {
      res.status(404).send(err);
    });
});

app.post("/testWORKS", async (req, res) => {
  try {
    let result = await sequelize_EES.query(
      "SELECT 0 AS uSAYAC, io.ISE_UREMIK, sm.MLZ_ADI, sm.MLZ_ADI_2, io.ISE_BAKIYE, io.ISEMRI_NO AS RECEIPTNO, io.ISE_TARIH AS TRANSDATE, sm.DOSYA_YERI, sm.FOTO_NO AS FOTO_NO, sm.STOKNO AS STOCKNO, sm.TEK_RESNO, io.OPER_KODU ASPPROCESSNO, io.OPER_SIRA AS PPROCESSORDERNO, tm.SICIL AS PWORKSTATIONNO, io.ISE_MIKTAR AS QUANTITY, sm.DEPO AS DEPOTNO, io.TEZ_SURE AS DURATION, io.URE_BAS_TAR AS STARTDATE, io.URE_BITIS_TAR AS ENDDATE, '' AS GIDECEK_YERI, ISNULL( isemriMta.MTA_ADI, ISNULL( stokMta.MTA_ADI, ISNULL( ( SELECT TOP 1 MLZ_ADI FROM STK_MAS WHERE STOKNO = sm.MTA_STKNO ), '' ) ) ) AS MTA_ADI, ISNULL( isemriMta.MTA_MIKTAR, ISNULL( stokMta.MTA_MIKTAR, ISNULL(sm.MTA_MIKTAR, 0) ) ) AS MTA_MIKTAR, '' AS ANA_MAMUL_NO, sm.MLZ_ADI AS ANA_MAMUL_ADI, io.CARPAN, io.BOLEN, km.BKM_1SAY, km.VUR_1SAY, (SELECT TOP 1 OZELLIK_DETAY_KODU FROM STK_OZELLIK WHERE OZELLIK_KODU = 'PRINT_TAG' AND STK_MAS_KAY = io.STK_MAS_KAY) as PRINT_TAG FROM ISE_OPER AS io WITH (NOLOCK) LEFT JOIN STK_MAS AS sm WITH (NOLOCK) ON io.STK_MAS_KAY = sm.KAYITNO LEFT JOIN KAL_MAS AS km WITH (NOLOCK) ON io.KAL_MAS_KAY = km.KAYITNO LEFT JOIN TEZ_MAS AS tm WITH (NOLOCK) ON io.TEZ_MAS_KAY = tm.KAYITNO OUTER APPLY ( SELECT TOP 1 a.MLZ_MIKTAR AS MTA_MIKTAR, b.MLZ_ADI AS MTA_ADI FROM MLZ_MTA AS a LEFT JOIN STK_MAS AS b ON b.STOKNO = a.MTA_STKNO WHERE a.TESL_YERI = io.DOSYA_YERI AND a.MLZ_STKNO = sm.STOKNO ) AS isemriMta OUTER APPLY ( SELECT TOP 1 a.MLZ_MIKTAR AS MTA_MIKTAR, b.MLZ_ADI AS MTA_ADI FROM MLZ_MTA AS a LEFT JOIN STK_MAS AS b ON b.STOKNO = a.MTA_STKNO WHERE a.MLZ_STKNO = sm.STOKNO ) AS stokMta WHERE io.ISE_BAKIYE > 0 AND io.KAPA_KODU = '' AND io.URE_BAS_TAR <= GETDATE() AND tm.SICIL = :TEZGAH ORDER BY io.KAYITNO DESC",
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: {
          TEZGAH: req.body.TEZGAH,
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(400).json(error.message || error);
  }
});

app.post("/TESTGetWorker", async (req, res) => {
  try {
    const SICIL = await sequelize_EES.query(
      "SELECT SICIL,ADI_SOYADI,VAR_KODU,DIR_END,BARKOD_NO, BTY_ISCI,MMRK FROM ISCI_TAN WHERE (SICIL=:BARKOD or BARKOD_NO=:TEXT or BARKOD_NO=:BARKOD ) AND CIKIS_TAR IS NULL ORDER BY SICIL",
      {
        replacements: {
          TEXT: req.body.TEXT.replace(/^0+/, ""),
          BARKOD: req.body.TEXT,
        },
        type: sequelize_EES.QueryTypes.SELECT,
      }
    );

    if (SICIL.length == 0) {
      throw "NOK";
    }

    let YETKINLIK = await axios
      .post(
        "http://10.45.1.111:4250/kalitePersonelYetkinlikKontrol",
        {
          sicilNo: SICIL[0].SICIL,
          makineKodu: req.body.MAK_KOD,
        },
        {
          "Content-Type": "application/json",
        }
      )
      .catch(function (error) {
        throw {
          error: "Yetkinlik kontrolünde hata ile karşılaşıldı!",
          err: error,
        };
      });

    YETKINLIK = YETKINLIK.data;

    if (YETKINLIK.kod) {
      throw {
        error: YETKINLIK.aciklama,
        err: YETKINLIK.aciklama,
      };
    }

    res.send({
      SICIL: SICIL[0],
      YETKINLIK: YETKINLIK.parcaEgitimKontrol,
      ZORUNLU_EGITIM: YETKINLIK.zorunluEgitimKontrol.onayMi,
      MAKINE_EGITIM: YETKINLIK.makineEgitimKontrol.onayMi,
    });
  } catch (err) {
    res.status(404).send(err);
  }
});

async function sendMail(adress, subject, message) {
  return new Promise(function (resolve, reject) {
    var transporter = nodemailer.createTransport({
      service: "hotmail",

      auth: {
        user: "ees.dosab@a-plasltd.com.tr",
        pass: "Zoto9103",
      },
    });

    var mailOptions = {
      from: "ees.dosab@a-plasltd.com.tr",
      to: adress,
      subject: subject,
      html: message,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        reject(error);
      } else {
        resolve("Email sent: " + info.response);
      }
    });
  });
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////
// BOYAHANE
//////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post("/Boyahane/Giris", async (req, res) => {
  try {
    let row = req.body;

    let validation = await sequelize_UVT.query(
      `select count(*) as MIKTAR from boyahaneGiris where barcode = '${row.barcode}'`,
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    if (validation[0].MIKTAR > 0) {
      throw ["Bu Barkod Daha Önce Okutulmuş."];
    }

    await sequelize_UVT.query(
      "INSERT INTO boyahaneGiris (type,type_id,color,date,worker,barcode) VALUES (:type,:type_id,:color,now(),:worker,:barcode)",
      {
        replacements: {
          type_id: row.type.id,
          type: row.type.type,
          color: row.color,
          worker: row.sicil,
          barcode: row.barcode,
        },
        type: sequelize_UVT.QueryTypes.INSERT,
      }
    );

    res.send({
      message: "OK",
    });
  } catch (err) {
    console.error(err);
    res.status(404).send(err);
  }
});

app.post("/Boyahane/InsertSCRAP", async (req, res) => {
  try {
    obj = req.body;

    await async.mapSeries(obj, async function (row) {
      await sequelize_UVT.query(
        'INSERT INTO ISKARTA_BOYAHANE (BARKOD,ISEMRI_NO,SICIL,TARIH,MAK_KOD,SEBEP_KODU) VALUES (:BARKOD,:ISEMRI_NO,:SICIL,NOW(),"",:SEBEP_KODU)',
        {
          replacements: {
            BARKOD: row.BARKOD,
            ISEMRI_NO: row.ISEMRI_NO,
            SICIL: row.SICIL,
            TARIH: row.TARIH_SAAT,
            MAK_KOD: row.TEZGAH,
            SEBEP_KODU: row.SEBEP_KODU,
          },
          type: sequelize_UVT.QueryTypes.INSERT,
        }
      );
    });

    res.send({
      message: "OK",
    });
  } catch (err) {
    console.error(err);
    res.status(404).send(err);
  }
});

app.post("/Boyahane/GetWorks", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT dbo.ISE_OPER.ISEMRI_NO, dbo.STK_MAS.MLZ_ADI FROM dbo.ISE_OPER INNER JOIN dbo.STK_MAS ON dbo.STK_MAS.KAYITNO = dbo.ISE_OPER.STK_MAS_KAY WHERE dbo.ISE_OPER.KAPA_KODU = '' AND dbo.ISE_OPER.ISL_YERI = '202' AND dbo.ISE_OPER.ISE_BAKIYE > 0 AND OPER_KODU = 'B-007' order by MLZ_ADI",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {},
      }
    );
    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(404).send(err);
  }
});

app.get("/Boyahane/ScrapReasons", async (req, res) => {
  try {
    let data = await sequelize_EES.query(
      "SELECT TAN_KODU AS ISKARTA_KODU, ACIKLAMA FROM TANI_DET WITH (NOLOCK) WHERE TAN_SIRANO = '024' AND TAN_KODU LIKE 'B%' ORDER BY TAN_KODU",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {},
      }
    );

    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(404).send(err);
  }
});

app.get("/Boyahane/getWork1", async (req, res) => {
  try {
    let validation = await sequelize_UVT.query(
      `select count(*) as MIKTAR from iskarta_boyahane where barkod = '${req.query.xBarkod}'`,
      {
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    validation = validation[0] || {};

    if (validation.MIKTAR > 0) {
      throw ["Bu Barkod Daha Önce Okutulmuş."];
    }

    let data = await db.raw(
      "EXEC BOYAHANE_URETIM_ISEMRI @xETIKET = '" + req.query.xBarkod + "'"
    );

    if (typeof data == "undefined" || !data || !data.length) {
      throw ["İş Emir Bulunamadı"];
    }

    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(404).send(err);
  }
});

app.get("/Boyahane/getStock/:process/:type", async (req, res) => {
  try {
    const process = req.params.process;
    const type = req.params.type;

    let data = await sequelize_EES.query(
      "select STOKNO,MLZ_ADI,MLZ_ADI_2 from stk_mas where MLZ_ADI_2 = :MLZ_ADI_2",
      {
        replacements: {
          MLZ_ADI_2: `${type} ${process}`,
        },
        type: sequelize_UVT.QueryTypes.SELECT,
      }
    );

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(400).send(err);
  }
});

app.post("/Boyahane/saveProduction", async (req, res) => {
  try {
    if (!req.body[0]) {
      throw "İşlem Hatası!!!";
    }

    let BARKOD = req.body[0].BARKOD;
    let SICIL = req.body[0].SICIL;

    if (!BARKOD) {
      throw "Barkod boş olamaz!";
    }

    BARKOD = BARKOD.replace(/[xyz]/g, "");

    let kontrol = await sequelize_UVT.query(
      "select count(*) as MIKTAR from boyahane_uretim_onay where barkod = :BARKOD",
      {
        type: sequelize_UVT.QueryTypes.SELECT,
        replacements: {
          BARKOD: BARKOD,
        },
      }
    );

    if (kontrol[0].MIKTAR > 0) {
      throw "Bu Barkod Daha Önce Okutulmuş.";
    }

    let isemirleri = await db.raw(
      "EXEC BOYAHANE_URETIM_ISEMRI @xETIKET = '" + BARKOD + "'"
    );

    if (
      typeof isemirleri == "undefined" ||
      !isemirleri ||
      isemirleri.length == 0
    ) {
      throw "İş Emri Bulunamadı";
    }

    await sequelize_UVT.query(
      'INSERT INTO boyahane_uretim_onay (BARKOD,ISEMRI_NO,SICIL,TARIH,MAK_KOD) VALUES (:BARKOD,:ISEMRI_NO,:SICIL,NOW(),"")',
      {
        replacements: {
          BARKOD: BARKOD,
          ISEMRI_NO: isemirleri[0].ISEMRI_NO,
          SICIL: SICIL,
        },
        type: sequelize_UVT.QueryTypes.INSERT,
      }
    );

    res.send({
      message: "OK",
    });
  } catch (err) {
    console.error(err);
    res.status(404).send([err.message || err]);
  }
});


app.get("/finalKontrol/test", async (req, res) => {
  try {
    if (!req.body[0]) {
      throw "İşlem Hatası!!!";
    }

  } catch (err) {
    console.error(err);
    res.status(404).send([err.message || err]);
  }
});

async function isemriBul(ISEMRI,MAK_KOD) {

  let tr = await sequelize_EES.query(
    "SELECT y.SICIL, x.ISEMRI_NO, x.OPER_SIRA, x.OPER_KODU, z.STOKNO FROM dbo.ISE_OPER AS x LEFT JOIN dbo.TEZ_MAS AS y ON y.KAYITNO = x.TEZ_MAS_KAY INNER JOIN dbo.STK_MAS AS z ON z.KAYITNO = x.STK_MAS_KAY WHERE y.SICIL = :MAK_KOD AND x.ISEMRI_NO = :ISEMRI",
    {
      type: sequelize_UVT.QueryTypes.SELECT,
      replacements: {
        ISEMRI: ISEMRI,
        MAK_KOD: MAK_KOD
      },
    }
  );
  return tr[0];
}
