import { extractRedditPostId } from "@/tools/reddit/utils/extractRedditPostId";

const BASE_REDDIT_URL = "https://www.reddit.com";
const USER_AGENT = "wizardlab-bot/0.1 (contact: hello@wizardlab.app)";

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export type ResolvedRedditPost = {
  external_post_id: string;
  permalink: string;
  title: string;
  body: string;
  author_handle: string | null;
  extra: {
    subreddit: string | null;
    created_utc: number | null;
    url_overridden_by_dest: string | null;
    raw: unknown;
  };
};

export async function resolveRedditPost(permalink: string): Promise<ResolvedRedditPost> {
  const postId = extractRedditPostId(permalink);
  if (!postId) {
    throw new Error(`Unsupported Reddit URL: ${permalink}`);
  }

  const jsonUrl = `${BASE_REDDIT_URL}/comments/${postId}.json`;
  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Reddit JSON (${response.status}): ${jsonUrl}`);
  }

  const payload = (await response.json()) as any[];
  const postData = payload?.[0]?.data?.children?.[0]?.data;
  if (!postData) {
    throw new Error(`Could not find post data in Reddit JSON: ${jsonUrl}`);
  }

  const postIdValue = postData.id;
  const postPermalink = postData.permalink;
  if (!postIdValue || !postPermalink) {
    throw new Error(`Could not find post data in Reddit JSON: ${jsonUrl}`);
  }

  const formattedPermalink =
    typeof postPermalink === "string"
      ? ensureTrailingSlash(
          postPermalink.startsWith("http")
            ? postPermalink
            : `${BASE_REDDIT_URL}${postPermalink}`
        )
      : `${BASE_REDDIT_URL}/`;

  return {
    external_post_id: String(postIdValue),
    permalink: formattedPermalink,
    title: typeof postData.title === "string" ? postData.title : "",
    body: typeof postData.selftext === "string" ? postData.selftext : "",
    author_handle: typeof postData.author === "string" ? postData.author : null,
    extra: {
      subreddit: typeof postData.subreddit === "string" ? postData.subreddit : null,
      created_utc: typeof postData.created_utc === "number" ? postData.created_utc : null,
      url_overridden_by_dest:
        typeof postData.url_overridden_by_dest === "string"
          ? postData.url_overridden_by_dest
          : null,
      raw: postData,
    },
  };
}
