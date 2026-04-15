/**
 * LotoGrana - Módulo de Integração com Resultados de Loterias
 * Consome resultados do nosso banco MySQL (via API PHP)
 * A API externa é usada apenas pelo cron para atualizar o banco.
 * @module utils/api
 */

import { apiGetResults, apiGetContestResult } from '../api-client.js';

export const LoteriasAPI = {
    // Cache em memória
    cache: {},
    cacheExpiry: 5 * 60 * 1000, // 5 minutos
    
    // Mapeamento de IDs do app para IDs da API
    lotteryMap: {
        'megasena': 'megasena',
        'lotofacil': 'lotofacil',
        'quina': 'quina',
        'duplasena': 'duplasena',
        'diadesorte': 'diadesorte',
        'maismilionaria': 'maismilionaria',
        'timemania': 'timemania',
        'lotomania': 'lotomania',
        'supersete': 'supersete',
        'loteca': 'loteca',
        'federal': 'federal'
    },
    
    /**
     * Obtém dados do cache se ainda válidos
     */
    getCached(key) {
        const cached = this.cache[key];
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        return null;
    },
    
    /**
     * Armazena dados no cache
     */
    setCache(key, data) {
        this.cache[key] = {
            data: data,
            timestamp: Date.now()
        };
        
        try {
            const storageKey = `lotograna_api_${key}`;
            localStorage.setItem(storageKey, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[LoteriasAPI] Erro ao salvar no localStorage:', e);
        }
    },
    
    /**
     * Obtém dados do localStorage (fallback offline)
     */
    getFromStorage(key) {
        try {
            const storageKey = `lotograna_api_${key}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.data;
            }
        } catch (e) {
            console.warn('[LoteriasAPI] Erro ao ler do localStorage:', e);
        }
        return null;
    },
    
    /**
     * Transforma dados do nosso banco para o formato usado no app
     * O formato do banco já é bem próximo do que o app espera.
     */
    transformResult(dbData) {
        const numbers = Array.isArray(dbData.numbers) ? dbData.numbers.map(n => parseInt(n, 10)) : [];
        
        return {
            contest: parseInt(dbData.contest, 10),
            date: dbData.date || '',
            numbers: numbers,
            prize: parseFloat(dbData.prize) || 0,
            name: dbData.lottery || dbData.name || '',
            acumulou: !!dbData.acumulou,
            premiacao: (dbData.premiacao || []).map(p => ({
                faixa: p.faixa || 0,
                acertos: p.acertos || p.quantidade_acertos || p.descricao || '-',
                ganhadores: p.ganhadores || p.numero_ganhadores || 0,
                premio: p.premio || p.valor_premio || 0
            })),
            proximoConcurso: {
                data: dbData.next_contest_date || null,
                valorEstimado: parseFloat(dbData.next_contest_prize) || 0,
                valorAcumulado: parseFloat(dbData.next_contest_prize) || 0
            },
            ganhadores: []
        };
    },
    
    /**
     * Busca o último resultado de uma loteria (ou concurso específico)
     */
    async getResult(lotteryId, contest = null) {
        const cacheKey = contest ? `${lotteryId}_${contest}` : `${lotteryId}_latest`;
        
        const cached = this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            let data;
            if (contest) {
                data = await apiGetContestResult(lotteryId, contest);
            } else {
                data = await apiGetResults(lotteryId, 1);
            }
            
            const result = this.transformResult(data);
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            const stored = this.getFromStorage(cacheKey);
            if (stored) {
                console.log(`[LoteriasAPI] Usando dados offline para ${cacheKey}`);
                return stored;
            }
            throw error;
        }
    },
    
    /**
     * Busca os últimos X resultados de uma loteria
     */
    async getLastResults(lotteryId, count = 5) {
        const cacheKey = `${lotteryId}_ultimos${count}`;
        
        const cached = this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            const data = await apiGetResults(lotteryId, count);
            
            let results;
            if (Array.isArray(data)) {
                results = data.map(item => this.transformResult(item));
            } else {
                results = [this.transformResult(data)];
            }
            
            this.setCache(cacheKey, results);
            return results;
        } catch (error) {
            const stored = this.getFromStorage(cacheKey);
            if (stored) {
                console.log(`[LoteriasAPI] Usando dados offline para ${cacheKey}`);
                return stored;
            }
            throw error;
        }
    },
    
    /**
     * Busca o último resultado de todas as loterias
     */
    async getAllLatest() {
        const cacheKey = 'all_latest';
        
        const cached = this.getCached(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            // Nosso endpoint sem parâmetro lottery retorna todas as loterias
            const data = await apiGetResults('', 1);
            const results = {};
            
            if (typeof data === 'object' && !Array.isArray(data)) {
                // Formato: { megasena: {...}, lotofacil: {...}, ... }
                for (const [lotteryKey, resultData] of Object.entries(data)) {
                    results[lotteryKey] = this.transformResult(resultData);
                }
            }
            
            this.setCache(cacheKey, results);
            return results;
        } catch (error) {
            const stored = this.getFromStorage(cacheKey);
            if (stored) {
                console.log('[LoteriasAPI] Usando dados offline para all_latest');
                return stored;
            }
            throw error;
        }
    },
    
    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache = {};
        
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('lotograna_api_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('[LoteriasAPI] Erro ao limpar localStorage:', e);
        }
    },
    
    /**
     * Formata valor monetário (prêmios grandes em formato abreviado)
     * Ex: 1500000 → "R$ 1,5 milhão", 2000000 → "R$ 2 milhões"
     */
    formatCurrency(value) {
        if (!value || value === 0) return 'R$ 0,00';
        
        // Valores >= 1 milhão: formato abreviado
        if (value >= 1000000) {
            const milhoes = value / 1000000;
            // Verifica se é um número inteiro de milhões
            if (milhoes === Math.floor(milhoes)) {
                const label = milhoes === 1 ? 'milhão' : 'milhões';
                return `R$ ${Math.floor(milhoes)} ${label}`;
            } else {
                // Tem casas decimais (ex: 1,5 / 2,7)
                const formatted = milhoes.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const label = milhoes < 2 ? 'milhão' : 'milhões';
                return `R$ ${formatted} ${label}`;
            }
        }
        
        // Valores menores: formato padrão
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    },
    
    /**
     * Formata valor monetário completo
     */
    formatCurrencyFull(value) {
        if (!value || value === 0) return 'R$ 0,00';
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
};

console.log('[LoteriasAPI] Módulo carregado. Consumindo resultados do banco local.');

export default LoteriasAPI;
