/**
 * Unified ECharts Formatter Registry
 * Decouples chart configurations from client-side execution.
 * Eliminates eval / new Function and serializes clean JSON without losing functions.
 */

export type FormatterFn = (params: any, ...args: any[]) => any;

/**
 * Common Value Formatters
 */
export const usdCurrency: FormatterFn = (v: number) => {
  return `$${Number(v).toLocaleString()}`;
};

export const fixed1: FormatterFn = (params: any) => {
  const val = typeof params === 'object' && params !== null ? params.value : params;
  return Number(val).toFixed(1);
};

export const signedFixed1: FormatterFn = (params: any) => {
  const val = typeof params === 'object' && params !== null ? params.value : params;
  const num = Number(val);
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}`;
};

export const positiveInteger: FormatterFn = (params: any) => {
  const val = typeof params === 'object' && params !== null ? params.value : params;
  const num = Number(val);
  return num > 0 ? `${num}` : '';
};

/**
 * Space Launches Chart Tooltips
 */
export const spacePayloadTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const year = params[0]?.axisValue;
  let total = 0;
  let res = `<div class="font-bold text-sky-400 mb-2">Year: ${year}</div><div class="space-y-1">`;
  const sorted = [...params].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  sorted.forEach((item) => {
    const val = Number(item.value) || 0;
    total += val;
    if (val > 0) {
      const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>`;
      res += `<div class="flex items-center justify-between text-xs gap-4">
        <span class="text-slate-300">${colorDot}${item.seriesName}</span>
        <span class="font-semibold text-slate-100">${val.toLocaleString()}</span>
      </div>`;
    }
  });
  res += `</div><div class="mt-2 pt-1 border-t border-slate-700/60 flex justify-between text-xs font-bold text-sky-300">
    <span>Total Launched:</span><span>${total.toFixed(1)}</span>
  </div>`;
  return res;
};

