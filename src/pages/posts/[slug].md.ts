// Raw-markdown mirror of every post: /posts/<slug>.md
// The easiest possible surface for agents (and curl) to consume a post.
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('post', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { body: post.body ?? '' },
  }));
}

export function GET({ props }: { props: { body: string } }) {
  return new Response(props.body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
