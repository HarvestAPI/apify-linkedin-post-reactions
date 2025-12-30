## LinkedIn Post Reactions Mass scraper

Our powerful tool helps you extract LinkedIn post or or post comment social activities and reactions such as likes, appreciations, praises without compromising security or violating platform policies. It is very helpful for engagement analysis and outreach purposes.

### Key Benefits

- No cookies or account required: Access reactions data without sharing cookies or risking account restrictions
- Low pricing: $2 per 1k reactions.
- Fast response times deliver data in seconds 🚀
- No caching, fresh data.

## How It Works

- (required) List of post URLs or post comment URLs to scrape.

Other params (optionally):

- `maxItems` - Maximum number of reactions to scrape per each post. If you set to 0, it will scrape all available pages or up to 100 pages (each page 10 items) per post.

### Data You'll Receive

- Reaction type (like, love, insightful, etc.)
- Actor's name
- Actor's LinkedIn encoded URL
- Actor's position
- Actor's profile picture URL

Note: By default, this Actor returns encoded LinkedIn profile URLs as provided by the LinkedIn website. To obtain standard profile URLs and additional user data, enable Profile Scraper Mode in the input settings. Please note that visiting individual profiles incurs additional usage costs.

### Sample output data

Here is the example reaction output of this actor:

```json
{
  "id": "urn:li:fsd_reaction:(urn:li:fsd_profile:ACoAAAMHAagBPz-UgeRDsX3klfoVZEkDw1ulS7E,urn:li:ugcPost:7329207002977443840,0)",
  "reactionType": "LIKE",
  "actor": {
    "id": "ACoAAAMHAagBPz-UgeRDsX3klfoVZEkDw1ulS7E",
    "name": "Gangotri Dey (Ph.D)",
    "linkedinUrl": "https://www.linkedin.com/in/ACoAAAMHAagBPz-UgeRDsX3klfoVZEkDw1ulS7E",
    "position": "Licensing Officer | Intellectual Property | Patents | Technology Transfer | Egalitarian | Numismatist",
    "pictureUrl": "https://media.licdn.com/dms/image/v2/D4E03AQGDj6wx_xJbRQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1668631616852?e=1753315200&v=beta&t=12ishzrb2wqXHERve9a-wNaL4_V6H6a2rA76UYX5MWI",
    "picture": {
      "url": "https://media.licdn.com/dms/image/v2/D4E03AQGDj6wx_xJbRQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1668631616852?e=1753315200&v=beta&t=12ishzrb2wqXHERve9a-wNaL4_V6H6a2rA76UYX5MWI",
      "width": 594,
      "height": 594,
      "expiresAt": 1753315200000
    }
  },
  "postId": "7329207003942125568"
}
```

## Linkedin Post Reactions API

The actor stores results in a dataset. You can export data in various formats such as CSV, JSON, XLS, etc. You can scrape and access data on demand using API.

### Support and Feedback

We continuously enhance our tools based on user feedback. If you encounter technical issues or have suggestions for improvement:

- Create an issue on the actor’s Issues tab in Apify Console
- Chat with us on our [Discord server](https://discord.gg/TGA9k9u2gE)
- Or contact us at contact@harvest-api.com
