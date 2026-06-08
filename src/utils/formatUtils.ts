export function formatCurrency(value: number): string {
  if (!value || value === 0) return '0 ج.م';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} م`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} ك`;
  return `${value.toLocaleString('ar-EG')} ج.م`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function getColorByRate(rate: number) {
  if (rate >= 1)    return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' };
  if (rate >= 0.75) return { text: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',       border: 'border-blue-200'    };
  if (rate >= 0.5)  return { text: 'text-amber-700',   bg: 'bg-amber-50',   bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',     border: 'border-amber-200'   };
  return               { text: 'text-red-700',    bg: 'bg-red-50',    bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',         border: 'border-red-200'     };
}

export function getMotivationMessage(rate: number): string {
  if (rate >= 2)    return 'أداء أسطوري! الفرع بيكسر كل الأرقام! 🏆';
  if (rate >= 1.5)  return 'ممتاز جداً! استمروا في هذا التميز! ⭐';
  if (rate >= 1)    return 'تم تحقيق التارجت! عمل رائع! ✅';
  if (rate >= 0.75) return 'قريبين جداً! دفعة صغيرة وهنوصل! 💪';
  if (rate >= 0.5)  return 'في الطريق الصح! ركزوا ويلا! 🎯';
  return 'يلا نتحرك! الفرصة لسه موجودة! 🚀';
}
