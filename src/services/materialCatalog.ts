import { MaterialTargetSurface } from '../types/project';

interface CatalogMaterial {
  brand: string;
  name: string;
  article: string;
  format?: string;
  finish: string;
  surface: MaterialTargetSurface;
  url: string;
}

export const materialCatalog: CatalogMaterial[] = [
  { brand: 'Intercerama / INTER GRES', name: 'AUREA', article: '12060 221 071/L', format: '600 × 1200 mm', finish: 'Polished light-grey marble-look porcelain', surface: 'floor', url: 'https://intercerama.ua/ua/aurea1-size-1019/' },
  { brand: 'Intercerama / INTER GRES', name: 'AUREA', article: '12060 221 031/L', format: '600 × 1200 mm', finish: 'Polished light-brown marble-look porcelain', surface: 'walls', url: 'https://intercerama.ua/ua/aurea2-size-1029/' },
  { brand: 'Intercerama / INTER GRES', name: 'NEGRESCO', article: '12060 223 082/MR', format: '600 × 1200 mm', finish: 'Black porcelain stoneware', surface: 'floor', url: 'https://intercerama.ua/ua/negresco-size-1014/' },
  { brand: 'Intercerama / INTER GRES', name: 'NEGRESCO', article: '12060 223 072/MR', format: '600 × 1200 mm', finish: 'Dark-grey porcelain stoneware', surface: 'floor', url: 'https://intercerama.ua/ua/negresco2-size-1024/' },
  { brand: 'Swisspan', name: 'Oak Ship / Дуб Корабельний', article: '0349', finish: 'Oak woodgrain decor', surface: 'cabinetry', url: 'https://www.swisspan.ua/product/dub-korabelnij-0349/' },
  { brand: 'Swisspan', name: 'Дуб Тахо', article: '0474', finish: 'Oak woodgrain decor', surface: 'cabinetry', url: 'https://www.swisspan.ua/product/dub-taho-0474-2/' },
  { brand: 'Kronospan', name: 'Gold Craft Oak', article: 'K003 PW', finish: 'Pure Wood, golden oak with dark knots', surface: 'cabinetry', url: 'https://kronospan.com/ua_UA/decors/view/kronodesign/K003/' },
  { brand: 'Kronospan', name: 'Gold Craft Oak', article: 'K003 FP', finish: 'Fine Pore, golden oak with dark knots', surface: 'furniture', url: 'https://kronospan.com/ua_UA/decors/view/kronodesign/K003/' },
];
