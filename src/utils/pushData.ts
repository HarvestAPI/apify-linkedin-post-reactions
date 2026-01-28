import { createConcurrentQueues, LinkedinScraper, PostReaction } from '@harvestapi/scraper';
import { Input } from '../main.js';
import { Actor } from 'apify';

export function getPushData({ scraper, input }: { input: Input; scraper: LinkedinScraper }) {
  const { actorMaxPaidDatasetItems } = Actor.getEnv();

  const shouldScrapeProfiles =
    input.profileScraperMode === 'main' ||
    input.profileScraperMode === 'full' ||
    input.profileScraperMode === 'full_email_search';

  let totalItemsCounter = 0;

  const fetchProfileData = createConcurrentQueues(15, async (profileUrl: string) => {
    if (profileUrl.includes('linkedin.com/in/')) {
      const profile = await scraper
        .getProfile({
          url: profileUrl,
          main: true,
        })
        .catch((err: any) => {
          console.warn(`Failed to fetch profile ${profileUrl}: ${err.message}`, err);
          return null;
        });
      if (profile?.element?.id) {
        Actor.charge({ eventName: 'main-profile' });
        return profile.element;
      }
    } else {
      const company = await scraper
        .getCompany({
          url: profileUrl,
        })
        .catch((err) => {
          console.warn(`Failed to fetch company ${profileUrl}: ${err.message}`, err);
          return null;
        });

      if (company?.element?.id) {
        const profileChargeResult = await Actor.charge({ eventName: 'main-profile' });
        if (profileChargeResult.eventChargeLimitReached) {
          await Actor.exit({
            statusMessage: 'max charge reached',
          });
        }
        return company.element;
      }
    }
    return null;
  });

  const pushData = createConcurrentQueues(
    30,
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
        const profileData = await fetchProfileData(item.actor.linkedinUrl).catch((err) => {
          console.warn(`Failed to fetch profile for reaction ${item.id}: ${err.message}`, err);
          return null;
        });
        if (profileData) {
          item.actor = { ...item.actor, ...profileData };
        }
      }

      console.info(`Scraped reaction ${item?.id}`);
      // new events:
      // post-reaction
      // main-profile
      // full-profile
      // full-profile-with-email
      const pushResult = await Actor.pushData({ ...item, query }, 'post-reaction');
      if (pushResult.eventChargeLimitReached) {
        await Actor.exit({
          statusMessage: 'max charge reached',
        });
      }
    },
  );

  return { pushData };
}
