import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { formatDistance } from './houseEstimator';
import { generateStreetRouteMapDataUrl } from './mapSnapshot';

/**
 * Downloads a canvas or data URL as a JPG file using Blobs to avoid iframe/CORS download restrictions
 */
export function downloadImage(dataUrl: string, filename: string) {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(parts[1]);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }
    const blob = new Blob([new Uint8Array(array)], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch (err) {
    console.warn('Blob download fallback to direct link:', err);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Normalizes Leaflet CSS 3D transforms in cloned DOM so html2canvas renders tiles and layers accurately
 */
export function fixLeafletClonedTransforms(clonedDoc: Document) {
  const tiles = clonedDoc.querySelectorAll<HTMLImageElement>('.leaflet-tile');
  tiles.forEach((tile) => {
    const transform = tile.style.transform;
    if (transform) {
      const match = transform.match(/translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/);
      if (match) {
        tile.style.transform = 'none';
        tile.style.position = 'absolute';
        tile.style.left = `${match[1]}px`;
        tile.style.top = `${match[2]}px`;
      }
    }
  });

  const mapPanes = clonedDoc.querySelectorAll<HTMLElement>(
    '.leaflet-map-pane, .leaflet-tile-container, .leaflet-proxy'
  );
  mapPanes.forEach((pane) => {
    if (pane.style.transform) {
      const match = pane.style.transform.match(/translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/);
      if (match) {
        pane.style.transform = 'none';
        pane.style.position = 'absolute';
        pane.style.left = `${match[1]}px`;
        pane.style.top = `${match[2]}px`;
      }
    }
  });
}

/**
 * Captures an HTML element and exports as JPG with bulletproof CORS and Leaflet transform handling
 */
export async function exportElementToJpg(
  element: HTMLElement,
  filename: string
): Promise<string> {
  // Attempt 1: Full capture with Leaflet transform normalization
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: fixLeafletClonedTransforms,
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    downloadImage(dataUrl, filename);
    return dataUrl;
  } catch (corsErr) {
    console.warn('Standard canvas export notice, retrying with tolerant capture mode:', corsErr);
    // Attempt 2: Tolerant capture
    const canvas = await html2canvas(element, {
      scale: 1.8,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: fixLeafletClonedTransforms,
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    downloadImage(dataUrl, filename);
    return dataUrl;
  }
}

/**
 * Generates an official printable single-page PDF Territory Card with:
 * - Simple, clean, ink-saving header
 * - Guaranteed street map thumbnail
 * - Perfectly fitted 1-page layout (never creates a 2nd page with just table rows)
 * - Rebalanced observation log table where the last column title never overflows
 */
export async function generateRoutePdf(
  route: RouteCorridor,
  church: ChurchLocation,
  pair: MissionaryPair | null,
  mapCanvasOrDataUrl?: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12; // 12mm margins give generous printable width of 186mm
  const contentWidth = pageWidth - margin * 2;

  // 1. HEADER: Simple, clean and ink-saving (no heavy black banner)
  const headerY = margin;
  const headerHeight = 16;

  // Light slate container with subtle border
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, headerY, contentWidth, headerHeight, 1.5, 1.5, 'FD');

  // Blue accent left bar
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.roundedRect(margin, headerY, 2.5, headerHeight, 1, 1, 'F');

  // Header Title
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CARTÃO DE TERRITÓRIO MISSIONÁRIO', margin + 6, headerY + 6.5);

  // Subtitle (Church & Department)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // Slate-600
  const churchSubtitle = `${church.name || 'Igreja Local'} • Ministério de Publicações & Evangelismo`;
  doc.text(churchSubtitle, margin + 6, headerY + 12);

  // Right side: Date and Campaign Book Title
  const todayStr = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Data: ${todayStr}`, pageWidth - margin - 5, headerY + 6.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Livro: ${church.bookTitle || 'Livro Missionário'}`,
    pageWidth - margin - 5,
    headerY + 12,
    { align: 'right' }
  );

  // 2. PAIR & STREET ASSIGNMENT BOX (Compact & clear)
  const infoY = headerY + headerHeight + 3;
  const infoHeight = 26;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, infoY, contentWidth, infoHeight, 1.5, 1.5, 'FD');

  // Left column: Pair information
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DUPLA MISSIONÁRIA DESIGNADA', margin + 5, infoY + 5.5);

  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235); // Blue-600
  doc.text(pair ? pair.name : 'Dupla Não Atribuída', margin + 5, infoY + 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const membersText =
    pair?.members && pair.members.length > 0
      ? `Integrantes: ${
          pair.members.length === 2
            ? `${pair.members[0]} & ${pair.members[1]}`
            : pair.members.length > 2
            ? `${pair.members.slice(0, -1).join(', ')} & ${pair.members[pair.members.length - 1]}`
            : pair.members[0]
        }`
      : 'Integrantes: A definir';
  doc.text(membersText, margin + 5, infoY + 18);

  if (pair?.phone) {
    doc.setTextColor(100, 116, 139);
    doc.text(`WhatsApp: ${pair.phone}`, margin + 5, infoY + 23);
  }

  // Vertical divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + contentWidth / 2, infoY + 3, margin + contentWidth / 2, infoY + infoHeight - 3);

  // Right column: Street and House count statistics
  const rightColX = margin + contentWidth / 2 + 5;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TRECHO / FAIXA DE DISTRIBUIÇÃO', rightColX, infoY + 5.5);

  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72); // Rose-600
  doc.text(route.name || 'Faixa de Ruas Sem Nome', rightColX, infoY + 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const houses = route.customHouseCount ?? route.estimatedHouses;
  doc.text(
    `Extensão: ${formatDistance(route.lengthMeters)}  |  Casas Estimadas: ~${houses} residências`,
    rightColX,
    infoY + 18
  );

  const suggestedBooks = Math.round(houses * 1.05);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text(`Meta Sugerida de Livros: ${suggestedBooks} exemplares`, rightColX, infoY + 23);

  // 3. MAP SNAPSHOT SECTION (Clean street map thumbnail with real street tiles)
  const mapY = infoY + infoHeight + 3;
  const mapHeight = 65; // Balanced height fits comfortably on 1 page

  let finalMapImage = mapCanvasOrDataUrl;
  if (!finalMapImage || finalMapImage.length < 100) {
    try {
      finalMapImage = await generateStreetRouteMapDataUrl(route, church, pair, {
        width: 1200,
        height: 520,
        layer: 'osm',
      });
    } catch (renderErr) {
      console.warn('Direct street tile canvas error:', renderErr);
    }
  }

  if (finalMapImage && finalMapImage.length > 100) {
    try {
      doc.addImage(finalMapImage, 'JPEG', margin, mapY, contentWidth, mapHeight);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.rect(margin, mapY, contentWidth, mapHeight, 'D');
    } catch (err) {
      console.warn('PDF image embed fallback to direct vector map:', err);
      drawVectorMap(doc, margin, mapY, contentWidth, mapHeight, route, church, pair);
    }
  } else {
    drawVectorMap(doc, margin, mapY, contentWidth, mapHeight, route, church, pair);
  }

  // 4. MISSIONARY FIELD OBSERVATION LOG TABLE (Tabela de Campo)
  // Rebalanced column widths so the last column title NEVER overflows!
  const tableY = mapY + mapHeight + 4;
  const tableHeaderHeight = 6.5;

  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(margin, tableY, contentWidth, tableHeaderHeight, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(margin, tableY, contentWidth, tableHeaderHeight, 'D');

  // Column definitions (total width: contentWidth = 186mm)
  // Col 1: Nº Casa -> 18mm
  // Col 2: Morador / Contato -> 54mm
  // Col 3: Livro? -> 24mm
  // Col 4: Oração? -> 24mm
  // Col 5: Interesse / Observações -> 66mm (ample room, never overflows!)
  const col1W = 18;
  const col2W = 54;
  const col3W = 24;
  const col4W = 24;
  const col5W = contentWidth - (col1W + col2W + col3W + col4W); // 66mm

  const xCol1 = margin;
  const xCol2 = xCol1 + col1W;
  const xCol3 = xCol2 + col2W;
  const xCol4 = xCol3 + col3W;
  const xCol5 = xCol4 + col4W;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Nº CASA', xCol1 + 3, tableY + 4.5);
  doc.text('MORADOR / CONTATO', xCol2 + 3, tableY + 4.5);
  doc.text('RECEBEU LIVRO?', xCol3 + 2, tableY + 4.5);
  doc.text('FEZ ORAÇÃO?', xCol4 + 2, tableY + 4.5);
  doc.text('INTERESSE / OBSERVAÇÕES', xCol5 + 3, tableY + 4.5);

  // 20 Field Observation Rows (fills the page comfortably down to the footer)
  const rowHeight = 6.8;
  const numRows = 20;
  const startRowY = tableY + tableHeaderHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  for (let i = 0; i < numRows; i++) {
    const curY = startRowY + i * rowHeight;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);

    // Vertical column divider guides
    doc.line(xCol2, curY, xCol2, curY + rowHeight);
    doc.line(xCol3, curY, xCol3, curY + rowHeight);
    doc.line(xCol4, curY, xCol4, curY + rowHeight);
    doc.line(xCol5, curY, xCol5, curY + rowHeight);

    // Light check boxes
    doc.setTextColor(148, 163, 184);
    doc.text('[  ] Sim  [  ] Não', xCol3 + 2, curY + 4.5);
    doc.text('[  ] Sim  [  ] Não', xCol4 + 2, curY + 4.5);
  }

  // Outer border of table
  const totalTableHeight = tableHeaderHeight + numRows * rowHeight;
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, tableY, contentWidth, totalTableHeight, 'D');

  // 5. FOOTER: Biblical encouragement & return instructions (Clean 2-line layout, zero overlapping)
  const footerDividerY = tableY + totalTableHeight + 3.5;
  const footerY1 = footerDividerY + 4.5;
  const footerY2 = footerY1 + 4.2;

  // Thin subtle divider line above footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerDividerY, margin + contentWidth, footerDividerY);

  // Line 1: Biblical promise (centered)
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.text(
    '“Aquele que leva a preciosa semente, andando e chorando, voltará com júbilo, trazendo consigo os seus feixes.” (Salmos 126:6)',
    pageWidth / 2,
    footerY1,
    { align: 'center' }
  );

  // Line 2: Delivery & return instruction with church identification (centered)
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${church.name || 'Igreja'} • Ministério Pessoal — Por favor, entregue este cartão preenchido à coordenação missionária ao fim da atividade.`,
    pageWidth / 2,
    footerY2,
    { align: 'center' }
  );

  // Ensure jsPDF document is strictly single-page
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    doc.deletePage(totalPages);
  }

  const sanitizedRoute = (route.name || 'faixa').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedPair = (pair?.name || 'dupla').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Cartao_Territorio_${sanitizedPair}_${sanitizedRoute}.pdf`;

  try {
    doc.save(filename);
  } catch (saveErr) {
    console.warn('Standard jsPDF save error, triggering Blob download fallback:', saveErr);
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1500);
  }
}

