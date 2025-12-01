const ALLOWED_HOSTNAMES = new Set(["reddit.com", "www.reddit.com", "redd.it", "www.redd.it"]);

export function extractRedditPostId(permalink: string): string | null {
  if (!permalink) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(permalink.trim());
  } catch (error) {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (hostname === "redd.it" || hostname === "www.redd.it") {
    const [postId] = segments;
    return postId ?? null;
  }

  if (segments[0] === "r" && segments[2] === "comments") {
    const postId = segments[3];
    if (!postId) {
      return null;
    }

    if (segments.length >= 6) {
      return null;
    }

    return postId;
  }

  if (segments[0] === "comments") {
    const postId = segments[1];
    if (!postId) {
      return null;
    }

    if (segments.length >= 4) {
      return null;
    }

    return postId;
  }

  return null;
}
