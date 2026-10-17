import React, { useState, useRef } from 'react';
import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { formatWhatsAppMessage, sanitizeWhatsAppPhone } from '../utils/whatsapp';
import { RouteMiniMap } from './RouteMiniMap';
import { exportElementToJpg, downloadImage } from '../utils/exporter';
import { generateStreetRouteMapDataUrl } from '../utils/mapSnapshot';
import {
  X,
  Send,
  Copy,
  Check,
  Download,
  Phone,
  BookOpen,
  MapPin,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface WhatsAppDispatchModalProps {
  pair: MissionaryPair;
  church: ChurchLocation;
  assignedRoutes: RouteCorridor[];
  onClose: () => void;
  onUpdatePairPhone?: (pairId: string, phone: string) => void;
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  pair,
  church,
  assignedRoutes,
  onClose,
  onUpdatePairPhone,
}) => {
  const [phone, setPhone] = useState(pair.phone || '');
  const [copied, setCopied] = useState(false);
  const [isExportingJpg, setIsExportingJpg] = useState(false);
  const previewCardRef = useRef<HTMLDivElement>(null);

  const cleanPhone = sanitizeWhatsAppPhone(phone);
  const [messageText, setMessageText] = useState(() =>
    formatWhatsAppMessage({ ...pair, phone }, assignedRoutes, church)
  );

  const handleResetMessage = () => {
    setMessageText(formatWhatsAppMessage({ ...pair, phone }, assignedRoutes, church));
  };

  const totalHouses = assignedRoutes.reduce(
    (acc, r) => acc + (r.customHouseCount ?? r.estimatedHouses),
    0
  );
  const totalBooks = Math.max(1, Math.round(totalHouses * 1.05));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  const handleDownloadImage = async () => {
    if (!primaryRoute) return;
    setIsExportingJpg(true);
    try {
      const sanitizedPair = (pair.name || 'dupla').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedRoute = (primaryRoute.name || 'rua').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dataUrl = await generateStreetRouteMapDataUrl(primaryRoute, church, pair, {
        width: 1400,
        height: 600,
      });
      downloadImage(dataUrl, `Trajeto_Missionario_${sanitizedPair}_${sanitizedRoute}.jpg`);
    } catch (err) {
      console.error('Export JPG error, falling back:', err);
      if (previewCardRef.current) {
        const sanitizedPair = (pair.name || 'dupla').replace(/[^a-zA-Z0-9_-]/g, '_');
        await exportElementToJpg(
          previewCardRef.current,
          `Trajeto_Missionario_${sanitizedPair}.jpg`
        );
      }
    } finally {
      setIsExportingJpg(false);
    }
  };

  const handlePhoneBlur = () => {
    if (onUpdatePairPhone && phone !== pair.phone) {
      onUpdatePairPhone(pair.id, phone);
    }
  };

  const primaryRoute = assignedRoutes[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full my-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with WhatsApp Theme */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shadow-xs">
              <Send className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                Convocação via WhatsApp
              </h3>
              <p className="text-xs text-emerald-100">
                {pair.name} • Envio do trajeto e quantidade de livros
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/70">
          {/* Key Dispatch Highlights Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Retirar na Igreja
                </span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {totalBooks} livros
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Para ~{totalHouses} casas
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Trecho Designado
                </span>
                <span className="text-xs font-bold text-slate-900 truncate block">
                  {primaryRoute ? primaryRoute.name : 'A definir'}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {assignedRoutes.length} faixa(s) vinculada(s)
                </span>
              </div>
            </div>
          </div>

          {/* Phone Number Input & Validation */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Telefone WhatsApp da Dupla</span>
              </span>
              <span className="text-[10px] text-slate-400">
                (Salvo automaticamente)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="Ex: (98) 98765-4321 ou 11987654321"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-mono"
              />
              {cleanPhone && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg shrink-0 border border-emerald-200">
                  Pronto
                </span>
              )}
            </div>
          </div>

          {/* Visual Route Thumbnail Section */}
          {primaryRoute && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Imagem do Trajeto Territorial
                </label>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isExportingJpg}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition"
                >
                  <Download className="w-3 h-3" />
                  <span>{isExportingJpg ? 'Gerando...' : 'Baixar Imagem (JPG)'}</span>
                </button>
              </div>

              <div ref={previewCardRef} className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                <RouteMiniMap route={primaryRoute} church={church} pair={pair} />
              </div>
            </div>
          )}

          {/* Formatted Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-slate-700 block">
                  Mensagem de Convocação
                </label>
                <span className="text-[10px] text-slate-400">
                  Você pode editar o texto abaixo antes de disparar:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetMessage}
                  title="Recarregar mensagem da matriz padrão"
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Restaurar
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 transition ml-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={8}
              className="w-full text-xs font-mono p-3 bg-white border border-slate-200 rounded-xl text-slate-800 leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500 resize-y shadow-xs selection:bg-emerald-100"
            />
            <div className="text-[10px] text-slate-400">
              💡 Para alterar o modelo permanente de todas as mensagens, acesse a aba <strong>Igreja</strong> no painel lateral.
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            Abre o WhatsApp já com o número da dupla e a mensagem pronta.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              Fechar
            </button>

            {cleanPhone ? (
              <a
                href={`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
                  messageText
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleDownloadImage}
                className="flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                <span>Abrir WhatsApp & Enviar</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl shadow-md transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Texto Copiado!' : 'Copiar Texto Convocação'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
