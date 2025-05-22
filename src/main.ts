// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { createLinkedinScraper } from '@harvestapi/scraper';
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

const query: {
  posts: string[];
} = {
  posts: input.posts || [],
};

const { actorId, actorRunId, actorBuildId, userId, actorMaxPaidDatasetItems, memoryMbytes } =
  Actor.getEnv();

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
  },
});

let maxItems = Number(input.maxItems) || actorMaxPaidDatasetItems || undefined;
if (actorMaxPaidDatasetItems && maxItems && maxItems > actorMaxPaidDatasetItems) {
  maxItems = actorMaxPaidDatasetItems;
}

const scrapePostQueue = createConcurrentQueues(6, async (post: string) => {
  await scraper.scrapePostReactions({
    query: {
      post: post,
      ...query,
    },
    outputType: 'callback',
    onItemScraped: async ({ item }) => {
      console.info(`Scraped reaction ${item?.id}`);
      await Actor.pushData(item);
    },
    overrideConcurrency: 2,
    maxItems,
    disableLog: true,
  });
});

await Promise.all(input.posts.map((post) => scrapePostQueue(post)));

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