/**
 * Draws a high-definition vector street map directly in jsPDF when image capture is not provided
 */
export function drawVectorMap(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  route: RouteCorridor,
  church?: ChurchLocation,
  pair?: MissionaryPair | null
) {
  // Map background: Light clear street theme
  doc.setFillColor(248, 250, 252);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, 'D');

  // Subtle street grid lines
  doc.setDrawColor(235, 240, 245);
  doc.setLineWidth(0.3);
  for (let gx = x + 16; gx < x + w; gx += 16) {
    doc.line(gx, y, gx, y + h);
  }
  for (let gy = y + 12; gy < y + h; gy += 12) {
    doc.line(x, gy, x + w, gy);
  }

  const coords = route.coordinates;
  if (coords && coords.length >= 2) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    coords.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    const latSpan = Math.max(maxLat - minLat, 0.0006);
    const lngSpan = Math.max(maxLng - minLng, 0.0006);

    const padX = 22;
    const padY = 14;
    const usableW = w - padX * 2;
    const usableH = h - padY * 2;

    const toX = (lng: number) => x + padX + ((lng - minLng) / lngSpan) * usableW;
    const toY = (lat: number) => y + h - padY - ((lat - minLat) / latSpan) * usableH;

    // Route underlay glow
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(3.5);
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(toX(coords[i][1]), toY(coords[i][0]), toX(coords[i + 1][1]), toY(coords[i + 1][0]));
    }

    // Main Route Line
    doc.setDrawColor(37, 99, 235); // Blue
    doc.setLineWidth(1.8);
    for (let i = 0; i < coords.length - 1; i++) {
      doc.line(toX(coords[i][1]), toY(coords[i][0]), toX(coords[i + 1][1]), toY(coords[i + 1][0]));
    }

    // Intermediate Waypoint dots
    doc.setFillColor(37, 99, 235);
    coords.forEach(([lat, lng]) => {
      doc.circle(toX(lng), toY(lat), 0.8, 'F');
    });

    // Start Marker (Emerald green with badge)
    const [startLat, startLng] = coords[0];
    const sX = toX(startLng);
    const sY = toY(startLat);
    doc.setFillColor(16, 185, 129);
    doc.circle(sX, sY, 2.8, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.6);
    doc.circle(sX, sY, 2.8, 'D');

    // End Marker (Rose red with badge)
    const [endLat, endLng] = coords[coords.length - 1];
    const eX = toX(endLng);
    const eY = toY(endLat);
    doc.setFillColor(225, 29, 72);
    doc.circle(eX, eY, 2.8, 'F');
    doc.circle(eX, eY, 2.8, 'D');
  }

  // Street Identity Badge (Top Left)
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(x + 4, y + 4, 82, 11, 1.2, 1.2, 'F');
  doc.setTextColor(253, 224, 71); // Amber-300
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(route.name || 'Faixa Territorial', x + 7, y + 8.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const houses = route.customHouseCount ?? route.estimatedHouses;
  doc.text(`Extensão: ${formatDistance(route.lengthMeters)}  •  ~${houses} casas`, x + 7, y + 12.5);

  // Legend badges bottom left
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 4, y + h - 8.5, 76, 5.5, 1, 1, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105); // Green
  doc.text('● Início', x + 7, y + h - 4.8);
  doc.setTextColor(225, 29, 72); // Rose
  doc.text('● Fim', x + 23, y + h - 4.8);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('— Traçado da Rua', x + 38, y + h - 4.8);
}

