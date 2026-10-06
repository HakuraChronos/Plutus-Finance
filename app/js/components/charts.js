/* ==========================================================================
   PLUTUS FINANCE - RETINA CANVAS CHARTS (MINIMALIST / ENGLISH)
   ========================================================================== */

import { store } from '../state.js';

/**
 * Adjusts canvas resolution for High-DPI (Retina) displays
 */
function setupRetinaCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.parentElement.clientWidth || 400;
  const height = rect.height || 250;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

/**
 * Renders Cash Flow Comparison Chart (Income vs Expense) over months
 */
export function renderCashFlowChart(canvas, dataPoints) {
  if (!canvas) return;
  const { ctx, width, height } = setupRetinaCanvas(canvas);

  ctx.clearRect(0, 0, width, height);

  const padding = { top: 25, right: 16, bottom: 35, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Determine max value
  let maxVal = 0;
  dataPoints.forEach(d => {
    if (d.income > maxVal) maxVal = d.income;
    if (d.expense > maxVal) maxVal = d.expense;
  });

  const hasData = maxVal > 0;
  if (!hasData) {
    maxVal = 1000; // Baseline scale
  } else {
    maxVal = Math.ceil(maxVal * 1.15); // Add top margin
  }

  // Draw Horizontal Grid Lines
  const gridLines = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#71717a';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const val = maxVal * (1 - i / gridLines);
    ctx.fillText(store.formatMoney(val), padding.left - 8, y + 4);
  }

  if (!hasData) {
    ctx.fillStyle = '#71717a';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No cash flow recorded yet', padding.left + chartWidth / 2, padding.top + chartHeight / 2);
    return;
  }

  // Draw Bar Groups (Income & Expense)
  const groupWidth = chartWidth / dataPoints.length;
  const barWidth = Math.min(18, groupWidth * 0.28);

  dataPoints.forEach((d, idx) => {
    const groupCenter = padding.left + groupWidth * idx + groupWidth / 2;

    // 1. Income Column (Green)
    if (d.income > 0) {
      const incH = (d.income / maxVal) * chartHeight;
      const incX = groupCenter - barWidth - 2;
      const incY = padding.top + chartHeight - incH;

      ctx.fillStyle = '#22c55e';
      drawRoundedRect(ctx, incX, incY, barWidth, incH, 3);
      ctx.fill();
    }

    // 2. Expense Column (Rose / Coral)
    if (d.expense > 0) {
      const expH = (d.expense / maxVal) * chartHeight;
      const expX = groupCenter + 2;
      const expY = padding.top + chartHeight - expH;

      ctx.fillStyle = '#f43f5e';
      drawRoundedRect(ctx, expX, expY, barWidth, expH, 3);
      ctx.fill();
    }

    // Month Label on X Axis
    ctx.fillStyle = '#a1a1aa';
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillText(d.label, groupCenter, height - 10);
  });
}

/**
 * Donut chart for expense distribution by category
 */
export function renderCategoryDonutChart(canvas, categoriesWithAmounts) {
  if (!canvas) return;
  const { ctx, width, height } = setupRetinaCanvas(canvas);

  ctx.clearRect(0, 0, width, height);

  const total = categoriesWithAmounts.reduce((acc, curr) => acc + curr.amount, 0);

  const centerX = width / 2;
  const centerY = height / 2 - 8;
  const outerRadius = Math.min(centerX, centerY) - 18;
  const innerRadius = outerRadius * 0.65;

  if (total === 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, (outerRadius + innerRadius) / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#71717a';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No expenses yet', centerX, centerY + 4);
    return;
  }

  let startAngle = -Math.PI / 2;

  categoriesWithAmounts.forEach(cat => {
    const sliceAngle = (cat.amount / total) * (Math.PI * 2);
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = cat.color || '#a1a1aa';
    ctx.fill();

    ctx.strokeStyle = '#111114';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Text in center of Donut
  ctx.fillStyle = '#71717a';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL EXPENSES', centerX, centerY - 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(store.formatMoney(total), centerX, centerY + 12);
}

/**
 * Draws rectangle with rounded top corners
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height < radius) radius = Math.max(0, height);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
