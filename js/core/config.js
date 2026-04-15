/**
 * Config Module - Configurações das loterias e regras do jogo
 * @module core/config
 */

/**
 * ============================================================
 * CONFIGURAÇÃO DE AUTENTICAÇÃO
 * ============================================================
 * Defina como false para desativar o sistema de login
 * e acessar todas as páginas sem autenticação.
 * Mude para true quando quiser reativar o login.
 */
export const AUTH_REQUIRED = true;

/**
 * ============================================================
 * CONFIGURAÇÃO DE HORÁRIO DE CORTE
 * ============================================================
 * Horário limite para apostas do dia (antes do sorteio das 21:00)
 * Apostas após este horário serão registradas para o próximo concurso
 */
export const CUTOFF_HOUR = 20;
export const CUTOFF_MINUTE = 50;
export const DRAW_HOUR = 21;
export const DRAW_MINUTE = 0;

/**
 * Configurações das loterias disponíveis
 */
export const lotteries = {
    megasena: {
        name: 'Mega Sena',
        color: '#209869',
        maxNumber: 60,
        minNumbers: 6,
        maxNumbers: 15,
        basePrice: 6.00,
        prices: {
            6: 6.00,
            7: 42.00,
            8: 168.00,
            9: 504.00,
            10: 1260.00,
            11: 2772.00,
            12: 5544.00,
            13: 10296.00,
            14: 18018.00,
            15: 30030.00
        },
        logo: 'assets/megasena.png'
    },
    lotofacil: {
        name: 'LotoFácil',
        color: '#930089',
        maxNumber: 25,
        minNumbers: 15,
        maxNumbers: 20,
        basePrice: 3.50,
        prices: {
            15: 3.50,
            16: 56.00,
            17: 476.00,
            18: 2856.00,
            19: 13566.00,
            20: 54264.00
        },
        logo: 'assets/lotofacil.png'
    },
    quina: {
        name: 'Quina',
        color: '#260085',
        maxNumber: 80,
        minNumbers: 5,
        maxNumbers: 15,
        basePrice: 3.00,
        prices: {
            5: 3.00,
            6: 18.00,
            7: 63.00,
            8: 168.00,
            9: 378.00,
            10: 756.00,
            11: 1386.00,
            12: 2376.00,
            13: 3861.00,
            14: 6006.00,
            15: 9009.00
        },
        logo: 'assets/quina.png'
    }
};

/**
 * Descrições dos modos de geração de números
 */
export const modeDescriptions = {
    manual: { 
        icon: 'hand', 
        label: 'Manual', 
        text: 'Selecione seus números da sorte' 
    },
    ai: { 
        icon: 'sparkles', 
        label: 'IA Expert', 
        text: '' 
    }
};

/**
 * Regras de premiação por loteria
 * Define quantos acertos são necessários para ganhar em cada faixa
 */
export const prizeRules = {
    megasena: {
        minHitsToWin: 4,
        prizeRanges: [
            { hits: 6, name: 'Sena', multiplier: 1.0 },
            { hits: 5, name: 'Quina', multiplier: 0.001 },
            { hits: 4, name: 'Quadra', multiplier: 0.0001 }
        ]
    },
    lotofacil: {
        minHitsToWin: 11,
        prizeRanges: [
            { hits: 15, name: '15 acertos', multiplier: 1.0 },
            { hits: 14, name: '14 acertos', multiplier: 0.01 },
            { hits: 13, name: '13 acertos', multiplier: 0.001 },
            { hits: 12, name: '12 acertos', multiplier: 0.0001 },
            { hits: 11, name: '11 acertos', multiplier: 0.00001 }
        ]
    },
    quina: {
        minHitsToWin: 2,
        prizeRanges: [
            { hits: 5, name: 'Quina', multiplier: 1.0 },
            { hits: 4, name: 'Quadra', multiplier: 0.01 },
            { hits: 3, name: 'Terno', multiplier: 0.001 },
            { hits: 2, name: 'Duque', multiplier: 0.0001 }
        ]
    }
};

/**
 * Bolões disponíveis (carregados da API ou fallback padrão)
 */
export const pools = [];

/**
 * Bolão padrão - disponível quando API retorna vazio (igual ao da imagem de referência)
 */
export const DEFAULT_POOL = {
    id: 1,
    name: 'Bolão da Sorte - Mega Sena',
    lottery: 'megasena',
    lottery_name: 'Mega Sena',
    lotteryName: 'Mega Sena',
    total_spots: 50,
    totalSpots: 50,
    filled_spots: 0,
    filledSpots: 0,
    quota_price: 100,
    quotaPrice: 100,
    numbers: [7, 14, 23, 35, 42, 58],
    draw_date: null,
    drawDate: null,
    prize: 55000000,
    status: 'active'
};

