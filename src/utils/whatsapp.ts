import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { formatDistance } from './houseEstimator';

const STORAGE_KEYS = {
  WHATSAPP_TEMPLATE: 'missao_whatsapp_template_v1',
};

export const DEFAULT_WHATSAPP_TEMPLATE = `*CONVOCAÇÃO MISSIONÁRIA - {IGREJA}* 📖🕊️

Olá, *{DUPLA}*! Vocês foram designados para a distribuição especial de literatura missionária:

🏛️ *Ponto de Encontro:* {IGREJA}
📍 *Endereço:* {ENDERECO}
📅 *Data da Ação:* {DATA}
📖 *Livro Missionário:* {LIVRO}

━━━━━━━━━━━━━━━━━━━━
🎯 *SUA META & RETIRADA NA IGREJA:*
📚 *LIVROS A RETIRAR NA IGREJA:* *{LIVROS_RETIRADA} exemplares*
🏘️ *Total de residências mapeadas:* *~{CASAS} casas*
🚶‍♂️ *Extensão do percurso:* *{EXTENSAO}*
━━━━━━━━━━━━━━━━━━━━

🗺️ *SEU TRAJETO / FAIXA DESIGNADA:*
{ROTAS}

📋 *Orientações Importantes:*
1. Cheguem com 15 minutos de antecedência na igreja para oração e retirada dos seus *{LIVROS_RETIRADA} livros*.
2. Percorram a rua seguindo os marcos do cartão do território (do INÍCIO ao FIM).
3. Entreguem com oração e anotem os lares interessados em estudos bíblicos!

_“Quão formosos são os pés dos que anunciam a paz, dos que proclamam boas-novas!” (Romanos 10:15)_

Estamos orando pelo ministério de vocês! Nos vemos na igreja! 🙏`;

export function loadWhatsAppTemplate(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.WHATSAPP_TEMPLATE);
    return saved && saved.trim() ? saved : DEFAULT_WHATSAPP_TEMPLATE;
  } catch {
    return DEFAULT_WHATSAPP_TEMPLATE;
  }
}

export function saveWhatsAppTemplate(template: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WHATSAPP_TEMPLATE, template);
  } catch (err) {
    console.error('Failed to save WhatsApp template:', err);
  }
}

export function resetWhatsAppTemplate(): string {
  try {
    localStorage.removeItem(STORAGE_KEYS.WHATSAPP_TEMPLATE);
  } catch (err) {
    console.error('Failed to reset template:', err);
  }
  return DEFAULT_WHATSAPP_TEMPLATE;
}

/**
 * Sanitizes phone string into international WhatsApp format (e.g. 5511987654321)
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // If 10 or 11 digits (Brazilian DDD + number), prepend Brazil 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Formats official mission convocation message for a missionary pair using the template
 */
export function formatWhatsAppMessage(
  pair: MissionaryPair,
  assignedRoutes: RouteCorridor[],
  church: ChurchLocation,
  customTemplate?: string
): string {
  const template = customTemplate || loadWhatsAppTemplate();

  const membersGreeting =
    pair.members.length > 0 ? pair.members.join(' & ') : pair.name;

  const totalHouses = assignedRoutes.reduce(
    (acc, r) => acc + (r.customHouseCount ?? r.estimatedHouses),
    0
  );
  const totalBooks = Math.max(1, Math.round(totalHouses * 1.05));
  const totalDistance = assignedRoutes.reduce((acc, r) => acc + r.lengthMeters, 0);

  const formattedDate = church.campaignDate
    ? new Date(church.campaignDate + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data a confirmar';

  const routesList =
    assignedRoutes.length > 0
      ? assignedRoutes
          .map(
            (r, idx) =>
              `📍 *${idx + 1}. ${r.name}*\n   • Extensão: ${formatDistance(r.lengthMeters)}\n   • Residências: ~${
                r.customHouseCount ?? r.estimatedHouses
              } casas`
          )
          .join('\n\n')
      : '📍 *Trecho Territorial:* A definir na escala da igreja.';

  return template
    .replace(/{IGREJA}/g, church.name ? church.name.toUpperCase() : 'IGREJA LOCAL')
    .replace(/{ENDERECO}/g, church.address || 'Na igreja local')
    .replace(/{DATA}/g, formattedDate)
    .replace(/{LIVRO}/g, church.bookTitle || 'Livro da Campanha')
    .replace(/{LIDER}/g, church.leaderName || 'Coordenação')
    .replace(/{DUPLA}/g, membersGreeting)
    .replace(/{LIVROS_RETIRADA}/g, String(totalBooks))
    .replace(/{CASAS}/g, String(totalHouses))
    .replace(/{EXTENSAO}/g, formatDistance(totalDistance))
    .replace(/{ROTAS}/g, routesList);
}
