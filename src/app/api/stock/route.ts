import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    const pool = await connectToDatabase();

    // Fetch Stock Data
    const stockResult = await pool.request().query('SELECT * FROM [V6_ArticulosInventario]');
    const stockData = stockResult.recordset;

    // Fetch Pendientes Data
    const pendResult = await pool.request().query('SELECT * FROM [V6_VentasPendientesDeRemitirPorSucursal]');
    const pendData = pendResult.recordset;

    // Process Pendientes into a quick lookup dictionary by ID Artículo
    // { "Art1": { "CARHUE": 10, "PIGUE": 5, "MAZA": 0, "TOTAL": 15 } }
    const pendMap: Record<string, any> = {};

    pendData.forEach((row: any) => {
      // Find the "ID Art" key avoiding exact text encoding issues if any exists
      const artIdKey = Object.keys(row).find(k => k.includes('ID Art')) || 'ID Articulo';
      const ID = row[artIdKey];
      if (!ID) return;

      const sucursal = (row['Sucursal'] || '').toUpperCase();
      const pendVal = row['P.Rem/Ped'] || 0;

      if (!pendMap[ID]) {
        pendMap[ID] = { CARHUE: 0, PIGUE: 0, MAZA: 0, TOTAL: 0 };
      }

      if (sucursal.includes('CARHUE')) {
        pendMap[ID].CARHUE += pendVal;
      } else if (sucursal.includes('PIGUE') || sucursal.includes('PIGUÉ')) {
        pendMap[ID].PIGUE += pendVal;
      } else if (sucursal.includes('MAZA')) {
        pendMap[ID].MAZA += pendVal;
      }
      pendMap[ID].TOTAL += pendVal;
    });

    // Merge everything together
    const finalData = stockData.map((sRow: any) => {
      const artId = sRow['IDItem'];
      const pData = pendMap[artId] || { CARHUE: 0, PIGUE: 0, MAZA: 0, TOTAL: 0 };

      return {
        id: artId,
        nombre: sRow['Nombre'],
        rubro: sRow['Rubro'] || 'Sin Rubro',
        proveedor: sRow['Proveedor'] || 'Sin Proveedor',
        stock: {
          carhue: sRow['AGRONOMIA CARHUE'] || 0,
          pigue: sRow['SUC.  PIGUE'] || 0,
          maza: sRow['SUC. VILLA MAZA'] || 0,
          total: sRow['.TOTAL'] || 0,
        },
        pend_remitir: {
          carhue: pData.CARHUE,
          pigue: pData.PIGUE,
          maza: pData.MAZA,
          total: pData.TOTAL,
        }
      };
    });

    return NextResponse.json({ success: true, data: finalData });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