export const spaceCostTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const decade = params[0]?.axisValue;
  let res = `<div class="font-bold text-sky-400 mb-2">Decade: ${decade}</div><div class="space-y-1">`;
  const sorted = params
    .filter((item) => item.value !== null && item.value !== undefined && Number(item.value) > 0)
    .sort((a, b) => Number(a.value) - Number(b.value));
  sorted.forEach((item) => {
    const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>`;
    res += `<div class="flex items-center justify-between text-xs gap-4">
      <span class="text-slate-300">${colorDot}${item.seriesName}</span>
      <span class="font-semibold text-slate-100">${Number(item.value).toLocaleString()}</span>
    </div>`;
  });
  res += '</div>';
  return res;
};

/**
 * Ukraine Economic Chart Tooltips
 */
export const uaTradeTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const year = params[0]?.axisValue;
  let expItem: any = null;
  let impItem: any = null;
  let balanceVal: number | null = null;

  params.forEach((item: any) => {
    const name = item.seriesName;
    if (name === 'Exports') {
      expItem = item.data;
    } else if (name === 'Imports') {
      impItem = item.data;
    } else if (name.includes('Balance')) {
      balanceVal = Number(item.value);
    }
  });

  const expTotal = expItem?.total ?? Number(expItem?.value ?? 0);
  const impTotal = impItem?.total ?? Number(impItem?.value ?? 0);
  const exportsPartners: any[] = expItem?.partners || [];
  const importsPartners: any[] = impItem?.partners || [];

  let res = `<div class="font-bold text-sky-400 text-sm mb-2 pb-1 border-b border-slate-700">Year: ${year}</div>`;

  // Exports section
  res += `<div class="mb-2">
    <div class="text-blue-400 font-bold text-[11px] uppercase tracking-wider flex justify-between mb-1">
      <span>Exports</span>
      <span>${expTotal.toFixed(1)}</span>
    </div>
    <div class="flex flex-col gap-0.5">`;
  exportsPartners.forEach((it: any) => {
    res += `<div class="flex justify-between items-center text-xs gap-4">
      <span class="text-slate-300 font-medium">${it.name}</span>
      <span class="text-slate-100 font-bold">${it.value.toFixed(1)} <span class="text-slate-400 font-normal">(${it.pct}%)</span></span>
    </div>`;
  });
  res += `</div></div>`;

  // Imports section
  res += `<div class="mb-2">
    <div class="text-orange-400 font-bold text-[11px] uppercase tracking-wider flex justify-between mb-1">
      <span>Imports</span>
      <span>${impTotal.toFixed(1)}</span>
    </div>
    <div class="flex flex-col gap-0.5">`;
  importsPartners.forEach((it: any) => {
    res += `<div class="flex justify-between items-center text-xs gap-4">
      <span class="text-slate-300 font-medium">${it.name}</span>
      <span class="text-slate-100 font-bold">${it.value.toFixed(1)} <span class="text-slate-400 font-normal">(${it.pct}%)</span></span>
    </div>`;
  });
  res += `</div></div>`;

  // Trade Balance section
  if (balanceVal !== null) {
    const sign = balanceVal > 0 ? '+' : '';
    const balColorClass = balanceVal < 0 ? 'text-red-400' : 'text-emerald-400';
    res += `<div class="mt-2 pt-1.5 border-t border-slate-700 flex justify-between items-center text-xs font-bold">
      <span class="text-slate-300">Trade Balance:</span>
      <span class="${balColorClass} font-extrabold">${sign}${balanceVal.toFixed(1)}</span>
    </div>`;
  }

  return res;
};

/**
 * War Strikes and Attacks Tooltips
 */
export const shahedAttacksTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const month = params[0]?.axisValue;
  const count = params[0]?.value;
  return `<div class="font-bold text-sky-400 mb-1">${month}</div>
    <div class="text-xs text-slate-300">UAVs Launched: <span class="font-semibold text-rose-400">${Number(count).toLocaleString()}</span></div>`;
};

export const missileAttacksTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const month = params[0]?.axisValue;
  let total = 0;
  let res = `<div class="font-bold text-sky-400 mb-2">${month}</div><div class="space-y-1">`;
  params.forEach((item) => {
    const val = Number(item.value) || 0;
    total += val;
    const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>`;
    res += `<div class="flex items-center justify-between text-xs gap-4">
      <span class="text-slate-300">${colorDot}${item.seriesName}</span>
      <span class="font-semibold text-slate-100">${val.toLocaleString()}</span>
    </div>`;
  });
  res += `</div><div class="mt-2 pt-1 border-t border-slate-700/60 flex justify-between text-xs font-bold text-sky-300">
    <span>Total Missiles:</span><span>${total.toLocaleString()}</span>
  </div>`;
  return res;
};

/**
 * War Equipment Losses Tooltips
 */
