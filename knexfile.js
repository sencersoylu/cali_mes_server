module.exports = {
  development: {
           client: 'mssql',
        connection: {
          host: '10.45.1.111',
          user: 'sa',
          password: 'PLSkonigulsena206253',
          database: 'EES_CAL2023',
          // port:1433,
          // options: {
          //   trustedConnection: true
          // },
          useNullAsDefault: true
        }

  }
}
