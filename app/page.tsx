"use client";

/** <!-- Desenvolvido por Guilherme Olsen ® --> */

import { useMemo, useRef, useState } from "react";

type RouteMapUrl = {
  label: string;
  url: string;
};

type RouteStop = {
  sequence: number;
  orderCode: string;
  customer: string;
  rawAddress: string;
  normalizedAddress: string;
  mapAddress: string;
  city: string;
  district: string;
};

type RouteCard = {
  vehicle: string;
  region: string;
  status: string;
  stops: RouteStop[];
  mapUrls: RouteMapUrl[];
};

type SavedRouteHistory = {
  id: string;
  createdAt: string;
  origin: string;
  vehicleCount: string;
  fileName: string;
  totalStops: number;
  routes: RouteCard[];
  aiResult: string;
};

function buildInitialRoutes(count = 3): RouteCard[] {
  return Array.from({ length: count }, (_, index) => ({
    vehicle: `Veículo ${index + 1}`,
    region: `Região ${index + 1}`,
    status: "Aguardando processamento da IA.",
    stops: [],
    mapUrls: [],
  }));
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [origin, setOrigin] = useState("Sua Cidade, UF - Endereço de Partida");
  const [vehicleCount, setVehicleCount] = useState("1");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [routes, setRoutes] = useState<RouteCard[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  async function handleLogout() {
    if (!confirm("Deseja realmente sair do sistema?")) return;
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });
      if (response.ok) {
        window.location.href = "/login";
      } else {
        alert("Erro ao efetuar logout.");
      }
    } catch (err) {
      console.error("Erro no logout:", err);
      alert("Falha de conexão ao efetuar logout.");
    }
  }

  const allStops = useMemo(() => {
    return routes.flatMap((route) =>
      route.stops.map((stop) => ({
        ...stop,
        vehicle: route.vehicle,
        region: route.region,
      }))
    );
  }, [routes]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleVehicleCountChange(value: string) {
    setVehicleCount(value);
    // Não altera as rotas se ainda não houve processamento de imagem
  }

  function handleFile(file: File) {
    if (!file.type.match("image/png") && !file.type.match("image/jpeg")) {
      alert("Envie apenas imagem JPG ou PNG.");
      return;
    }

    setFileName(file.name);
    setMimeType(file.type);
    setAiResult("");
    setRoutes(buildInitialRoutes(Number(vehicleCount)));

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      setPreviewImage(result);
    };

    reader.readAsDataURL(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    handleFile(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
          break;
        }
      }
    }
  }

  function extractRegionFromBlock(block: string, vehicleNumber: number) {
    const firstLine = block.split("\n")[0]?.trim();

    if (!firstLine) {
      return `Região ${vehicleNumber}`;
    }

    return firstLine.replace("[", "").replace("]", "").replace(":", "").trim();
  }

  /**
   * PASSO 1 — Limpeza bruta: remove lixo comercial e complementos antes de normalizar.
   */
  function sanitizeRawAddress(raw: string): string {
    return raw
      // Remove tudo após "|": nomes comerciais (ex: "Aroma da Carne | Atacadista")
      .replace(/\|.*$/g, "")
      // Remove conteúdo entre parênteses: (Ceasa), (Centro), (Loja 2)
      .replace(/\([^)]*\)/g, "")
      // Remove complementos e tudo que vem depois deles na mesma parte:
      // COND, CONDOMINIO, LOJA, TERREO, TÉRREO, BLOCO, ANDAR, APTO, APT, SALA, CASA, LOTE, GALPAO, MODULO, DEPOSITO
      .replace(/\b(COND(OMINIO)?|LOJA|LJ|TERREO|TÉ?RREO|BLOCO|BL|ANDAR|AND|AP(TO)?|SALA|SL|CASA|LOTE|GALPAO|MODULO|DEPOSITO|DEP)\b[^,]*/gi, "")
      // Remove asteriscos e hífens isolados
      .replace(/\*|(?<=\s)-(?=\s)/g, "")
      // Limpa múltiplas vírgulas geradas pelas remoções
      .replace(/,\s*,+/g, ",")
      // Remove vírgula no início
      .replace(/^[\s,]+/, "")
      // Remove vírgula no final
      .replace(/[,\s]+$/, "")
      .trim();
  }

  /**
   * PASSO 2 — Normalização: padroniza abreviações, acentuação e estado.
   */
  function normalizeAddressForMaps(address: string): string {
    // Lista de siglas de estado brasileiras reconhecidas
    const STATE_CODES = "AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO";
    const stateRegex = new RegExp(`\\b(${STATE_CODES})\\b(?![,\\s]*Brasil)`, "gi");

    return sanitizeRawAddress(address)
      // Normaliza espaços extras
      .replace(/\s+/g, " ")
      // Garante vírgula consistente
      .replace(/,\s*/g, ", ")
      // Rodovias: BR 101 → BR-101, BR 376 → BR-376, etc.
      .replace(/\bBR[- ]?(\d{2,3})\b/gi, "BR-$1")
      // Abreviações de logradouro
      .replace(/\bAV\.?\s+/gi, "Av. ")
      .replace(/\bROD\.?\s+/gi, "Rodovia ")
      .replace(/(?<![A-Za-zÀ-ÖØ-öø-ÿ])R\.\s+/g, "Rua ") // R. no início ou após espaço
      // Cidades e bairros com acentuação
      .replace(/\bTRAMANDAI\b/gi, "Tramandaí")
      .replace(/\bXANGRI-?LA\b/gi, "Xangri-lá")
      .replace(/\bCAPAO DA CANOA\b/gi, "Capão da Canoa")
      .replace(/\bARROIO DO SAL\b/gi, "Arroio do Sal")
      .replace(/\bSAO JOSE\b/gi, "São José")
      .replace(/\bSAO JOAO\b/gi, "São João")
      .replace(/\bSAO PAULO\b/gi, "São Paulo")
      .replace(/\bSAO LEOPOLDO\b/gi, "São Leopoldo")
      .replace(/\bOSORIO\b/gi, "Osório")
      .replace(/\bCRISTOVAO\b/gi, "Cristóvão")
      .replace(/\bPARAGUASSU\b/gi, "Paraguassu")
      .replace(/\bPROTASIO\b/gi, "Protásio")
      .replace(/\bUBIRAJARA\b/gi, "Ubirajara")
      .replace(/\bBEIRA MAR\b/gi, "Beira Mar")
      .replace(/\bCURITIBA\b/gi, "Curitiba")
      .replace(/\bPINHAIS\b/gi, "Pinhais")
      // Sigla de estado sem "Brasil" → adiciona Brasil
      .replace(stateRegex, "$1, Brasil")
      // Limpa vírgula final e espaços
      .replace(/[,\s]+$/, "")
      .trim();
  }

  // Siglas de estado para detecção
  const STATE_PATTERN = /^(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)$/i;

  function inferDistrictAndCity(normalizedAddress: string) {
    const parts = normalizedAddress
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    // Localiza o estado e Brasil
    const stateIndex = parts.findIndex((p) => STATE_PATTERN.test(p));
    const brasilIndex = parts.findIndex((part) => /^Brasil$/i.test(part));

    if (stateIndex >= 2) {
      return {
        district: parts[stateIndex - 2] || "---",
        city: parts[stateIndex - 1] || "---",
      };
    }

    if (brasilIndex >= 3) {
      return {
        district: parts[brasilIndex - 3] || "---",
        city: parts[brasilIndex - 2] || "---",
      };
    }

    if (parts.length >= 4) {
      return {
        district: parts[parts.length - 3] || "---",
        city: parts[parts.length - 2] || "---",
      };
    }

    return { district: "---", city: "---" };
  }

  /**
   * PASSO 3 — Constrói o endereço final limpo para o Google Maps:
   * Formato: "Logradouro, Número, Cidade, UF, Brasil"
   * Garante encodeURIComponent no chamador (buildGoogleMapsUrls).
   */
  function buildMapSafeAddress(normalizedAddress: string): string {
    const parts = normalizedAddress
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    // Localiza o estado (sigla de 2 letras)
    const stateIndex = parts.findIndex((p) => STATE_PATTERN.test(p));

    if (stateIndex >= 2) {
      // Formato padrão: Rua, Número, [Bairro,] Cidade, UF, Brasil
      const street = parts[0];
      const number  = parts[1];
      const state   = parts[stateIndex];
      const city    = parts[stateIndex - 1];
      // Monta limpamente e re-encoda separadores
      const clean = `${street}, ${number}, ${city}, ${state}, Brasil`;
      return clean;
    }

    // Fallback: se não encontrou estado mas tem pelo menos 3 partes
    if (parts.length >= 3) {
      // Retorna o endereço normalizado como está + Brasil se não constar
      return normalizedAddress.toLowerCase().includes("brasil")
        ? normalizedAddress
        : `${normalizedAddress}, Brasil`;
    }

    return normalizedAddress;
  }

  function extractStopsFromBlock(block: string): RouteStop[] {
    const lines = block.split("\n");

    return lines
      .map((line) => line.trim())
      .filter((line) => /^\d+\./.test(line))
      .map((line) => {
        const sequenceMatch = line.match(/^(\d+)\.\s+(.*)$/);
        const sequence = Number(sequenceMatch?.[1] || 0);
        const content = sequenceMatch?.[2] || line;

        const [customerRaw, ...addressParts] = content.split(" - ");
        const rawAddress = addressParts.join(" - ").trim();

        const customerMatch = customerRaw.trim().match(/^(\d{3,})\s+(.+)$/);

        const orderCode = customerMatch?.[1] || "---";
        const customer = customerMatch?.[2] || customerRaw.trim();

        const normalizedAddress = normalizeAddressForMaps(rawAddress);
        const mapAddress = buildMapSafeAddress(normalizedAddress);
        const location = inferDistrictAndCity(normalizedAddress);

        return {
          sequence,
          orderCode,
          customer,
          rawAddress,
          normalizedAddress,
          mapAddress,
          city: location.city,
          district: location.district,
        };
      })
      .filter((stop) => stop.normalizedAddress.length > 0);
  }

  function buildGoogleMapsUrls(originAddress: string, stops: RouteStop[]) {
    if (stops.length === 0) {
      return [];
    }

    const addresses = stops.map((stop) => stop.mapAddress);

    const maxStopsPerMap = 10;
    const chunks: string[][] = [];

    for (let i = 0; i < addresses.length; i += maxStopsPerMap) {
      chunks.push(addresses.slice(i, i + maxStopsPerMap));
    }

    return chunks.map((chunk, index) => {
      const segmentOrigin =
        index === 0 ? originAddress : addresses[index * maxStopsPerMap - 1];

      const destination = chunk[chunk.length - 1];
      const waypoints = chunk.slice(0, -1);

      let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        segmentOrigin
      )}&destination=${encodeURIComponent(destination)}`;

      if (waypoints.length > 0) {
        url += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
      }

      const start = index * maxStopsPerMap + 1;
      const end = index * maxStopsPerMap + chunk.length;

      return {
        label: `Maps ${index + 1} (${start}-${end})`,
        url,
      };
    });
  }

  function openSelectedVehicleMap() {
    if (!selectedVehicle) return;
    const route = routes.find((r) => r.vehicle === selectedVehicle);
    const firstMap = route?.mapUrls?.[0];

    if (!firstMap?.url) {
      alert("Nenhuma rota com link do Google Maps foi gerada para este veículo.");
      return;
    }

    window.open(firstMap.url, "_blank", "noopener,noreferrer");
  }

  function printOE() {
    if (allStops.length === 0) {
      alert("Nenhuma Ordem de Embarque gerada para imprimir.");
      return;
    }

    // Filtra pedidos: se há veículo selecionado, imprime apenas ele; senão, imprime todos
    const stopsToPrint = selectedVehicle
      ? allStops.filter((s) => s.vehicle === selectedVehicle)
      : allStops;

    const vehicleLabel = selectedVehicle ?? "Todos os Veículos";
    const dataAtual = new Date().toLocaleDateString("pt-BR");
    const horaAtual = new Date().toLocaleTimeString("pt-BR");

    // Gera as linhas da tabela por veículo agrupado
    const vehicleGroups = selectedVehicle
      ? [{ vehicle: selectedVehicle, stops: stopsToPrint }]
      : routes
          .filter((r) => r.stops.length > 0)
          .map((r) => ({ vehicle: r.vehicle, stops: r.stops.map((s) => ({ ...s, vehicle: r.vehicle, region: r.region })) }));

    const tableRows = vehicleGroups
      .map((group) => {
        const routeInfo = routes.find((r) => r.vehicle === group.vehicle);
        const headerRow = `
          <tr class="group-header">
            <td colspan="6">
              🚛 ${group.vehicle} — ${routeInfo?.region ?? ""} &nbsp;|&nbsp; ${group.stops.length} parada(s)
            </td>
          </tr>`;
        const stopRows = group.stops
          .map(
            (stop) => `
          <tr>
            <td class="center">${stop.sequence}</td>
            <td class="center">${stop.orderCode}</td>
            <td>${stop.customer}</td>
            <td>${stop.city}</td>
            <td>${stop.district}</td>
            <td>${stop.normalizedAddress}</td>
          </tr>`
          )
          .join("");
        return headerRow + stopRows;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ordem de Embarque — ROUTEXO</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      padding: 16px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header p { font-size: 11px; color: #333; margin-top: 2px; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
      border: 1px solid #ccc;
      padding: 8px;
      background: #f9f9f9;
    }
    .meta-item label { font-weight: bold; font-size: 10px; color: #555; display: block; }
    .meta-item span { font-size: 12px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead th {
      background: #0b78b6;
      color: #fff;
      padding: 5px 6px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
    }
    tbody tr:nth-child(even) { background: #f5f5f5; }
    tbody td {
      padding: 4px 6px;
      border-bottom: 1px solid #ddd;
      vertical-align: top;
    }
    .center { text-align: center; }
    .group-header td {
      background: #FFFDE7 !important;
      font-weight: bold;
      font-size: 11px;
      padding: 6px 8px;
      border-top: 2px solid #F9A825;
      border-bottom: 1px solid #F9A825;
      color: #5D4037;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .assinatura {
      border-top: 1px solid #000;
      margin-top: 32px;
      padding-top: 4px;
      font-size: 10px;
      text-align: center;
    }
    .total-bar {
      background: #0b78b6;
      color: #fff;
      padding: 6px 10px;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 12px;
    }
    @media print {
      body { padding: 8px; }
      .no-print { display: none !important; }
      thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .group-header td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .total-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Ordem de Embarque — ROUTEXO</h1>
    <p>Sistema de Roteirização Inteligente &nbsp;|&nbsp; Módulo Logístico</p>
  </div>

  <div class="meta">
    <div class="meta-item">
      <label>Data de Emissão</label>
      <span>${dataAtual} às ${horaAtual}</span>
    </div>
    <div class="meta-item">
      <label>Veículo(s)</label>
      <span>${vehicleLabel}</span>
    </div>
    <div class="meta-item">
      <label>Total de Paradas</label>
      <span>${stopsToPrint.length} entrega(s)</span>
    </div>
    <div class="meta-item">
      <label>Ponto de Partida</label>
      <span>${origin}</span>
    </div>
    <div class="meta-item">
      <label>Arquivo de Origem</label>
      <span>${fileName || "—"}</span>
    </div>
    <div class="meta-item">
      <label>Status</label>
      <span>Gerado</span>
    </div>
  </div>

  <div class="total-bar">
    CLIENTES / PEDIDOS IDENTIFICADOS — ${stopsToPrint.length} parada(s)
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">Seq.</th>
        <th style="width:80px">Pedido</th>
        <th>Cliente</th>
        <th style="width:110px">Cidade</th>
        <th style="width:110px">Bairro</th>
        <th>Endereço</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="assinatura">Motorista / Assinatura</div>
    </div>
    <div>
      <div class="assinatura">Responsável / Visto</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      alert("Permita pop-ups para este site para usar a impressão. Verifique a barra de endereços do navegador.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function saveHistory() {
    if (!aiResult || allStops.length === 0) {
      alert("Nenhuma rota gerada para salvar.");
      return;
    }

    const historyItem: SavedRouteHistory = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      origin,
      vehicleCount,
      fileName,
      totalStops: allStops.length,
      routes,
      aiResult,
    };

    const currentHistoryRaw = localStorage.getItem("route-history");

    const currentHistory: SavedRouteHistory[] = currentHistoryRaw
      ? JSON.parse(currentHistoryRaw)
      : [];

    const updatedHistory = [historyItem, ...currentHistory].slice(0, 20);

    localStorage.setItem("route-history", JSON.stringify(updatedHistory));

    alert("Roteirização salva no histórico local.");
  }

  function resetApp() {
    setPreviewImage(null);
    setFileName("");
    setMimeType("");
    setAiResult("");
    setRoutes(buildInitialRoutes(Number(vehicleCount)));
    setSelectedVehicle(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function processReport() {
    if (!previewImage) {
      alert("Selecione uma imagem antes de processar.");
      return;
    }

    if (!mimeType) {
      alert("Tipo da imagem não identificado.");
      return;
    }

    setLoading(true);
    setAiResult("");
    setRoutes(buildInitialRoutes(Number(vehicleCount)));

    try {
      const response = await fetch("/api/route-planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: previewImage,
          mimeType,
          origin,
          vehicleCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao processar relatório.");
      }

      const resultText = data.result as string;
      setAiResult(resultText);

      const count = Number(vehicleCount);

      const generatedRoutes = Array.from({ length: count }, (_, index) => {
        const vehicleNumber = index + 1;

        const regex = new RegExp(
          `VEÍCULO ${vehicleNumber}:\\s*(.*?)(?=VEÍCULO ${
            vehicleNumber + 1
          }:|$)`,
          "is"
        );

        const match = resultText.match(regex);
        const block = match?.[1]?.trim() || "";

        const stops = extractStopsFromBlock(block);
        const mapUrls = buildGoogleMapsUrls(origin, stops);

        return {
          vehicle: `Veículo ${vehicleNumber}`,
          region: extractRegionFromBlock(block, vehicleNumber),
          status: block
            ? stops.length > 0
              ? `${stops.length} parada(s). ${mapUrls.length} link(s) Maps.`
              : "Rota gerada, mas nenhum endereço foi extraído."
            : "A IA não retornou dados claros para este veículo.",
          stops,
          mapUrls,
        };
      });

      setRoutes(generatedRoutes);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao processar relatório.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--erp-bg)] p-4 text-[var(--erp-text)]">
      <div className="erp-window mx-auto flex min-h-[calc(100vh-32px)] max-w-[1600px] flex-col">
        <div className="erp-titlebar flex items-center gap-2">
          <img src="/logo.png" alt="ROUTEXO" style={{ height: 28, width: 28, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          ROUTEXO ROTEIRIZAÇÃO - SISTEMA DE ROTEIRIZAÇÃO INTELIGENTE
        </div>

        <div className="grid grid-cols-3 border-b border-[var(--erp-border-dark)]">
          <div className="erp-titlebar border-r border-[var(--erp-border-dark)]">
            PEDIDOS
          </div>

          <div className="erp-titlebar border-r border-[var(--erp-border-dark)]">
            PEDIDOS DA ORDEM DE EMBARQUE
          </div>

          <div className="erp-titlebar">ORDENS</div>
        </div>

        <div className="erp-toolbar">
          <button
            className="erp-button-primary"
            onClick={processReport}
            disabled={loading}
          >
            {loading ? "Processando IA..." : "Processar Relatório"}
          </button>

          <button className="erp-button" onClick={openFilePicker}>
            Selecionar Imagem
          </button>

          <button className="erp-button" onClick={resetApp}>
            Limpar
          </button>

          <span className="erp-chip erp-chip-green ml-auto">IA Online</span>
          <span className="erp-chip erp-chip-blue">Módulo: Roteirização</span>
          <button
            className="erp-button"
            style={{
              background: "#c62828",
              color: "white",
              borderColor: "#b71c1c",
              fontWeight: "bold",
              cursor: "pointer",
              marginLeft: "6px"
            }}
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>

        <div className="grid flex-1 grid-cols-12 gap-2 p-2">
          <section className="erp-panel col-span-12 flex flex-col xl:col-span-7">
            <div className="erp-subtitlebar">PEDIDOS / RELATÓRIO 61</div>

            <div className="erp-panel-body">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 md:col-span-4">
                  <label className="erp-field-label">Região:</label>
                  <input
                    className="erp-input"
                    value="Roteirização Automática"
                    readOnly
                  />
                </div>

                <div className="col-span-12 md:col-span-5">
                  <label className="erp-field-label">Ponto de Partida:</label>
                  <select
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                    className="erp-select"
                  >
                    <option>Sua Cidade, UF - Endereço de Partida</option>
                    <option>Outra Cidade, UF - Endereço Alternativo</option>
                    <option>Outro endereço personalizado</option>
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <label className="erp-field-label">Nº Veículos:</label>
                  <select
                    value={vehicleCount}
                    onChange={(event) =>
                      handleVehicleCountChange(event.target.value)
                    }
                    className="erp-select"
                  >
                    <option value="1">1 veículo</option>
                    <option value="2">2 veículos</option>
                    <option value="3">3 veículos</option>
                    <option value="4">4 veículos</option>
                    <option value="5">5 veículos</option>
                  </select>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-12 gap-2">
                <label className="col-span-12 flex items-center gap-1 md:col-span-4">
                  <input type="checkbox" defaultChecked />
                  <span>Mostrar pedidos para roteirização</span>
                </label>

                <label className="col-span-12 flex items-center gap-1 md:col-span-4">
                  <input type="checkbox" defaultChecked />
                  <span>Agrupar por cidade/bairro</span>
                </label>

                <label className="col-span-12 flex items-center gap-1 md:col-span-4">
                  <input type="checkbox" />
                  <span>Priorizar menor deslocamento</span>
                </label>
              </div>
            </div>

            <div className="erp-panel-body border-t border-[var(--erp-border)]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onPaste={handlePaste}
                tabIndex={0}
                className="min-h-[230px] border border-dashed border-[var(--erp-border-dark)] bg-white p-2 outline-none focus:border-[var(--erp-blue)]"
              >
                {previewImage ? (
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-4">
                      <img
                        src={previewImage}
                        alt="Prévia do relatório"
                        className="h-[210px] w-full border border-[var(--erp-border)] object-cover"
                      />
                    </div>

                    <div className="col-span-12 md:col-span-8">
                      <table className="erp-table">
                        <tbody>
                          <tr>
                            <th>Arquivo</th>
                            <td>{fileName}</td>
                          </tr>
                          <tr>
                            <th>Origem</th>
                            <td>{origin}</td>
                          </tr>
                          <tr>
                            <th>Veículos</th>
                            <td>{vehicleCount}</td>
                          </tr>
                          <tr>
                            <th>Status</th>
                            <td>
                              {loading
                                ? "Processando imagem com IA..."
                                : aiResult
                                  ? "Relatório processado"
                                  : "Relatório carregado"}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="mt-2 flex gap-1">
                        <button className="erp-button" onClick={openFilePicker}>
                          Trocar Imagem
                        </button>

                        <button
                          className="erp-button-primary"
                          onClick={processReport}
                          disabled={loading}
                        >
                          {loading ? "Aguarde..." : "Gerar Rotas"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[210px] flex-col items-center justify-center text-center">
                    <div className="mb-2 text-3xl text-[var(--erp-blue)]">
                      ↑
                    </div>

                    <p className="font-bold">
                      Arraste, selecione ou cole a imagem do relatório
                    </p>

                    <p className="erp-muted mt-1">
                      Suporta JPG e PNG. Use o relatório 61 / lista de clientes.
                    </p>

                    <p className="erp-muted mt-1 text-xs">
                      💡 Dica: clique aqui e pressione{" "}
                      <kbd style={{ background: "#e8e8e8", border: "1px solid #ccc", borderRadius: 3, padding: "1px 5px", fontFamily: "monospace", fontSize: 11 }}>Ctrl+V</kbd>{" "}
                      para colar um print diretamente
                    </p>

                    <button
                      className="erp-button-primary mt-3"
                      onClick={openFilePicker}
                    >
                      Selecionar Arquivo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="erp-panel-body flex-1 border-t border-[var(--erp-border)]">
              <div className="mb-1 flex items-center justify-between">
                <strong>Clientes / Pedidos Identificados</strong>
                <span className="erp-muted">
                  {allStops.length > 0
                    ? `${allStops.length} parada(s) extraída(s)`
                    : "Fonte: imagem enviada + interpretação IA"}
                </span>
              </div>

              <div className="erp-scroll max-h-[300px]">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Veículo</th>
                      <th>Seq.</th>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Cidade</th>
                      <th>Bairro</th>
                      <th>Endereço normalizado</th>
                      <th>Endereço Maps</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allStops.length > 0 ? (
                      allStops.map((stop) => {
                        const isHighlighted = selectedVehicle !== null && stop.vehicle === selectedVehicle;
                        return (
                          <tr
                            key={`${stop.vehicle}-${stop.sequence}-${stop.customer}`}
                            style={isHighlighted ? { background: "#FFFDE7", fontWeight: 600 } : {}}
                          >
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: isHighlighted ? "#F9A825" : "transparent",
                                  marginRight: 4,
                                  verticalAlign: "middle",
                                }}
                              />
                              {stop.vehicle}
                            </td>
                            <td>{stop.sequence}</td>
                            <td>{stop.orderCode}</td>
                            <td>{stop.customer}</td>
                            <td>{stop.city}</td>
                            <td>{stop.district}</td>
                            <td>{stop.normalizedAddress}</td>
                            <td>{stop.mapAddress}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td>---</td>
                        <td>---</td>
                        <td>---</td>
                        <td>Aguardando leitura da IA</td>
                        <td>---</td>
                        <td>---</td>
                        <td>---</td>
                        <td>---</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="erp-panel col-span-12 flex flex-col xl:col-span-3">
            <div className="erp-subtitlebar">
              PEDIDOS DA ORDEM DE EMBARQUE
            </div>

            <div className="erp-panel-body">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="erp-field-label">Data:</label>
                  <input
                    className="erp-input"
                    value={new Date().toLocaleDateString("pt-BR")}
                    readOnly
                  />
                </div>

                <div>
                  <label className="erp-field-label">Status:</label>
                  <input
                    className="erp-input"
                    value={
                      loading ? "Processando" : aiResult ? "Gerado" : "Aberto"
                    }
                    readOnly
                  />
                </div>
              </div>

              <div className="erp-scroll max-h-[360px]">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>SEL</th>
                      <th>VEÍCULO</th>
                      <th>REGIÃO</th>
                      <th>STATUS</th>
                      <th>MAPS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {routes.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "12px", color: "#888" }}>
                          Nenhum pedido. Envie uma imagem para processar.
                        </td>
                      </tr>
                    ) : (
                      routes.map((route) => {
                        const isSelected = selectedVehicle === route.vehicle;
                        return (
                          <tr
                            key={route.vehicle}
                            onClick={() => setSelectedVehicle(isSelected ? null : route.vehicle)}
                            style={{
                              cursor: "pointer",
                              background: isSelected ? "#FFFDE7" : undefined,
                              outline: isSelected ? "2px solid #F9A825" : undefined,
                              fontWeight: isSelected ? 700 : undefined,
                            }}
                            title={isSelected ? "Clique para desselecionar" : "Clique para selecionar este veículo"}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => setSelectedVehicle(isSelected ? null : route.vehicle)}
                              />
                            </td>
                            <td style={{ color: isSelected ? "#E65100" : undefined }}>
                              {isSelected ? "▶ " : ""}{route.vehicle}
                            </td>
                            <td>{route.region}</td>
                            <td>{route.status}</td>
                            <td>
                              {route.mapUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {route.mapUrls.map((map) => (
                                    <a
                                      key={map.label}
                                      href={map.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="erp-button-primary inline-block text-center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {map.label}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="erp-muted">---</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="erp-panel-body border-t border-[var(--erp-border)]">
              <strong>Plano completo da IA</strong>

              <div className="erp-scroll mt-1 h-[260px] border border-[var(--erp-border)] bg-white p-2 font-mono text-[11px] leading-5">
                {aiResult ? (
                  <pre className="whitespace-pre-wrap">{aiResult}</pre>
                ) : (
                  <p className="erp-muted">
                    O plano completo aparecerá aqui após o processamento.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="erp-panel col-span-12 flex flex-col xl:col-span-2">
            <div className="erp-subtitlebar">ORDENS</div>

            <div className="erp-panel-body">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>ORDEM</th>
                    <th>VEÍC.</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {routes.map((route, index) => (
                    <tr key={route.vehicle}>
                      <td>{String(index + 1).padStart(5, "0")}</td>
                      <td>{route.vehicle.replace("Veículo ", "")}</td>
                      <td>
                        {route.mapUrls.length > 0
                          ? `${route.mapUrls.length} Maps`
                          : aiResult
                            ? "IA"
                            : "Pendente"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-2 grid gap-1">
                <button
                  className="erp-button-primary"
                  onClick={processReport}
                  disabled={loading}
                >
                  Gerar Ordem
                </button>

                <button
                  className="erp-button"
                  onClick={openSelectedVehicleMap}
                  disabled={!selectedVehicle || !routes.find((r) => r.vehicle === selectedVehicle)?.mapUrls.length}
                  title={!selectedVehicle ? "Selecione um veículo na tabela acima" : "Abrir rota no Google Maps"}
                  style={{
                    opacity: (!selectedVehicle || !routes.find((r) => r.vehicle === selectedVehicle)?.mapUrls.length) ? 0.45 : 1,
                    cursor: (!selectedVehicle || !routes.find((r) => r.vehicle === selectedVehicle)?.mapUrls.length) ? "not-allowed" : "pointer",
                  }}
                >
                  {selectedVehicle ? `📍 Maps — ${selectedVehicle}` : "Abrir Maps"}
                </button>

                <button className="erp-button" onClick={printOE}>
                  🖨️ Imprimir OE
                </button>

                <button className="erp-button" onClick={saveHistory}>
                  Salvar Histórico
                </button>

                <button className="erp-button-danger" onClick={resetApp}>
                  Cancelar
                </button>
              </div>
            </div>

            <div className="erp-panel-body mt-auto border-t border-[var(--erp-border)]">
              <div className="mb-1 font-bold">Resumo Operacional</div>

              <table className="erp-table">
                <tbody>
                  <tr>
                    <th>Pedidos</th>
                    <td>{allStops.length}</td>
                  </tr>
                  <tr>
                    <th>Veículos</th>
                    <td>{vehicleCount}</td>
                  </tr>
                  <tr>
                    <th>Links Maps</th>
                    <td>
                      {routes.reduce(
                        (total, route) => total + route.mapUrls.length,
                        0
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>IA</th>
                    <td>{loading ? "Em execução" : "Online"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="erp-statusbar">
          <span>Comercial 1.0.13</span>

          <span>
            Veículos: <strong>{vehicleCount}</strong>
          </span>

          <span>
            Pedidos: <strong>{allStops.length}</strong>
          </span>

          <span>
            Arquivo: <strong>{fileName || "nenhum"}</strong>
          </span>

          <span>
            Status:{" "}
            <strong>
              {loading
                ? "Processando IA"
                : aiResult
                  ? "Rotas geradas"
                  : previewImage
                    ? "Relatório carregado"
                    : "Aguardando relatório"}
            </strong>
          </span>
        </div>
      </div>
    </main>
  );
}


/** <!-- Desenvolvido por Guilherme Olsen ® --> */
