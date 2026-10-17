import React, { useRef, useState } from 'react';
import { ChurchLocation, MissionaryPair, RouteCorridor } from '../types';
import { RouteMiniMap, RouteMiniMapRef } from './RouteMiniMap';
import { exportElementToJpg, generateRoutePdf, downloadImage } from '../utils/exporter';
import { generateStreetRouteMapDataUrl } from '../utils/mapSnapshot';
import { formatDistance } from '../utils/houseEstimator';
import {
  X,
  FileDown,
  Image,
  Printer,
  CheckCircle2,
  MapPin,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  Send,
} from 'lucide-react';
import { WhatsAppDispatchModal } from './WhatsAppDispatchModal';

interface TerritoryCardModalProps {
  route: RouteCorridor;
  church: ChurchLocation;
  pairs: MissionaryPair[];
  onClose: () => void;
  onUpdateRoute: (updated: RouteCorridor) => void;
}

export const TerritoryCardModal: React.FC<TerritoryCardModalProps> = ({
  route,
  church,
  pairs,
  onClose,
  onUpdateRoute,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<RouteMiniMapRef>(null);
  const [isExportingJpg, setIsExportingJpg] = useState(false);
  const [isExportingMapJpg, setIsExportingMapJpg] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [notes, setNotes] = useState(route.notes || '');

  const pair = pairs.find((p) => p.id === route.pairId) || null;
  const houseCount = route.customHouseCount ?? route.estimatedHouses;
  const suggestedBooks = Math.round(houseCount * 1.05);

  const handleSaveNotes = () => {
    onUpdateRoute({
      ...route,
      notes,
    });
  };

  const handleExportMapJpg = async () => {
    setIsExportingMapJpg(true);
    try {
      const sanitizedPair = (pair?.name || 'dupla').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedRoute = (route.name || 'rua').replace(/[^a-zA-Z0-9_-]/g, '_');
      
      let dataUrl: string | null = null;
      // Captures the exact zoom, pan and map layer defined by the user in the interactive map!
      if (miniMapRef.current) {
        dataUrl = await miniMapRef.current.captureDataUrl();
      }
      if (!dataUrl) {
        dataUrl = await generateStreetRouteMapDataUrl(route, church, pair, {
          width: 1400,
          height: 600,
          layer: 'osm',
        });
      }
      downloadImage(dataUrl, `Mapa_Rua_${sanitizedPair}_${sanitizedRoute}.jpg`);
    } catch (err) {
      console.error('Error generating Map JPG:', err);
    } finally {
      setIsExportingMapJpg(false);
    }
  };

  const handleExportJpg = async () => {
    if (!cardRef.current) return;
    setIsExportingJpg(true);
    try {
      const sanitizedPair = (pair?.name || 'dupla').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedRoute = (route.name || 'rua').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportElementToJpg(
        cardRef.current,
        `Cartao_Territorio_${sanitizedPair}_${sanitizedRoute}.jpg`
      );
    } catch (err) {
      console.error('Error generating JPG:', err);
    } finally {
      setIsExportingJpg(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      let mapDataUrl: string | undefined;
      // 1. First priority: Capture the EXACT zoom, pan and map layer defined by the user in the preview!
      if (miniMapRef.current) {
        try {
          mapDataUrl = (await miniMapRef.current.captureDataUrl()) || undefined;
        } catch (captureErr) {
          console.warn('Mini map capture failed, fallback to direct OSM snapshot:', captureErr);
        }
      }
      // 2. Fallback if ref was not initialized
      if (!mapDataUrl) {
        mapDataUrl = await generateStreetRouteMapDataUrl(route, church, pair, {
          width: 1200,
          height: 520,
          layer: 'osm',
        });
      }
      await generateRoutePdf(route, church, pair, mapDataUrl);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Cartão de Território & Exportação
            </h3>
            <p className="text-xs text-slate-500">
              Identificação oficial da dupla, mapa do traçado e média de casas
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pair && (
              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition"
                title="Abrir convocação da dupla no WhatsApp com trajeto e livros"
              >
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            )}

            <button
              onClick={handleExportMapJpg}
              disabled={isExportingMapJpg}
              title="Salvar o mapa em JPG com o zoom e o enquadramento definidos na tela"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg shadow-sm transition"
            >
              <Image className="w-3.5 h-3.5" />
              <span>{isExportingMapJpg ? 'Gerando Mapa...' : 'Salvar Mapa em JPG'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              title="Salvar em PDF usando exatamente o zoom e o mapa que você definir na tela"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg shadow-sm transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Gerando PDF...' : 'Salvar em PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Preview */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60">
          {/* Printable Territory Card (Exact DOM captured by JPG exporter) */}
          <div
            ref={cardRef}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-md text-slate-900 max-w-xl mx-auto print:shadow-none print:border-none print:m-0"
          >
            {/* Top Church & Header Banner: Simple and clean */}
            <div className="border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Ministério de Publicações & Evangelismo Territorial
                  </span>
                  <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                    {church.name || 'Igreja Local'}
                  </h1>
                  <p className="text-xs text-slate-500">{church.address}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Cartão de Território</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    #{route.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Assignment Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Pair Box */}
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block mb-0.5">
                  Dupla Missionária
                </span>
                <span className="text-sm font-bold text-slate-900 block">
                  {pair ? pair.name : 'Dupla Não Atribuída'}
                </span>
                <span className="text-xs text-slate-600 block mt-0.5">
                  {pair?.members?.length ? pair.members.join(' & ') : 'Membros a definir'}
                </span>
                {pair?.phone && (
                  <span className="text-[11px] text-slate-500 block mt-1">Tel: {pair.phone}</span>
                )}
              </div>

              {/* Street & Targets Box */}
              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-0.5">
                  Faixa de Ruas & Metas
                </span>
                <span className="text-sm font-bold text-slate-900 block truncate">
                  {route.name}
                </span>
                <div className="flex items-center justify-between text-xs text-slate-700 mt-1 font-mono">
                  <span>Extensão: {formatDistance(route.lengthMeters)}</span>
                  <span className="font-bold text-blue-900">~{houseCount} casas</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center justify-between">
                  <span>Livro: {church.bookTitle}</span>
                  <span>Meta: {suggestedBooks} unids.</span>
                </div>
              </div>
            </div>

            {/* Real Map Thumbnail Preview Box (Streets default) */}
            <div className="preview-map-box mb-4">
              <RouteMiniMap ref={miniMapRef} route={route} church={church} pair={pair} />
            </div>

            {/* Observation Notes */}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Instruções & Observações do Trecho
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Ex: Começar pelo início da numeração; atentar aos cachorros nas casas com cerca baixa..."
                rows={2}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-md outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Checklist Sample Rows for Field Missionary Use */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Folha de Campo (Anotações da Dupla)
              </span>
              <table className="w-full text-[11px] border border-slate-300 rounded overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-1.5 text-left w-14">Nº Casa</th>
                    <th className="p-1.5 text-left">Morador / Contato</th>
                    <th className="p-1.5 text-center w-24">Recebeu Livro?</th>
                    <th className="p-1.5 text-center w-24">Fez Oração?</th>
                    <th className="p-1.5 text-left w-36">Interesse / Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <tr key={i} className="h-6">
                      <td className="p-1.5 text-slate-400">______</td>
                      <td className="p-1.5 text-slate-400">___________________</td>
                      <td className="p-1.5 text-center text-slate-400">[ ] Sim  [ ] Não</td>
                      <td className="p-1.5 text-center text-slate-400">[ ] Sim  [ ] Não</td>
                      <td className="p-1.5 text-slate-400">___________________</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Notice */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
              <span>{church.name} • Ministério Pessoal</span>
              <span>Devolver preenchido ao líder missionário</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-500">
            Dica: O mapa de ruas claro é otimizado para economizar tinta e caber 100% em uma única folha A4.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* WhatsApp Dispatch Modal */}
      {showWhatsAppModal && pair && (
        <WhatsAppDispatchModal
          pair={pair}
          church={church}
          assignedRoutes={[route]}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
    </div>
  );
};
