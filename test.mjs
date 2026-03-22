import sql from 'mssql';

async function run() {
  await sql.connect({
    user: 'biCN',
    password: 'c4mp0nu3v0!',
    database: 'BaseCampoNuevo',
    server: 'ascomercial.dynalias.org',
    port: 24433,
    options: { encrypt: true, trustServerCertificate: true }
  });
  
  const res = await sql.query("SELECT TOP 10 [Artículo], Sucursal, [P.Rem/Ped] as PRem FROM [V6_VentasPendientesDeRemitirPorSucursal] WHERE [P.Rem/Ped] > 0");
  console.log(res.recordset);
  process.exit(0);
  process.exit(0);
}

run();
