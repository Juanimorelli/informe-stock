'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Info } from 'lucide-react';

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

  // Logic to determine Action and Distribution
  const calculateAction = (item: ArticleData, pRecibir: number) => {
    const stock = item.stock;
    const pRem = item.pend_remitir;

    const scCarhue = stock.carhue - pRem.carhue;
    const scPigue = stock.pigue - pRem.pigue;
    const scMaza = stock.maza - pRem.maza;

    const scParcialTotal = stock.total - pRem.total;
    const scFinalTotal = scParcialTotal + pRecibir;

    if (scFinalTotal < 0) {
      return { 
        status: 'COMPRAR', 
        color: 'bg-red-100 text-red-700 border-red-200', 
        warning: `Faltan ${Math.abs(scFinalTotal)} un. en total.` 
      };
    }

    if (scParcialTotal < 0 && scFinalTotal >= 0) {
      return { 
        status: 'ESPERAR LLEGADA DE MERCADERIA', 
        color: 'bg-blue-100 text-blue-700 border-blue-200', 
        warning: `El stock físico no alcanza, pero la compra en tránsito neutraliza el déficit.` 
      };
    }

    // if we reach here, scFinalTotal >= 0 and scParcialTotal >= 0.
    // Check if any specific branch is deeply negative
    // Even if pRecibir covers the total, we might need a physical transfer if a branch is negative
    if (scCarhue < 0 || scPigue < 0 || scMaza < 0) {
      // Find who has surplus and who has deficit
      const branches = [
        { name: 'Carhué', sc: scCarhue },
        { name: 'Pigüé', sc: scPigue },
        { name: 'Villa Maza', sc: scMaza }
      ];
      const deficits = branches.filter(b => b.sc < 0).sort((a,b) => a.sc - b.sc);
      const surpluses = branches.filter(b => b.sc > 0).sort((a,b) => b.sc - a.sc);

      let suggestions: string[] = [];
      
      // Simple greedy matching
      let sIdx = 0;
      for (let def of deficits) {
        let missing = Math.abs(def.sc);
        while (missing > 0 && sIdx < surpluses.length) {
          const surp = surpluses[sIdx];
          const amount = Math.min(missing, surp.sc);
          if (amount > 0) {
            suggestions.push(`Enviar ${amount} de ${surp.name} a ${def.name}`);
            surp.sc -= amount;
            missing -= amount;
          }
          if (surp.sc <= 0) sIdx++;
        }
      }

      // If after the greedy pass there are still unresolved deficits,
      // the compact table already shows the totals — nothing extra to print.

      return { 
        status: 'DISTRIBUIR', 
        color: 'bg-orange-100 text-orange-700 border-orange-200', 
        warning: suggestions.join(" | ") 
      };
    }

    return { 
      status: 'OK', 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
      warning: 'Stock suficiente en todas las sucursales.' 
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

  if (loading) return <div className="text-center p-12 text-slate-500 font-semibold tracking-wide">Cargando orígen de datos del sistema...</div>;

  return (
    <div className="max-w-[1700px] mx-auto bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
      
      {/* Header */}
      <div className="bg-[#5c7025] p-6 lg:px-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md z-10 relative">
        <div className="flex items-center gap-4">
          {/* Logo Placeholder - Usually would be an img tag */}
          <img src="/logo.png" alt="Agrupación Camponuevo S.A." className="h-16 object-contain bg-white p-2 rounded shadow shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Informe Saldo Comercial</h1>
            <p className="text-[#d7e4b2] text-sm md:text-base font-medium mt-1">Status de Inventario, Ventas y Compras</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800" />
            <input 
              type="text" 
              placeholder="Buscar por Rubro, Artículo o Proveedor..." 
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-md text-slate-800 w-full bg-[#f5f8ed] border-transparent focus:ring-2 focus:ring-[#c39a2f] focus:outline-none placeholder-emerald-800/50 shadow-inner font-medium transition-all transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="overflow-x-auto custom-scrollbar relative">
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
    </div>
  );
}
