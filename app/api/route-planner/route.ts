import { NextRequest, NextResponse } from "next/server";

type RoutePlannerBody = {
  imageBase64: string;
  mimeType: string;
  origin: string;
  vehicleCount: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RoutePlannerBody;

    const { imageBase64, mimeType, origin, vehicleCount } = body;

    if (!imageBase64 || !mimeType || !origin || !vehicleCount) {
      return NextResponse.json(
        {
          error: "Dados incompletos. Envie imageBase64, mimeType, origin e vehicleCount.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Serviço de IA não configurado. Contate o administrador.",
        },
        { status: 500 }
      );
    }

    let vehicleOutputFormat = "";

    for (let i = 1; i <= Number(vehicleCount); i++) {
  vehicleOutputFormat += `
VEÍCULO ${i}: [Nome da Região]
* Ponto de Partida: [Endereço da Origem]
* Sequência:
1. [Cliente] - [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil
2. [Cliente] - [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil
* Justificativa: [Explique a lógica da divisão regional]
`;
}

    /** <!-- Desenvolvido por Guilherme Olsen ® --> */
    const prompt = `
Você é um especialista em logística e roteirização de frotas urbanas.

Sua tarefa é otimizar a divisão e o percurso de entregas para \${vehicleCount} veículo(s), maximizando eficiência de tempo, combustível e organização regional.

CONTEXTO DE PARTIDA:
Todos os veículos iniciarão a rota simultaneamente a partir deste ponto:
\${origin}

DADOS RECEBIDOS:
Estou enviando uma imagem contendo uma lista de clientes e endereços.
Analise a imagem, extraia nomes, cidades, bairros e endereços.

REGRAS DE ROTEIRIZAÇÃO:
1. Divida os clientes entre os veículos por proximidade geográfica.
2. Evite zigue-zague entre bairros/cidades.
3. Agrupe entregas por região.
4. Ordene os pontos em uma sequência lógica de deslocamento.
5. Priorize vias principais quando fizer sentido.
6. Não invente clientes.
7. Se algum endereço estiver ilegível, sinalize como "endereço ilegível".
8. Retorne apenas a estrutura solicitada, sem texto introdutório.
9. No fim da roteirização coloque a média de KM rodado de cada rota gerada e horas estimadas.

NORMALIZAÇÃO OBRIGATÓRIA DE ENDEREÇOS (CRÍTICO PARA GOOGLE MAPS):
O endereço gerado DEVE funcionar corretamente no Google Maps. Siga TODAS as regras abaixo:

FORMATO OBRIGATÓRIO: [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil
- Sempre inclua rua/avenida, número, bairro, cidade, UF (sigla do estado) e Brasil.
- Nunca omita vírgulas entre rua/avenida, número, bairro, cidade, UF e Brasil.
- UF deve ser sempre a sigla de duas letras correspondente ao estado brasileiro.

LIMPEZA OBRIGATÓRIA — REMOVA SEMPRE:
- Complementos como: COND, CONDOMÍNIO, LOJA, LOJA X, LJ, TÉRREO, TERREO, BLOCO, BL, ANDAR, APTO, APT, SALA, CASA, DEPÓSITO, GALPÃO
- Nomes comerciais após "|" (ex: "Empresa | Atacadista" → remova "| Atacadista")
- Informações entre parênteses: (Ceasa), (Centro), (Loja 3) → remova tudo entre ( )
- Referências como "em frente ao", "próximo ao", "ao lado de"

RODOVIAS — ATENÇÃO:
- Nunca escreva apenas ", Km X" sem o nome da rodovia antes.
- Correto: Rodovia [Identificação da Rodovia], Km [Número], [Bairro], [Cidade], [UF], Brasil
- Errado: , Km [Número], [Cidade], [UF], Brasil
- Use hífen para a sigla da rodovia (ex: BR-XXX, SP-XXX)

EXEMPLOS DE NORMALIZAÇÃO:
Entrada: AV [NOME DA VIA] [NÚMERO] [CIDADE] [BAIRRO]
Saída: [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil

Entrada: [NÚMERO CONTEXTUAL] AVENIDA [NOME DA VIA] [NÚMERO] [CIDADE] [BAIRRO]
Saída: [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil

Entrada: RUA [NOME DA VIA] [NÚMERO] [CIDADE] [BAIRRO]
Saída: [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil

Entrada: ROD [SIGLA DA RODOVIA] KM [NÚMERO] [CIDADE] [BAIRRO]
Saída: Rodovia [Identificação da Rodovia], Km [Número], [Bairro], [Cidade], [UF], Brasil

Entrada: AV [NOME DA VIA] [NÚMERO] BLOCO [X] LOJA [Y] [CIDADE] [BAIRRO]
Saída: [Rua/Avenida], [Número], [Bairro], [Cidade], [UF], Brasil

Entrada: [SIGLA DA RODOVIA] SN [CIDADE] [CONTEÚDO REMOVÍVEL] [BAIRRO]
Saída: Rodovia [Identificação da Rodovia], S/N, [Bairro], [Cidade], [UF], Brasil

FORMATO OBRIGATÓRIO DA RESPOSTA:
\${vehicleOutputFormat}
`;

    /** <!-- Desenvolvido por Guilherme Olsen ® --> */
    
    const cleanBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
    };

    // Função auxiliar com retry (backoff exponencial) para robustez
    async function callGemini(model: string, retries = 2, delayMs = 1000): Promise<Response> {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let currentDelay = delayMs;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          // Se responder OK ou for erro de cliente (exceto rate limit 429), retorna
          if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
            return res;
          }

          console.warn(`Tentativa ${attempt} com modelo ${model} retornou status ${res.status}. Retentando em ${currentDelay}ms...`);
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= 2;
          } else {
            return res;
          }
        } catch (err) {
          console.error(`Erro de conexão na tentativa ${attempt} com modelo ${model}:`, err);
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= 2;
          } else {
            throw err;
          }
        }
      }
      throw new Error("Falha ao comunicar com a API do Gemini.");
    }

    let response = await callGemini("gemini-2.5-flash", 2, 1000);

    // Se gemini-2.5-flash falhou (ex: 503, ou se for outro erro do servidor), tentamos o modelo estável gemini-1.5-flash
    if (!response.ok) {
      console.warn(`Erro no gemini-2.5-flash (status ${response.status}). Tentando fallback com gemini-1.5-flash...`);
      response = await callGemini("gemini-1.5-flash", 2, 1000);
    }

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "Erro ao chamar Gemini.",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "Não foi possível interpretar a resposta da IA.";

    return NextResponse.json({
      success: true,
      result: aiText,
    });
  } catch (error) {
    console.error("Erro interno em /api/route-planner:", error);

    return NextResponse.json(
      {
        error: "Erro interno no servidor.",
      },
      { status: 500 }
    );
  }
}


/** <!-- Desenvolvido por Guilherme Olsen ® --> */
