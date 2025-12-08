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
        if (item.actor.linkedinUrl.includes('linkedin.com/in/')) {
          const profile = await scraper
            .getProfile({
              url: item.actor?.linkedinUrl,
              main: true,
            })
            .catch((err) => {
              console.warn(
                `Failed to fetch profile ${item.actor?.linkedinUrl}: ${err.message}`,
                err,
              );
              return null;
            });
          if (profile?.element?.id) {
            Actor.charge({ eventName: 'main-profile' });
            item.actor = { ...item.actor, ...profile.element };
          }
        } else {
          const company = await scraper
            .getCompany({
              url: item.actor.linkedinUrl,
            })
            .catch((err) => {
              console.warn(
                `Failed to fetch company ${item.actor?.linkedinUrl}: ${err.message}`,
                err,
              );
              return null;
            });

          if (company?.element?.id) {
            const profileChargeResult = await Actor.charge({ eventName: 'main-profile' });
            if (profileChargeResult.eventChargeLimitReached) {
              await Actor.exit({
                statusMessage: 'max charge reached',
              });
            }
            item.actor = { ...item.actor, ...company.element };
          }
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