export const DEFAULT_POOL_LOTOFACIL = {
    id: 2,
    name: 'BOLÃO LOTOFÁCIL',
    lottery: 'lotofacil',
    lottery_name: 'LotoFácil',
    lotteryName: 'LotoFácil',
    total_spots: 50,
    totalSpots: 50,
    filled_spots: 0,
    filledSpots: 0,
    quota_price: 100,
    quotaPrice: 100,
    numbers: [2, 5, 8, 11, 14, 17, 20, 21, 22, 23, 24, 25, 1, 3, 7],
    draw_date: null,
    drawDate: null,
    prize: 1700000,
    status: 'active'
};

export const DEFAULT_POOL_QUINA = {
    id: 3,
    name: 'BOLÃO QUINA',
    lottery: 'quina',
    lottery_name: 'Quina',
    lotteryName: 'Quina',
    total_spots: 50,
    totalSpots: 50,
    filled_spots: 0,
    filledSpots: 0,
    quota_price: 100,
    quotaPrice: 100,
    numbers: [5, 15, 25, 35, 55],
    draw_date: null,
    drawDate: null,
    prize: 700000,
    status: 'active'
};

/**
 * Valores padrão de prêmios para fallback
 */
export const defaultPrizes = {
    'megasena': 'R$ 3 milhões',
    'lotofacil': 'R$ 1,7 milhão',
    'quina': 'R$ 700.000'
};

/**
 * Mapeamento de tabs para índices do sidebar
 */
export const tabMap = {
    'home': 0,
    'pools': 1,
    'wallet': 2,
    'results': 3,
    'profile': 4
};

/**
 * Jogos curados para apostas rápidas
 * Combinações populares baseadas em estatísticas
 */
export const CURATED_GAMES = {
    lotofacil: [
        { 
            name: 'Mais Sorteados', 
            numbers: [2, 3, 4, 5, 10, 11, 12, 13, 14, 18, 20, 21, 23, 24, 25],
            description: 'Números que mais saíram nos últimos concursos'
        },
        { 
            name: 'Sequência da Sorte', 
            numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            description: 'Sequência numérica clássica'
        },
        { 
            name: 'Pares e Ímpares', 
            numbers: [1, 3, 5, 7, 9, 11, 13, 2, 4, 6, 8, 10, 12, 14, 16],
            description: 'Combinação equilibrada'
        }
    ],
    megasena: [
        { 
            name: 'Mais Sorteados', 
            numbers: [10, 23, 33, 41, 51, 53],
            description: 'Dezenas mais frequentes'
        },
        { 
            name: 'Dezenas Redondas', 
            numbers: [10, 20, 30, 40, 50, 60],
            description: 'Múltiplos de 10'
        },
        { 
            name: 'Sequência Clássica', 
            numbers: [4, 8, 15, 16, 23, 42],
            description: 'Combinação famosa'
        }
    ],
    quina: [
        { 
            name: 'Mais Sorteados', 
            numbers: [4, 24, 31, 48, 52],
            description: 'Dezenas mais frequentes'
        },
        { 
            name: 'Sequência Inicial', 
            numbers: [1, 2, 3, 4, 5],
            description: 'Primeiros números'
        },
        { 
            name: 'Dezenas Altas', 
            numbers: [56, 62, 68, 74, 80],
            description: 'Números maiores'
        }
    ]
};

/**
 * Calcula o valor de uma aposta
 * @param {string} lotteryId - ID da loteria
 * @param {Array|number} numbers - Números selecionados ou quantidade
 * @returns {number} Valor da aposta
 */
export function calculateBetValue(lotteryId, numbers) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return 0;
    
    const count = Array.isArray(numbers) ? numbers.length : Number(numbers) || 0;
    const effectiveCount = Math.max(lottery.minNumbers, count);
    
    if (lottery.prices && lottery.prices[effectiveCount]) {
        return lottery.prices[effectiveCount];
    }
    
    const multiplier = Math.max(1, effectiveCount - lottery.minNumbers + 1);
    return lottery.basePrice * multiplier;
}

/**
 * Gera números aleatórios para uma loteria
 * @param {string} lotteryId - ID da loteria
 * @returns {Array<number>} Array de números gerados
 */
export function generateRandomNumbers(lotteryId) {
    const lottery = lotteries[lotteryId];
    if (!lottery) return [];
    
    const selected = [];
    const available = Array.from({ length: lottery.maxNumber }, (_, i) => i + 1);

    for (let i = 0; i < lottery.minNumbers; i++) {
        const idx = Math.floor(Math.random() * available.length);
        selected.push(available[idx]);
        available.splice(idx, 1);
    }

    return selected.sort((a, b) => a - b);
}

export default { lotteries, modeDescriptions, prizeRules, pools };
