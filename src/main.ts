// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { createLinkedinScraper, PostReaction } from '@harvestapi/scraper';
import { Actor } from 'apify';
import { config } from 'dotenv';
import { createConcurrentQueues } from './utils/queue.js';

config();

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
// import { router } from './routes.js';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

interface Input {
  posts: string[];
  maxItems?: number;
  profileScraperMode: 'short' | 'main' | 'full' | 'full_email_search';
  reactionTypeFilter?: string[];
}

// Structure of input is defined in input_schema.json
const input = await Actor.getInput<Input>();
if (!input) throw new Error('Input is missing!');
input.posts = (input.posts || []).filter((q) => q && !!q.trim());
if (!input.posts?.length) {
  console.error('No search queries provided!');
  await Actor.exit();
  process.exit(0);
}

const { actorId, actorRunId, actorBuildId, userId, actorMaxPaidDatasetItems, memoryMbytes } =
  Actor.getEnv();
const cm = Actor.getChargingManager();
const pricingInfo = cm.getPricingInfo();

const client = Actor.newClient();
const user = userId ? await client.user(userId).get() : null;

const scraper = createLinkedinScraper({
  apiKey: process.env.HARVESTAPI_TOKEN!,
  baseUrl: process.env.HARVESTAPI_URL || 'https://api.harvest-api.com',
  addHeaders: {
    'x-apify-userid': userId!,
    'x-apify-actor-id': actorId!,
    'x-apify-actor-run-id': actorRunId!,
    'x-apify-actor-build-id': actorBuildId!,
    'x-apify-memory-mbytes': String(memoryMbytes),
    'x-apify-actor-max-paid-dataset-items': String(actorMaxPaidDatasetItems) || '0',
    'x-apify-username': user?.username || '',
    'x-apify-user-is-paying': (user as Record<string, any> | null)?.isPaying,
  },
});

let maxItems = Number(input.maxItems) || actorMaxPaidDatasetItems || undefined;
if (actorMaxPaidDatasetItems && maxItems && maxItems > actorMaxPaidDatasetItems) {
  maxItems = actorMaxPaidDatasetItems;
}
let totalItemsCounter = 0;
const shouldScrapeProfiles =
  input.profileScraperMode === 'main' ||
  input.profileScraperMode === 'full' ||
  input.profileScraperMode === 'full_email_search';

const pushData = createConcurrentQueues(
  shouldScrapeProfiles ? 20 : 190,
  async (item: PostReaction, query: Record<string, any>) => {
    if (
      input.reactionTypeFilter &&
      input.reactionTypeFilter.length &&
      !input.reactionTypeFilter.includes('ALL')
    ) {
      if (!item.reactionType || !input.reactionTypeFilter.includes(item.reactionType)) {
        return;
      }
    }

    totalItemsCounter++;

    if (actorMaxPaidDatasetItems && totalItemsCounter > actorMaxPaidDatasetItems) {
      setTimeout(async () => {
        console.warn('Max items reached, exiting...');
        await Actor.exit();
      }, 1000);
      return;
    }

    if (item.actor?.linkedinUrl && shouldScrapeProfiles) {
      const profile = await scraper
        .getProfile({
          url: item.actor?.linkedinUrl,
          short: true,
        })
        .catch((err) => {
          console.warn(`Failed to fetch profile ${item.actor?.linkedinUrl}: ${err.message}`);
          return null;
        });
      if (profile?.element?.id) {
        if (pricingInfo.isPayPerEvent) {
          Actor.charge({ eventName: 'main-profile' });
        }
        item.actor = { ...item.actor, ...profile.element };
      }
    }

    console.info(`Scraped reaction ${item?.id}`);
    // new events:
    // post-reaction
    // main-profile
    // full-profile
    // full-profile-with-email
    if (pricingInfo.isPayPerEvent) {
      await Actor.pushData({ ...item, query }, 'post-reaction');
    } else {
      await Actor.pushData({ ...item, query });
    }
  },
);

const scrapePostQueue = createConcurrentQueues(6, async (post: string) => {
  const reactionsQuery = {
    post: post,
  };

  await scraper.scrapePostReactions({
    query: reactionsQuery,
    outputType: 'callback',
    onItemScraped: async ({ item }) => {
      if (!item) return;
      await pushData(item, reactionsQuery);
    },
    overridePageConcurrency: 2,
    maxItems,
    disableLog: true,
  });
});

await Promise.all(input.posts.map((post) => scrapePostQueue(post)));

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
