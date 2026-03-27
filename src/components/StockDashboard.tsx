'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Search, ClipboardList, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

type StockBranch = { carhue: number; pigue: number; maza: number; total: number };

type ArticleData = {
  id: string;
  nombre: string;
  rubro: string;
  proveedor: string;
  stock: StockBranch;
  pend_remitir: StockBranch;
};

export default function StockDashboard({ initialData }: { initialData: ArticleData[] | null }) {
  const [data, setData] = useState<ArticleData[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Custom manual inputs for "Pendiente de Recibir"
  const [pendRecibir, setPendRecibir] = useState<Record<string, number>>({});
  const [isSummaryOpen, setSummaryOpen] = useState(false);
  
  // Collapsible categories state
  const [collapsedRubros, setCollapsedRubros] = useState<Record<string, boolean>>({});

  const toggleRubro = (rubro: string) => {
    setCollapsedRubros(prev => ({ ...prev, [rubro]: !prev[rubro] }));
  };

  useEffect(() => {
    if (!initialData) {
      fetch('/api/stock')
        .then(r => r.json())
        .then(d => {
          if (d.success) setData(d.data);
          setLoading(false);
        })
        .catch(e => {
          console.error(e);
          setLoading(false);
        });
    }
  }, [initialData]);

  // Handle pendRecibir input
  const handleRecibirChange = (id: string, val: string) => {
    setPendRecibir(prev => {
      if (val === '') {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const num = parseInt(val, 10);
      return { ...prev, [id]: isNaN(num) ? 0 : num };
    });
  };

  const calculateAction = (item: ArticleData, pRecibir: number) => {
    const stock = item.stock;
    const pRem = item.pend_remitir;

    const scCarhue = stock.carhue - pRem.carhue;
    const scPigue = stock.pigue - pRem.pigue;
    const scMaza = stock.maza - pRem.maza;

    const scParcialTotal = stock.total - pRem.total;
    const scFinalTotal = scParcialTotal + pRecibir;

    let actions: { tipo: string, cantidad: number, detalle: string }[] = [];

    if (scFinalTotal < 0) {
      actions.push({ tipo: 'COMPRAR', cantidad: Math.abs(scFinalTotal), detalle: 'Comprar por déficit total' });
      return { 
        status: 'COMPRAR', 
        color: 'bg-red-100 text-red-700 border-red-200', 
        warning: `Faltan ${Math.abs(scFinalTotal)} un. en total.`,
        actions
      };
    }

    if (scParcialTotal < 0 && scFinalTotal >= 0) {
      return { 
        status: 'ESPERAR LLEGADA DE MERCADERIA', 
        color: 'bg-blue-100 text-blue-700 border-blue-200', 
        warning: `El stock físico no alcanza, pero la compra en tránsito neutraliza el déficit.`,
        actions: []
      };
    }

    if (scCarhue < 0 || scPigue < 0 || scMaza < 0) {
      const branches = [
        { name: 'Carhué', sc: scCarhue },
        { name: 'Pigüé', sc: scPigue },
        { name: 'Villa Maza', sc: scMaza }
      ];
      const deficits = branches.filter(b => b.sc < 0).sort((a,b) => a.sc - b.sc);
      const surpluses = branches.filter(b => b.sc > 0).sort((a,b) => b.sc - a.sc);

      let suggestions: string[] = [];
      
      let sIdx = 0;
      for (let def of deficits) {
        let missing = Math.abs(def.sc);
        while (missing > 0 && sIdx < surpluses.length) {
          const surp = surpluses[sIdx];
          const amount = Math.min(missing, surp.sc);
          if (amount > 0) {
            suggestions.push(`Enviar ${amount} de ${surp.name} a ${def.name}`);
            actions.push({ tipo: 'TRASLADAR', cantidad: amount, detalle: `Desde ${surp.name} hacia ${def.name}` });
            surp.sc -= amount;
            missing -= amount;
          }
          if (surp.sc <= 0) sIdx++;
        }
      }

      return { 
        status: 'DISTRIBUIR', 
        color: 'bg-orange-100 text-orange-700 border-orange-200', 
        warning: suggestions.join(" | "),
        actions
      };
    }

    return { 
      status: 'OK', 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
      warning: 'Stock suficiente en todas las sucursales.',
      actions: []
    };
  };

  // Grouping and Filtering
  const groupedData = useMemo(() => {
    let filtered = data;
    if (globalSearch) {
      const searchLower = globalSearch.toLowerCase();
      filtered = filtered.filter(d => 
        (d.nombre && d.nombre.toLowerCase().includes(searchLower)) ||
        (d.rubro && d.rubro.toLowerCase().includes(searchLower)) ||
        (d.proveedor && d.proveedor.toLowerCase().includes(searchLower))
      );
    }

    // Group by Rubro
    const groups: Record<string, ArticleData[]> = {};
    filtered.forEach(d => {
      const g = d.rubro || 'Sin Rubro';
      if (!groups[g]) groups[g] = [];
      groups[g].push(d);
    });

    // Sort items within groups
    Object.keys(groups).forEach(g => {
      groups[g].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });

    // Define the exact order requested
    const RUBRO_ORDER = [
      "INSUMOS",
      "HERBICIDAS",
      "INSECTICIDAS",
      "FUNGICIDAS",
      "CURASEMILLAS",
      "HUMECTANTES",
      "BIOESTIMULANTES",
      "INOCULANTES",
      "SUPLEMENTOS ANIMALES",
      "BLOQUES",
      "NUCLEO",
      "SAL",
      "BALANCEADO",
      "FERTILIZANTES",
      "CHS",
      "TIMAC",
      "PROFERTIL",
      "FERTILIZANTES VARIOS",
      "MEGAPHOS LIQUIDOS",
      "YARA",
      "LDC INSUMOS",
      "SEMILLAS",
      "SORGO",
      "MAIZ",
      "SOJA",
      "TRIGO",
      "CEBADA",
      "PASTURAS",
      "VERDEOS",
      "GIRASOL",
      "HACIENDA",
      "HERRAMIENTAS VARIAS",
      "SILOBOLSAS",
      "VARIOS",
      "MECANO GANADERO",
      "BIOLOGICOS",
      "SERVICIOS"
    ];

    // Sort Groups by predefined order, then alphabetically
    return Object.keys(groups).sort((a, b) => {
      let idxA = RUBRO_ORDER.indexOf(a.toUpperCase());
      let idxB = RUBRO_ORDER.indexOf(b.toUpperCase());
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b);
    }).map(g => ({
      rubroName: g,
      items: groups[g]
    }));

  }, [data, globalSearch]);

  const actionSummaryRows = useMemo(() => {
    const rows: { articulo: string, rubro: string, tipo: string, cantidad: number, detalle: string }[] = [];
    groupedData.forEach(group => {
      group.items.forEach(item => {
        const pRecibir = pendRecibir[item.id] || 0;
        const action = calculateAction(item, pRecibir);
        if (action.actions && action.actions.length > 0) {
           action.actions.forEach(act => {
              rows.push({
                 articulo: item.nombre,
                 rubro: item.rubro,
                 tipo: act.tipo,
                 cantidad: act.cantidad,
                 detalle: act.detalle
              });
           });
        }
      });
    });
    // Sort so COMPRAR is first, then TRASLADAR
    rows.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.rubro.localeCompare(b.rubro) || a.articulo.localeCompare(b.articulo));
    return rows;
  }, [groupedData, pendRecibir]);

  const handleExportSummary = () => {
    if (!actionSummaryRows.length) return;
    const wsData = actionSummaryRows.map(row => ({
      "Artículo": row.articulo,
      "Rubro": row.rubro,
      "Acción a Tomar": row.tipo,
      "Cantidad": row.cantidad,
      "Detalle / Origen-Destino": row.detalle
    }));
    const worksheet = XLSX.utils.json_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Acciones de Stock");
    XLSX.writeFile(workbook, `Resumen_Ejecutivo_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="text-center p-12 text-slate-500 font-semibold tracking-wide">Cargando orígen de datos del sistema...</div>;

  return (
    <div className="h-full w-full mx-auto bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
      
      {/* Header */}
      <div className="flex-none bg-[#5c7025] p-4 lg:px-8 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-md z-10 relative">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <img src="/logo.png" alt="ACSA" className="h-12 object-contain bg-white p-1 rounded shadow shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Informe Comercial</h1>
            <p className="text-[#d7e4b2] text-xs md:text-sm font-medium mt-0.5">Status de Inventario y Recomendaciones</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800" />
            <input 
              type="text" 
              placeholder="Buscar por Rubro, Artículo..." 
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-md text-slate-800 w-full bg-[#f5f8ed] focus:ring-2 focus:ring-[#c39a2f] focus:outline-none placeholder-emerald-800/50 shadow-inner font-medium text-sm"
            />
          </div>
          <button 
            onClick={() => setSummaryOpen(true)}
            className="flex items-center gap-2 bg-[#c39a2f] hover:bg-[#a68225] text-white px-4 py-2 rounded-md font-bold text-sm shadow-md transition-colors whitespace-nowrap"
          >
            <ClipboardList className="w-4 h-4" />
            Ver Resumen Ejecutivo
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-xs text-left border-collapse table-fixed min-w-[1000px]">
          <thead className="text-[10px] md:text-xs text-slate-700 uppercase bg-slate-100 border-b-2 border-slate-300 shadow-sm sticky top-0 z-0 leading-tight">
            <tr>
              <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 w-[220px]">Artículo</th>
              <th colSpan={4} className="px-1 py-1 border-r border-slate-200 text-center bg-slate-50 text-slate-600 font-bold">Stock Físico<br/><span className="opacity-80">(S.F)</span></th>
              <th colSpan={4} className="px-1 py-1 border-r border-slate-200 text-center bg-red-50 text-red-600 font-bold border-b border-red-100 shadow-inner text-shadow-sm">Pendiente Remitir<br/><span className="opacity-80">(P.Rem)</span></th>
              <th rowSpan={2} className="px-1 py-2 border-r border-slate-200 text-center w-[74px] bg-blue-50 text-blue-700 cursor-help" title="Mercadería comprada aún sin ingresar al sistema físico.">Pend.<br/>Recibir<br/><span className="font-normal opacity-75">(P.Rec)</span></th>
              <th colSpan={4} className="px-1 py-1 border-r border-slate-200 text-center bg-emerald-50 text-emerald-700 font-bold">Saldo Comercial<br/><span className="font-normal opacity-80">(S.F - P.Rem)</span></th>
              <th rowSpan={2} className="px-1 py-2 border-r border-slate-200 text-center w-[74px] bg-slate-800 text-white shadow font-bold text-shadow">S.C<br/>FINAL<br/><span className="text-[9px] text-slate-300 font-normal leading-[1]">(S.C+P.Rec)</span></th>
              <th rowSpan={2} className="px-2 py-2 border-l-2 border-slate-300 text-center w-[110px] shadow-sm">Acción Sugerida</th>
            </tr>
            <tr>
               {/* Stock */}
               <th className="px-0 py-1.5 border-r border-slate-200 bg-slate-50 text-center font-medium w-[48px]">Carh</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-slate-50 text-center font-medium w-[48px]">Pigüé</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-slate-50 text-center font-medium w-[48px]">Maza</th>
               <th className="px-0 py-1.5 border-r border-slate-200 font-bold text-slate-800 text-center shadow-inner w-[56px]">Tot</th>
               
               {/* Pend. Remit */}
               <th className="px-0 py-1.5 border-r border-slate-200 bg-red-50/50 text-center text-red-600/80 w-[48px]">Carh</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-red-50/50 text-center text-red-600/80 w-[48px]">Pigüé</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-red-50/50 text-center text-red-600/80 w-[48px]">Maza</th>
               <th className="px-0 py-1.5 border-r border-slate-200 font-bold text-red-700 bg-red-50/80 text-center shadow-inner w-[56px]">Tot</th>
               
               {/* SC Parcial */}
               <th className="px-0 py-1.5 border-r border-slate-200 bg-emerald-50/50 text-center text-emerald-700/80 w-[48px]">Carh</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-emerald-50/50 text-center text-emerald-700/80 w-[48px]">Pigüé</th>
               <th className="px-0 py-1.5 border-r border-slate-200 bg-emerald-50/50 text-center text-emerald-700/80 w-[48px]">Maza</th>
               <th className="px-0 py-1.5 border-r border-slate-200 font-bold text-emerald-800 bg-emerald-50/80 text-center shadow-inner w-[56px]">Tot</th>
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 && (
              <tr>
                <td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {globalSearch ? 'No se encontraron resultados para la búsqueda.' : 'No hay datos de inventario disponibles.'}
                </td>
              </tr>
            )}

            {groupedData.map((group, gIdx) => (
              <React.Fragment key={gIdx}>
                {/* Rubro Header */}
                <tr className="bg-slate-200/70 border-y border-slate-300 cursor-pointer hover:bg-slate-300/60 transition-colors select-none" onClick={() => toggleRubro(group.rubroName)}>
                  <td colSpan={15} className="px-3 py-2 font-bold text-slate-800 tracking-wide uppercase">
                    <div className="flex items-center gap-2 w-full">
                      <button className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-800 transition-colors shadow-sm text-sm leading-none border border-slate-300 font-black">
                        {collapsedRubros[group.rubroName] ? '+' : '-'}
                      </button>
                      <div className="w-1.5 h-3 bg-[#c39a2f] rounded-full"></div>
                      {group.rubroName}
                      <span className="text-[10px] text-slate-500 font-semibold lowercase tracking-normal ml-2">({group.items.length} artículos)</span>
                    </div>
                  </td>
                </tr>
                
                {/* Articles */}
                {!collapsedRubros[group.rubroName] && group.items.map((item, iIdx) => {
                  const pRecibir = pendRecibir[item.id] || 0;
                  const action = calculateAction(item, pRecibir);
                  
                  const round = (n: number) => parseFloat(n.toFixed(4));
                  const scCarhue = round(item.stock.carhue - item.pend_remitir.carhue);
                  const scPigue  = round(item.stock.pigue  - item.pend_remitir.pigue);
                  const scMaza   = round(item.stock.maza   - item.pend_remitir.maza);
                  const scTotal  = round(item.stock.total  - item.pend_remitir.total);
                  const scFinal  = round(scTotal + pRecibir);
                  // Display helper: show integer if no fractional part
                  const fmt = (n: number) => Number.isInteger(n) ? n.toString() : n.toLocaleString('es-AR', { maximumFractionDigits: 4 });

                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                      <td className="px-2 py-2 font-semibold text-slate-800 border-r border-slate-100 truncate max-w-[250px]" title={item.nombre}>{item.nombre}</td>
                      
                      {/* Stock */}
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-slate-600">{item.stock.carhue}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-slate-600">{item.stock.pigue}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-slate-600">{item.stock.maza}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-200 font-bold bg-slate-50/50 text-slate-700">{item.stock.total}</td>
                      
                      {/* Pend Remit */}
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-red-500/90">{item.pend_remitir.carhue}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-red-500/90">{item.pend_remitir.pigue}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 text-red-500/90">{item.pend_remitir.maza}</td>
                      <td className="px-1 py-2 text-center border-r border-slate-200 font-bold bg-red-50/30 text-red-600">{item.pend_remitir.total}</td>
                      
                      {/* Pend. Recibir Editable */}
                      <td className="px-2 py-1.5 border-r border-slate-200 bg-blue-50/30">
                        <input 
                          type="number" 
                          min="0"
                          value={pendRecibir[item.id] !== undefined ? pendRecibir[item.id] : ''}
                          placeholder="0"
                          onChange={e => handleRecibirChange(item.id, e.target.value)}
                          className="w-full text-center py-1 px-1 bg-white border border-blue-200 rounded text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all shadow-inner hover:border-blue-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </td>

                      {/* SC Parcial */}
                      <td className={`px-1 py-2 text-center border-r border-slate-100 font-semibold ${scCarhue < 0 ? 'bg-orange-100/80 text-orange-700' : 'text-emerald-700/80'}`}>{fmt(scCarhue)}</td>
                      <td className={`px-1 py-2 text-center border-r border-slate-100 font-semibold ${scPigue  < 0 ? 'bg-orange-100/80 text-orange-700' : 'text-emerald-700/80'}`}>{fmt(scPigue)}</td>
                      <td className={`px-1 py-2 text-center border-r border-slate-100 font-semibold ${scMaza   < 0 ? 'bg-orange-100/80 text-orange-700' : 'text-emerald-700/80'}`}>{fmt(scMaza)}</td>
                      <td className={`px-1 py-2 text-center border-r border-slate-200 font-bold ${scTotal  < 0 ? 'bg-red-100/80 text-red-700' : 'bg-emerald-50/50 text-emerald-700'}`}>{fmt(scTotal)}</td>

                      {/* SC FINAL */}
                      <td className={`px-1 py-2 text-center border-r border-slate-200 font-extrabold text-sm ${scFinal < 0 ? 'bg-red-500 text-white shadow-inner' : 'bg-slate-700 text-white shadow-inner'}`}>
                        {fmt(scFinal)}
                      </td>

                      {/* Action */}
                      <td className="px-2 py-1.5 border-l-2 border-slate-200">
                        <div className={`px-2 py-1.5 rounded border text-[10px] md:text-xs font-bold flex flex-col items-center justify-center text-center shadow-sm h-full w-full ${action.color}`}>
                          <span>{action.status}</span>
                          {action.warning && action.status !== 'OK' && (
                            <span className="mt-1 text-[9px] font-medium opacity-90 leading-tight border-t border-current/20 pt-1 w-full" title={action.warning}>
                              {action.warning}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Resumen Ejecutivo */}
      {isSummaryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#c39a2f]/20 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-[#a68225]" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">Resumen Ejecutivo de Acción</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Pendientes de compra y envíos sugeridos entre sucursales.</p>
                </div>
              </div>
              <button onClick={() => setSummaryOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50/50">
              
              {actionSummaryRows.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 px-4 shadow-inner bg-white rounded-lg border border-slate-200">
                    <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No hay acciones sugeridas (Compras o Traslados) en base al stock actual y pendiente.</p>
                 </div>
              ) : (
                 <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm custom-scrollbar">
                    <table className="w-full text-sm text-left text-slate-600 font-medium">
                       <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-300 font-bold sticky top-0">
                          <tr>
                             <th className="px-4 py-3 border-r border-slate-200 w-1/3">Artículo</th>
                             <th className="px-4 py-3 border-r border-slate-200 w-1/5">Rubro</th>
                             <th className="px-4 py-3 border-r border-slate-200 text-center w-[120px]">Acción</th>
                             <th className="px-4 py-3 border-r border-slate-200 text-center w-[100px]">Cantidad</th>
                             <th className="px-4 py-3">Detalle</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {actionSummaryRows.map((row, idx) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 border-r border-slate-100 text-slate-800 font-semibold">{row.articulo}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-[11px] text-slate-500 font-bold uppercase tracking-wider">{row.rubro}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-center">
                                   <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${row.tipo === 'COMPRAR' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                      {row.tipo}
                                   </span>
                                </td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-center font-bold text-slate-800 text-base">{row.cantidad}</td>
                                <td className="px-4 py-2.5 text-slate-600 text-xs">{row.detalle}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}

            </div>
            
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between">
               <button onClick={handleExportSummary} disabled={actionSummaryRows.length === 0} className="flex items-center gap-2 bg-[#5c7025] hover:bg-[#4a5a1e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2 rounded-lg transition shadow-sm">
                 <Download className="w-4 h-4" />
                 Exportar a Excel
               </button>
               <button onClick={() => setSummaryOpen(false)} className="bg-slate-800 text-white font-bold text-sm px-6 py-2 rounded-lg hover:bg-slate-700 transition shadow">
                 Cerrar
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
