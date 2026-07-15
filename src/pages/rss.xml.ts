import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('post', ({ data }) => !data.draft)).sort(
    (a, b) => (b.data.publishDate?.valueOf() ?? 0) - (a.data.publishDate?.valueOf() ?? 0)
  );

  return rss({
    title: 'snehan kekre · posts',
    description: 'Writing by Snehan Kekre: docs, devrel, open source, and diving.',
    site: context.site ?? 'https://snehankekre.com',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.publishDate,
      link: `/posts/${post.id}`,
      // Full post HTML for .md posts; .mdx islands fall back to the excerpt.
      content: post.rendered?.html,
    })),
  });
}
