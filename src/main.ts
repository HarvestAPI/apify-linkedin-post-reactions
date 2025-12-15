// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { createConcurrentQueues, createLinkedinScraper } from '@harvestapi/scraper';
import { Actor } from 'apify';
import { config } from 'dotenv';
import { getPushData } from './utils/pushData.js';

config();

// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
// import { router } from './routes.js';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

export interface Input {
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
  await Actor.exit({
    statusMessage: 'no-posts-provided',
  });
}

const { actorId, actorRunId, actorBuildId, userId, memoryMbytes } = Actor.getEnv();

const client = Actor.newClient();
const user = userId ? await client.user(userId).get() : null;
const cm = Actor.getChargingManager();
const pricingInfo = cm.getPricingInfo();

if (pricingInfo.maxTotalChargeUsd < 0.002) {
  console.warn(
    'Warning: The maximum total charge is set to less than $0.002, which will not be sufficient for scraping.',
  );
  await Actor.exit({
    statusMessage: 'max charge reached',
  });
}

const scraper = createLinkedinScraper({
  apiKey: process.env.HARVESTAPI_TOKEN!,
  baseUrl: process.env.HARVESTAPI_URL || 'https://api.harvest-api.com',
  addHeaders: {
    'x-apify-userid': userId!,
    'x-apify-actor-id': actorId!,
    'x-apify-actor-run-id': actorRunId!,
    'x-apify-actor-build-id': actorBuildId!,
    'x-apify-memory-mbytes': String(memoryMbytes),
    'x-apify-username': user?.username || '',
    'x-apify-user-is-paying': (user as Record<string, any> | null)?.isPaying,
    'x-apify-max-total-charge-usd': String(pricingInfo.maxTotalChargeUsd),
  },
});

const { pushData } = getPushData({ scraper, input });

const scrapePostQueue = createConcurrentQueues(1, async (post: string) => {
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
    onPageFetched: async ({ page, data }) => {
      console.info(
        `Fetched reactions page: ${page} for ${data?.query?.post}. Found ${data?.elements?.length} reactions on the page. Total pages to scrape: ${data?.pagination?.totalPages}. Total number of reactions: ${data?.pagination?.totalResultCount || data?.pagination?.totalElements} `,
      );
    },
    overridePageConcurrency: 2,
    overrideConcurrency: 30,
    maxItems: Number(input.maxItems) || undefined,
    disableLog: true,
  });
});

await Promise.all(input.posts.map((post) => scrapePostQueue(post)));

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit({
  statusMessage: 'success',
});
