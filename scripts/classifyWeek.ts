import { classifyCurrentWeekArticles } from '../classification/classifyTopics';
import { DateTime } from 'luxon';

async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  
  for (const arg of args) {
    if (arg.startsWith('--week=')) {
      weekLabel = arg.split('=')[1];
      break;
    }
  }
  
  if (!weekLabel) {
    console.error('Error: --week=YYYY-W## is required');
    console.error('Usage: npx tsx scripts/classifyWeek.ts --week=2026-W04');
    process.exit(1);
  }
  
  // Parse week label
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    console.error(`Invalid week format: ${weekLabel}. Expected YYYY-W##`);
    process.exit(1);
  }
  
  const year = parseInt(weekMatch[1], 10);
  const weekNumber = parseInt(weekMatch[2], 10);
  const dt = DateTime.fromObject({ weekYear: year, weekNumber }, { zone: 'Europe/Copenhagen' });
  
  if (!dt.isValid) {
    console.error(`Invalid week: ${weekLabel}. ${dt.invalidReason}`);
    process.exit(1);
  }
  
  console.log(`Classifying articles for week: ${weekLabel}...\n`);
  
  const { weekLabel: resultWeekLabel, byTopic } = await classifyCurrentWeekArticles(dt.toJSDate());
  
  console.log(`Week: ${resultWeekLabel}`);
  console.log(`AI_and_Strategy: ${byTopic.AI_and_Strategy.length}`);
  console.log(`Ecommerce_Retail_Tech: ${byTopic.Ecommerce_Retail_Tech.length}`);
  console.log(`Luxury_and_Consumer: ${byTopic.Luxury_and_Consumer.length}`);
  console.log(`Jewellery_Industry: ${byTopic.Jewellery_Industry.length}`);
  console.log(`\nTotal: ${byTopic.AI_and_Strategy.length + byTopic.Ecommerce_Retail_Tech.length + byTopic.Luxury_and_Consumer.length + byTopic.Jewellery_Industry.length}`);
}

main().catch(err => {
  console.error('Classification failed:', err);
  process.exit(1);
});
