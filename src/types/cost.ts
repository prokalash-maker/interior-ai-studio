export type Resolution = '1k' | '2k' | '4k';

export interface ResolutionOption {
  id: Resolution;
  labelRu: string;
  labelUk: string;
  labelEn: string;
  dimensions: string;
  megapixels: string;
  tagRu: string;
  tagUk: string;
  tagEn: string;
  isDraft?: boolean;
}

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    id: '1k',
    labelRu: '1K • Быстрый драфт',
    labelUk: '1K • Швидкий чернетковий',
    labelEn: '1K • Quick Draft',
    dimensions: '1024 × 1024',
    megapixels: '~1.0 MP',
    tagRu: 'Экономный тест',
    tagUk: 'Економний тест',
    tagEn: 'Budget Test',
    isDraft: true,
  },
  {
    id: '2k',
    labelRu: '2K • Стандарт HD',
    labelUk: '2K • Стандарт HD',
    labelEn: '2K • Standard HD',
    dimensions: '2048 × 1152',
    megapixels: '~2.4 MP',
    tagRu: 'Оптимально',
    tagUk: 'Оптимально',
    tagEn: 'Recommended',
    isDraft: false,
  },
  {
    id: '4k',
    labelRu: '4K • Ultra ArchViz',
    labelUk: '4K • Ultra ArchViz',
    labelEn: '4K • Ultra ArchViz',
    dimensions: '3840 × 2160',
    megapixels: '~8.3 MP',
    tagRu: 'Финальный буклет',
    tagUk: 'Фінальний буклет',
    tagEn: 'Final Presentation',
    isDraft: false,
  },
];

export interface CostSummary {
  sessionSpend: number;
  sessionGenerations: number;
  totalSpend: number;
  totalGenerations: number;
  budgetLimit: number; // 0 = unlimited
  warnOnExpensive: boolean;
  expensiveThreshold: number; // in USD (default $0.20)
}
