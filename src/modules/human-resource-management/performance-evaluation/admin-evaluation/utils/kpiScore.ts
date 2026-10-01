export function computeTotalScore(
  items: readonly { rating: number; weight_percentage_snapshot: number }[]
): number {
  const total = items.reduce(
    (sum, item) => sum + (item.rating * item.weight_percentage_snapshot) / 100,
    0
  );
  return Math.round(total * 100) / 100;
}

export function ratingBand(total: number): string | null {
  if (total >= 4.5 && total <= 5) return "Outstanding";
  if (total >= 3.5 && total < 4.5) return "Very Good";
  if (total >= 2.5 && total < 3.5) return "Satisfactory";
  if (total >= 1.5 && total < 2.5) return "Needs Improvement";
  if (total >= 1 && total < 1.5) return "Unsatisfactory";
  return null;
}

export function sumWeights(
  items: readonly { weight_percentage_snapshot: number }[]
): number {
  const total = items.reduce((sum, item) => sum + item.weight_percentage_snapshot, 0);
  return Math.round(total * 100) / 100;
}

export function isWeightSetValid(
  items: readonly { weight_percentage_snapshot: number }[]
): boolean {
  const hundredths = Math.round(sumWeights(items) * 100);
  return Math.abs(hundredths - 10000) <= 1;
}
