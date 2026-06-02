/**
 * formulaEvaluator.js
 * Core engine for evaluating spreadsheet formulas client-side.
 * Includes circular reference detection and complex formula guards.
 */

export const evaluateFormula = (formulaStr, rowCells, headers, colIdx = null, visited = new Set()) => {
  if (typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
    return formulaStr;
  }

  if (colIdx !== null) {
    if (visited.has(colIdx)) {
      return '#REF!';
    }
    visited.add(colIdx);
  }

  try {
    let expr = formulaStr.substring(1).toUpperCase();

    // Check if it is a complex formula (e.g., contains functions like VLOOKUP, IF, SUM, or other sheets references)
    const isComplex = /[A-Z]{2,}\s*\(/.test(expr) || expr.includes('!') || expr.includes('"') || expr.includes("'");
    if (isComplex) {
      return formulaStr;
    }

    const cellRefRegex = /([A-Z]+)([0-9]+)/g;
    
    expr = expr.replace(cellRefRegex, (match, colLetter) => {
      const targetColIdx = colLetter.charCodeAt(0) - 65; // A=0, B=1, ...
      if (targetColIdx >= 0 && targetColIdx < rowCells.length) {
        const val = rowCells[targetColIdx];
        const resolvedVal = (typeof val === 'string' && val.startsWith('=')) 
          ? evaluateFormula(val, rowCells, headers, targetColIdx, new Set(visited))
          : val;
          
        const num = parseFloat(resolvedVal);
        return isNaN(num) ? '0' : String(num);
      }
      return '0';
    });

    const safeExpr = expr.replace(/[^0-9+\-*/().\s]/g, '');
    if (!safeExpr.trim()) return '0';
    
    const result = Function(`"use strict"; return (${safeExpr})`)();
    return typeof result === 'number' && !isNaN(result) ? Number(result.toFixed(2)) : '0';
  } catch (err) {
    console.error('Formula evaluation error:', err);
    return formulaStr;
  }
};