/**
 * Generates an official printable summary report of all missionary pairs and routes
 */
export async function generateCampaignSummaryPdf(
  church: ChurchLocation,
  pairs: MissionaryPair[],
  routes: RouteCorridor[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Header
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, margin, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, margin, 2.5, 18, 1, 1, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO GERAL DE TERRITÓRIOS & METAS', margin + 6, margin + 7.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${church.name || 'Igreja Local'} • Campanha: ${church.bookTitle || 'Livro Missionário'}`,
    margin + 6,
    margin + 13.5
  );

  const todayStr = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Data: ${todayStr}`, pageWidth - margin - 5, margin + 7.5, { align: 'right' });
  doc.text(
    `Total: ${routes.length} faixas | ${pairs.length} duplas`,
    pageWidth - margin - 5,
    margin + 13.5,
    { align: 'right' }
  );

  // Table of all routes
  let curY = margin + 23;
  const rowHeight = 7;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 7, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, curY, contentWidth, 7, 'D');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('FAIXA / RUA', margin + 3, curY + 4.8);
  doc.text('DUPLA DESIGNADA', margin + 65, curY + 4.8);
  doc.text('EXTENSÃO', margin + 115, curY + 4.8);
  doc.text('CASAS', margin + 140, curY + 4.8);
  doc.text('LIVROS', margin + 162, curY + 4.8);

  curY += 7;
  doc.setFont('helvetica', 'normal');

  routes.forEach((r, idx) => {
    const pair = pairs.find((p) => p.id === r.pairId);
    const houses = r.customHouseCount ?? r.estimatedHouses;
    const books = Math.round(houses * 1.05);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, curY + rowHeight, margin + contentWidth, curY + rowHeight);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(r.name || `Faixa ${idx + 1}`, margin + 3, curY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(pair ? 37 : 148, pair ? 99 : 163, pair ? 235 : 184);
    doc.text(pair ? pair.name : 'Não atribuída', margin + 65, curY + 4.8);

    doc.setTextColor(71, 85, 105);
    doc.text(formatDistance(r.lengthMeters), margin + 115, curY + 4.8);
    doc.text(`~${houses}`, margin + 140, curY + 4.8);

    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text(`${books} unids.`, margin + 162, curY + 4.8);

    curY += rowHeight;
  });

  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, margin + 23, contentWidth, curY - (margin + 23), 'D');

  const filename = `Relatorio_Geral_Territorios_${todayStr.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}
