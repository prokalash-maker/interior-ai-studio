import { Resolution, CostSummary } from '../types/cost';

export interface GenerationCostEntry {
  id: string;
  provider: string;
  model: string;
  resolution: Resolution;
  costUsd: number;
  timestamp: number;
}

class CostTrackerService {
  private sessionSpend: number = 0;
  private sessionGenerations: number = 0;
  private totalSpend: number = 0;
  private totalGenerations: number = 0;
  private budgetLimit: number = 5.0; // Default $5.00 session budget
  private warnOnExpensive: boolean = true;
  private expensiveThreshold: number = 0.20; // Warn if >= $0.20 or 4K
  private costHistory: GenerationCostEntry[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const savedTotalSpend = localStorage.getItem('interior_ai_total_spend');
      if (savedTotalSpend) this.totalSpend = parseFloat(savedTotalSpend) || 0;

      const savedTotalCount = localStorage.getItem('interior_ai_total_count');
      if (savedTotalCount) this.totalGenerations = parseInt(savedTotalCount, 10) || 0;

      const savedBudget = localStorage.getItem('interior_ai_budget_limit');
      if (savedBudget !== null) this.budgetLimit = parseFloat(savedBudget) || 5.0;

      const savedWarn = localStorage.getItem('interior_ai_warn_expensive');
      if (savedWarn !== null) this.warnOnExpensive = savedWarn === 'true';

      const savedHistory = localStorage.getItem('interior_ai_cost_history');
      if (savedHistory) this.costHistory = JSON.parse(savedHistory);
    } catch (e) {
      console.error('Failed to load cost tracker state:', e);
    }
  }

  private saveState() {
    try {
      localStorage.setItem('interior_ai_total_spend', this.totalSpend.toFixed(4));
      localStorage.setItem('interior_ai_total_count', this.totalGenerations.toString());
      localStorage.setItem('interior_ai_budget_limit', this.budgetLimit.toString());
      localStorage.setItem('interior_ai_warn_expensive', this.warnOnExpensive.toString());
      localStorage.setItem('interior_ai_cost_history', JSON.stringify(this.costHistory.slice(-100)));
    } catch (e) {
      console.error('Failed to save cost tracker state:', e);
    }
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get exact pricing per image based on provider, model and resolution
   */
  getCostEstimate(providerId: string, model: string, resolution: Resolution): number {
    // 100% Free Cloud & Server Providers
    if (
      providerId === 'pollinations_ai' ||
      providerId === 'ai_horde' ||
      providerId === 'local_sd' ||
      providerId === 'comfyui_local' ||
      providerId === 'huggingface'
    ) {
      return 0.000;
    }

    if (providerId === 'krea_ai') {
      switch (resolution) {
        case '1k':
          return 0.025; // Fast Krea 1K
        case '2k':
          return 0.045; // Standard HD Krea / Flux Architecture
        case '4k':
          return 0.090; // Krea Topaz / Magnific 4K enhance
      }
    }

    // Google Gemini / Imagen Provider
    if (model.includes('gemini-2.5-flash')) {
      switch (resolution) {
        case '1k':
          return 0.030;
        case '2k':
          return 0.035;
        case '4k':
          return 0.060;
      }
    }

    if (model.includes('imagen-3')) {
      switch (resolution) {
        case '1k':
          return 0.040;
        case '2k':
          return 0.050;
        case '4k':
          return 0.080;
      }
    }

    // Default: Google Gemini 3 Pro Image (Nano Banana Pro: gemini-3-pro-image)
    // 1120 tokens (~$0.134 - $0.139 for 1K/2K), ~2520 tokens (~$0.24 for 4K)
    switch (resolution) {
      case '1k':
        return 0.134;
      case '2k':
        return 0.139;
      case '4k':
        return 0.240;
    }
  }

  getSummary(): CostSummary {
    return {
      sessionSpend: this.sessionSpend,
      sessionGenerations: this.sessionGenerations,
      totalSpend: this.totalSpend,
      totalGenerations: this.totalGenerations,
      budgetLimit: this.budgetLimit,
      warnOnExpensive: this.warnOnExpensive,
      expensiveThreshold: this.expensiveThreshold,
    };
  }

  isBudgetExceeded(upcomingCost: number = 0): boolean {
    if (this.budgetLimit <= 0) return false; // 0 = unlimited
    return (this.sessionSpend + upcomingCost) > this.budgetLimit;
  }

  shouldWarnBeforeRequest(cost: number, resolution: Resolution): boolean {
    if (!this.warnOnExpensive) return false;
    return resolution === '4k' || cost >= this.expensiveThreshold;
  }

  setBudgetLimit(limit: number) {
    this.budgetLimit = Math.max(0, limit);
    this.saveState();
    this.notify();
  }

  setWarnOnExpensive(warn: boolean) {
    this.warnOnExpensive = warn;
    this.saveState();
    this.notify();
  }

  recordGeneration(provider: string, model: string, resolution: Resolution, costUsd: number) {
    this.sessionSpend += costUsd;
    this.sessionGenerations += 1;
    this.totalSpend += costUsd;
    this.totalGenerations += 1;

    const entry: GenerationCostEntry = {
      id: 'cost_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      provider,
      model,
      resolution,
      costUsd,
      timestamp: Date.now(),
    };

    this.costHistory.push(entry);
    this.saveState();
    this.notify();
  }

  resetSession() {
    this.sessionSpend = 0;
    this.sessionGenerations = 0;
    this.notify();
  }

  getHistory(): GenerationCostEntry[] {
    return [...this.costHistory].sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const costTracker = new CostTrackerService();