export const warCategoryLossesTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const dataObj = params[0]?.data;
  const labelEn = dataObj?.label_en || params[0]?.name;
  const labelRu = dataObj?.label_ru;
  const ratio = dataObj?.ratio;
  const title = labelRu ? `${labelEn} (${labelRu})` : labelEn;

  let res = `<div class="font-bold text-sky-400 mb-2">${title}</div><div class="space-y-1">`;
  params.forEach((item) => {
    const val = typeof item.data === 'object' && item.data !== null ? item.data.value : item.value;
    const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>`;
    res += `<div class="flex items-center justify-between text-xs gap-4">
      <span class="text-slate-300">${colorDot}${item.seriesName}</span>
      <span class="font-semibold text-slate-100">${Number(val).toLocaleString()}</span>
    </div>`;
  });
  if (ratio) {
    res += `<div class="mt-2 pt-1 border-t border-slate-700/60 flex justify-between text-xs font-bold text-amber-300">
      <span>RF / UA Ratio:</span><span>${ratio} : 1</span>
    </div>`;
  }
  res += '</div>';
  return res;
};

export const warTimelineLossesTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const p0 = params[0];
  const dataObj = p0 && p0.data;
  const breakdown = (dataObj && dataObj.breakdown) || [];
  const period = p0.axisValue || p0.name || '';
  const rfTotal = dataObj && dataObj.rf !== undefined ? dataObj.rf : (params[0] ? params[0].value : 0);
  const uaTotal = dataObj && dataObj.ua !== undefined ? dataObj.ua : (params[1] ? params[1].value : 0);

  let rowsHtml = '';
  let hasRows = false;
  for (let i = 0; i < breakdown.length; i++) {
    const b = breakdown[i];
    if (b.rf === 0 && b.ua === 0) continue;
    hasRows = true;
    const rfClass = b.rf > 0 ? 'text-red-400 font-medium' : 'text-slate-500';
    const uaClass = b.ua > 0 ? 'text-blue-400 font-medium' : 'text-slate-500';
    rowsHtml += `
      <tr class="border-b border-slate-800/80">
        <td class="text-slate-300 py-1 pr-3 whitespace-nowrap">${b.name}</td>
        <td class="text-right px-2 py-1 tabular-nums ${rfClass}">${b.rf.toLocaleString()}</td>
        <td class="text-right pl-2 py-1 tabular-nums ${uaClass}">${b.ua.toLocaleString()}</td>
      </tr>
    `;
  }

  if (!hasRows) {
    rowsHtml = `<tr><td colspan="3" class="text-slate-500 py-2 text-center">No verified losses</td></tr>`;
  }

  return `
    <div class="text-xs min-w-[240px] p-0.5">
      <div class="font-bold text-sky-400 text-sm mb-2 pb-1 border-b border-slate-700/80">
        Period: ${period}
      </div>
      <table class="w-full border-collapse text-[11px]">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700/80">
            <th class="py-1 pr-3 font-semibold text-left">Category</th>
            <th class="py-1 px-2 text-right text-red-400 font-bold">RF</th>
            <th class="py-1 pl-2 text-right text-blue-400 font-bold">UA</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="border-t border-slate-600 font-bold">
            <td class="text-slate-200 pt-2 pr-3">Total (Month)</td>
            <td class="text-red-400 text-right px-2 pt-2 tabular-nums">${Number(rfTotal).toLocaleString()}</td>
            <td class="text-blue-400 text-right pl-2 pt-2 tabular-nums">${Number(uaTotal).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
};

/**
 * World Economic Indicators Tooltip and Labels
 */
export const worldEndLabel: FormatterFn = (params: any) => {
  const val = params.value;
  if (val === null || val === undefined || isNaN(val)) return '';
  const formatted = typeof val === 'number'
    ? (val >= 100 ? Math.round(val).toLocaleString() : (val % 1 === 0 ? val : val.toFixed(1)))
    : val;
  const yrTag = params.name && params.name !== '2024' ? ` (${params.name})` : '';
  return `${params.seriesName}${yrTag}: ${formatted}`;
};

export const worldMetricTooltip: FormatterFn = (params: any[]) => {
  if (!params || !params.length) return '';
  const year = params[0]?.axisValue;
  let res = `<div class="font-bold text-sky-400 mb-2">${year}</div><div class="space-y-1">`;
  const sorted = [...params].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  sorted.forEach((item) => {
    if (item.value !== null && item.value !== undefined) {
      const colorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color};margin-right:6px;"></span>`;
      res += `<div class="flex items-center justify-between text-xs gap-4">
        <span class="text-slate-300">${colorDot}${item.seriesName}</span>
        <span class="font-semibold text-slate-100">${Number(item.value).toLocaleString()}</span>
      </div>`;
    }
  });
  res += '</div>';
  return res;
};

/**
 * Master Registry of Formatters
 */
export const formatters: Record<string, FormatterFn> = {
  // Value formatters
  usdCurrency,
  fixed1,
  signedFixed1,
  positiveInteger,

  // Tooltips
  spacePayloadTooltip,
  spaceCostTooltip,
  uaTradeTooltip,
  shahedAttacksTooltip,
  missileAttacksTooltip,
  warCategoryLossesTooltip,
  warTimelineLossesTooltip,
  worldMetricTooltip,

  // Labels
  worldEndLabel,
};

/**
 * Recursively resolves formatter names in an ECharts option tree to real functions.
 */
export function resolveFormatters(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = resolveFormatters(obj[i]);
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'formatter' && typeof val === 'string' && formatters[val]) {
      obj[key] = formatters[val];
    } else if (key === 'formatterId' && typeof val === 'string' && formatters[val]) {
      obj.formatter = formatters[val];
      delete obj.formatterId;
    } else if (typeof val === 'object') {
      obj[key] = resolveFormatters(val);
    }
  }
  return obj;
}
